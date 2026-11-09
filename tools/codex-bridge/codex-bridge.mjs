#!/usr/bin/env node
// codex-bridge: lets Claude Code call the locally installed, ChatGPT-authenticated Codex CLI
// (or, with --agent opencode, OpenCode on the OpenCode Go subscription, or with --agent antigravity,
// the Antigravity `agy` CLI on the signed-in Google account) as a specialist.
// No dependencies. Subcommands:
//   run      codex exec with a role contract, timeout, run log and image collection
//   review   codex exec review (read-only) on uncommitted changes, a base branch or a commit
//   cancel   kill a running job by run id (or --last)
//   list     recent runs and their status
//   doctor   resolve the binary, check auth, print capabilities
//   raw      pass arguments straight to codex.exe (used by the `codex` shim)
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const HOME = os.homedir();
const STATE = path.join(process.env.LOCALAPPDATA || path.join(HOME, ".local", "state"), "codex-bridge");
const RUNS = path.join(STATE, "runs");
const EXE_CACHE = path.join(STATE, "exe.txt");
const CODEX_HOME = process.env.CODEX_HOME || path.join(HOME, ".codex");
const GENERATED = path.join(CODEX_HOME, "generated_images");
const DEPTH_VAR = "CODEX_BRIDGE_ACTIVE";
const IS_WIN = process.platform === "win32";

const AGENTS = { codex: "Codex", opencode: "OpenCode", antigravity: "Antigravity" };
// Matched against errors and stderr of a failed run, for every agent.
const QUOTA_RE = /quota|rate.?limit|resource.?exhausted|usage.?limit|too many requests|\b429\b|credits? (?:exhausted|depleted)|out of credits/i;
// OpenCode runs are limited to the flat-rate OpenCode Go subscription; other providers bill per token.
const OPENCODE_PROVIDER = "opencode-go/";
const OPENCODE_DEFAULT_MODEL = "opencode-go/kimi-k3";

const contract = agent => `You are ${AGENTS[agent]}, invoked as a specialist by Claude Code, which is the primary architect and final reviewer.
Rules for this task:
- Do only the task below, inside the working directory you were given. Do not touch unrelated files.
- Do not delegate to other agents and do not run the \`claude\`, \`codex\`, \`opencode\`, \`agy\` or \`codex-bridge\` commands.
- Never commit, push, merge, deploy, publish, or run destructive commands (rm -rf, git reset --hard, git clean).
- Never print or write secrets, tokens or API keys.
- If something is blocked or unknown, say so plainly; never invent results.
- End with a short summary: what you did, every file you created or changed (absolute paths), and anything left undone.

TASK:
`;

function fail(message, code = 2) {
  process.stdout.write(JSON.stringify({ status: "error", error: message }, null, 2) + "\n");
  process.exit(code);
}

// ---------- binary resolution ----------
function resolveExe() {
  if (process.env.CODEX_EXE && fs.existsSync(process.env.CODEX_EXE)) return process.env.CODEX_EXE;
  try {
    const cached = fs.readFileSync(EXE_CACHE, "utf8").trim();
    if (cached && fs.existsSync(cached)) return cached;
  } catch {}
  let found = null;
  if (IS_WIN) {
    // The Codex desktop app (Microsoft Store) bundles the CLI; its folder is versioned and the
    // WindowsApps parent is not listable, so ask Appx for the current install location.
    const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      "(Get-AppxPackage -Name OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1).InstallLocation"],
      { encoding: "utf8" });
    const loc = (r.stdout || "").trim();
    const candidate = loc && path.join(loc, "app", "resources", "codex.exe");
    if (candidate && fs.existsSync(candidate)) found = candidate;
  }
  if (!found) {
    // A standalone npm/brew install, if one is ever added. Skip our own shim.
    const r = spawnSync(IS_WIN ? "where.exe" : "which", [IS_WIN ? "codex.exe" : "codex"], { encoding: "utf8" });
    found = (r.stdout || "").split(/\r?\n/).map(s => s.trim()).find(p => p && fs.existsSync(p) && !p.includes(".local")) || null;
  }
  if (!found) fail("Codex CLI not found. Install the Codex desktop app or `npm i -g @openai/codex`, or set CODEX_EXE.");
  fs.mkdirSync(STATE, { recursive: true });
  fs.writeFileSync(EXE_CACHE, found);
  return found;
}

function childEnv() {
  const env = { ...process.env, [DEPTH_VAR]: "1" };
  // Never let a stray key silently move a run onto paid API billing.
  delete env.OPENAI_API_KEY;
  delete env.CODEX_API_KEY;
  return env;
}

// ---------- opencode ----------
function resolveOpencode() {
  // OPENCODE_EXE may also name a .js/.mjs script (a fake used by the bridge's own tests).
  const own = process.env.OPENCODE_EXE;
  if (own) return fs.existsSync(own) ? own : fail(`OPENCODE_EXE does not exist: ${own}`);
  // The npm package's .cmd shim cannot be spawned without a shell, so use the native binary behind it.
  const npm = process.env.APPDATA && path.join(process.env.APPDATA, "npm", "node_modules", "@opencode", "cli", "bin", "opencode.exe");
  if (npm && fs.existsSync(npm)) return npm;
  const r = spawnSync(IS_WIN ? "where.exe" : "which", [IS_WIN ? "opencode.exe" : "opencode"], { encoding: "utf8" });
  const found = (r.stdout || "").split(/\r?\n/).map(s => s.trim()).find(p => p && fs.existsSync(p));
  return found || fail("OpenCode CLI not found. Install it with npm, or set OPENCODE_EXE.");
}

function opencodeCommand(exe, args) {
  return /\.m?js$/i.test(exe) ? [process.execPath, [exe, ...args]] : [exe, args];
}

function opencodeEnv(sandbox, addDirs) {
  const env = childEnv();
  // Stored OpenCode Go credentials are used; any provider key in the environment would be paid usage.
  for (const k of Object.keys(env)) if (/_API_KEY$/i.test(k)) delete env[k];
  env.OPENCODE_DISABLE_AUTOUPDATE = "1";
  // Ordered rules, last match wins. Honored together with --standalone (a private server per run).
  const deny = (action, resource) => ({ action, resource, effect: "deny" });
  const allow = (action, resource) => ({ action, resource, effect: "allow" });
  const rules = [deny("external_directory", "*"), ...addDirs.flatMap(d => [allow("external_directory", d), allow("external_directory", path.join(d, "*"))])];
  if (sandbox === "read-only") {
    rules.push(deny("edit", "*"), deny("shell", "*"));
    for (const c of ["git status*", "git diff*", "git log*", "git show*", "git blame*", "rg *", "ls*", "cat *"]) rules.push(allow("shell", c));
  }
  for (const c of ["git push*", "git commit*", "git merge*", "git rebase*", "git reset*", "git clean*", "git stash*", "git checkout*", "git switch*",
    "rm -rf*", "rm -r *", "Remove-Item*", "del /s*", "rmdir /s*", "codex*", "claude*", "opencode*", "gh *", "npm publish*"]) rules.push(deny("shell", c));
  rules.push(deny("subagent", "*"));
  env.OPENCODE_CONFIG_CONTENT = JSON.stringify({ permissions: rules });
  return env;
}

function opencodeModel(opts) {
  const model = opts.model || OPENCODE_DEFAULT_MODEL;
  if (!model.startsWith(OPENCODE_PROVIDER)) fail(`OpenCode runs are limited to the OpenCode Go subscription (models starting with ${OPENCODE_PROVIDER}). Got: ${model}`);
  return opts.effort ? `${model}#${opts.effort}` : model;
}

function opencodeAuth(exe) {
  const [cmd, args] = opencodeCommand(exe, ["auth", "list"]);
  const r = spawnSync(cmd, args, { encoding: "utf8", env: childEnv(), windowsHide: true });
  // Only account names are matched; key values are never printed.
  const out = `${r.stdout || ""}${r.stderr || ""}`.replace(/\x1b\[[0-9;]*m/g, "");
  return /OpenCode Go/i.test(out) ? "opencode-go-stored" : "logged-out";
}

function runOpencode(kind, task, run, opts, sandbox) {
  const exe = resolveOpencode();
  if (opencodeAuth(exe) !== "opencode-go-stored") fail("No OpenCode Go credential is stored. Run `opencode auth login` (OpenCode Go) yourself, then retry.");
  const prompt = contract("opencode") + task;
  fs.writeFileSync(path.join(run.dir, "prompt.md"), prompt);
  if (prompt.length > 30000) fail("Prompt too long for a command line (>30k chars). Put the detail in a file in the workspace and reference it.");
  const args = ["run", "--standalone", "--auto", "--format", "json", "-m", opencodeModel(opts), "--title", `codex-bridge ${run.id}`];
  for (const img of opts.images) args.push("--file", img);
  args.push(prompt);
  const [cmd, cmdArgs] = opencodeCommand(exe, args);
  const texts = [];
  const tokens = { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 };
  let cost = 0, steps = 0;
  execute(kind, {
    exe: cmd, args: cmdArgs, env: opencodeEnv(sandbox, opts.addDirs), agent: "opencode",
    // Events are {type, timestamp, sessionID, part | error}; types: step_start, text, reasoning, tool_use, step_finish, error.
    onEvent(ev, state) {
      if (ev.sessionID && !state.threadId) state.threadId = ev.sessionID;
      if (ev.type === "text" && ev.part?.text?.trim()) texts.push(ev.part.text.trim());
      if (ev.type === "step_finish") {
        steps++;
        const t = ev.part?.tokens || {};
        tokens.input += t.input || 0; tokens.output += t.output || 0; tokens.reasoning += t.reasoning || 0;
        tokens.cacheRead += t.cache?.read || 0; tokens.cacheWrite += t.cache?.write || 0;
        cost += ev.part?.cost || 0;
        state.usage = { ...tokens, steps, cost };
      }
      if (ev.type === "error") state.errors.push(ev.error?.message || JSON.stringify(ev.error || ev));
    },
    // OpenCode has no output file, so the final text part becomes last-message.md.
    lastMessage: () => texts.at(-1) || "",
  }, run, opts);
}

// ---------- antigravity (agy) ----------
function resolveAgy() {
  // AGY_EXE may also name a .js/.mjs script (a fake used by the bridge's own tests).
  const own = process.env.AGY_EXE;
  if (own) return fs.existsSync(own) ? own : fail(`AGY_EXE does not exist: ${own}`);
  const local = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "agy", "bin", "agy.exe");
  if (local && fs.existsSync(local)) return local;
  const r = spawnSync(IS_WIN ? "where.exe" : "which", [IS_WIN ? "agy.exe" : "agy"], { encoding: "utf8" });
  const found = (r.stdout || "").split(/\r?\n/).map(s => s.trim()).find(p => p && fs.existsSync(p));
  return found || fail("Antigravity CLI (agy) not found. Install it, or set AGY_EXE.");
}

function agyEnv() {
  const env = childEnv();
  // agy uses the signed-in Google account; a Gemini/Google key or service account in the environment would be paid usage.
  for (const k of Object.keys(env)) if (/_API_KEY$/i.test(k) || /^GOOGLE_APPLICATION_CREDENTIALS$/i.test(k)) delete env[k];
  return env;
}

// agy permission rules match tool calls exactly or with `*` only (no prefixes), so the hard limits come from
// --sandbox (commands cannot write the workspace) plus denying the file-write tool in read-only mode.
function agySettings(sandbox) {
  const permissions = { allow: ["command(*)"], deny: [] };
  if (sandbox === "read-only") permissions.deny.push("write_file(*)");
  return JSON.stringify({ permissions });
}

function runAntigravity(kind, task, run, opts, sandbox) {
  const exe = resolveAgy();
  const prompt = contract("antigravity") + task;
  fs.writeFileSync(path.join(run.dir, "prompt.md"), prompt);
  if (prompt.length > 30000) fail("Prompt too long for a command line (>30k chars). Put the detail in a file in the workspace and reference it.");
  const args = ["-p", prompt, "--output-format", "stream-json", "--sandbox", "--disable-slash-commands", "--settings", agySettings(sandbox)];
  if (opts.model) args.push("--model", opts.model);
  if (opts.effort) args.push("--effort", opts.effort);
  for (const d of opts.addDirs) args.push("--add-dir", d);
  const [cmd, cmdArgs] = opencodeCommand(exe, args);
  let deltas = "", response = null;
  execute(kind, {
    exe: cmd, args: cmdArgs, env: agyEnv(), agent: "antigravity",
    // Events are {event, ...}: init {conversation_id}, step_update {step_type, state, text_delta?, usage?}, result {status, response, usage, denied_actions}.
    onEvent(ev, state) {
      if (ev.event === "init" && ev.conversation_id) state.threadId = ev.conversation_id;
      const step = ev.step_update;
      if (step?.step_type === "agent_response" && step.text_delta) deltas += step.text_delta;
      if (ev.event === "error" || ev.error) state.errors.push(ev.error?.message || ev.message || JSON.stringify(ev.error || ev));
      const res = ev.result;
      if (ev.event === "result" && res) {
        state.threadId ||= res.conversation_id || null;
        response = res.response ?? null;
        if (res.usage) state.usage = { ...res.usage, turns: res.num_turns ?? null };
        if (res.status !== "SUCCESS") state.errors.push(`agy result status ${res.status}${res.error ? `: ${res.error.message || res.error}` : ""}`);
        const denied = res.denied_actions || [];
        // A denied action with no answer means the task could not be done inside the sandbox; surface it loudly.
        if (denied.length && !String(response || "").trim()) state.errors.push(`Denied by sandbox rules: ${denied.map(d => typeof d === "string" ? d : JSON.stringify(d)).join("; ")}`);
      }
    },
    lastMessage: () => String(response ?? deltas).trim(),
    // agy can exit 0 without a result event (e.g. "no output produced"); that is a failure, not ok.
    finalize(state) { if (response === null && !state.errors.length) state.errors.push("agy produced no result event"); },
  }, run, opts);
}

function authMode(exe) {
  const r = spawnSync(exe, ["login", "status"], { encoding: "utf8", env: childEnv() });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  if (/ChatGPT/i.test(out)) return "chatgpt";
  if (/API key/i.test(out)) return "api-key";
  if (/not logged in/i.test(out)) return "logged-out";
  return "unknown";
}

function requireSubscriptionAuth(exe, allowApiKey) {
  const mode = authMode(exe);
  if (mode === "chatgpt") return mode;
  if (mode === "api-key" && allowApiKey) return mode;
  if (mode === "api-key") fail("Codex is logged in with an API key (paid usage). Refusing; rerun with --allow-api-key only if the owner approved it, or run `codex login` with ChatGPT.");
  fail(`Codex auth is '${mode}'. Run \`codex login\` (ChatGPT) yourself, then retry.`);
}

// ---------- args ----------
function parseArgs(argv) {
  const opts = { images: [], addDirs: [], _: [] };
  const flags = new Set(["worktree", "uncommitted", "allow-api-key", "ephemeral", "last", "allow-write"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { opts._.push(a); continue; }
    const key = a.slice(2);
    if (flags.has(key)) { opts[key] = true; continue; }
    const val = argv[++i];
    if (val === undefined) fail(`Missing value for ${a}`);
    if (key === "image") opts.images.push(path.resolve(val));
    else if (key === "add-dir") opts.addDirs.push(path.resolve(val));
    else opts[key] = val;
  }
  return opts;
}

function readPrompt(opts) {
  if (opts["prompt-file"]) return fs.readFileSync(opts["prompt-file"], "utf8");
  if (opts.prompt) return opts.prompt;
  if (opts._.length) return opts._.join(" ");
  if (!process.stdin.isTTY) return fs.readFileSync(0, "utf8");
  return "";
}

function isGitRepo(dir) {
  return spawnSync("git", ["-C", dir, "rev-parse", "--is-inside-work-tree"], { encoding: "utf8" }).stdout?.trim() === "true";
}

// ---------- process control ----------
function killTree(pid) {
  if (!pid) return;
  if (IS_WIN) spawnSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  else try { process.kill(-pid, "SIGKILL"); } catch { try { process.kill(pid, "SIGKILL"); } catch {} }
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

// ---------- images ----------
function imageInfo(file) {
  const b = fs.readFileSync(file);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { format: "png", width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i < b.length - 9;) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { format: "jpeg", width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      i += 2 + len;
    }
    return { format: "jpeg", width: null, height: null };
  }
  if (b.length > 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return { format: "webp", width: null, height: null };
  return null;
}

function collectImages(threadId, assetsDir, prefix) {
  if (!threadId) return [];
  const src = path.join(GENERATED, threadId);
  if (!fs.existsSync(src)) return [];
  const files = fs.readdirSync(src).map(f => path.join(src, f)).filter(f => fs.statSync(f).isFile())
    .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
  const out = [];
  if (assetsDir) fs.mkdirSync(assetsDir, { recursive: true });
  files.forEach((f, i) => {
    const info = imageInfo(f);
    if (!info) return;
    let dest = f;
    if (assetsDir) {
      const ext = info.format === "jpeg" ? "jpg" : info.format;
      dest = path.join(assetsDir, `${prefix}-${String(i + 1).padStart(2, "0")}.${ext}`);
      let n = 1;
      while (fs.existsSync(dest)) dest = path.join(assetsDir, `${prefix}-${String(i + 1).padStart(2, "0")}-${n++}.${ext}`);
      fs.copyFileSync(f, dest);
    }
    out.push({ path: dest, source: f, bytes: fs.statSync(dest).size, ...info });
  });
  return out;
}

// ---------- run / review ----------
function newRun(kind, cwd) {
  const id = `${new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "")}-${kind}-${crypto.randomBytes(3).toString("hex")}`;
  const dir = path.join(RUNS, id);
  fs.mkdirSync(dir, { recursive: true });
  return { id, dir, cwd };
}

function writeStatus(run, data) {
  fs.writeFileSync(path.join(run.dir, "status.json"), JSON.stringify({ runId: run.id, cwd: run.cwd, ...data }, null, 2));
}

function codexBackend(codexArgs, run, exe) {
  const sep = codexArgs.indexOf("--");
  const at = sep >= 0 ? sep : codexArgs.length;
  return {
    exe, env: childEnv(), agent: "codex",
    args: [...codexArgs.slice(0, at), "--json", "-o", path.join(run.dir, "last-message.md"), ...codexArgs.slice(at)],
    onEvent(ev, state) {
      if (ev.type === "thread.started") state.threadId = ev.thread_id;
      if (ev.type === "turn.completed") state.usage = ev.usage;
      if (ev.type === "error" || ev.type === "turn.failed") state.errors.push(ev.message || ev.error?.message || JSON.stringify(ev));
    },
  };
}

function execute(kind, backend, run, opts) {
  const { exe, args, env } = backend;
  const timeoutSec = Number(opts.timeout || 900);
  const lastPath = path.join(run.dir, "last-message.md");
  const eventsPath = path.join(run.dir, "events.jsonl");
  fs.writeFileSync(path.join(run.dir, "command.json"), JSON.stringify({ agent: backend.agent, exe, args, cwd: run.cwd }, null, 2));
  const started = Date.now();
  const events = fs.createWriteStream(eventsPath);
  const stderr = fs.createWriteStream(path.join(run.dir, "stderr.log"));
  const child = spawn(exe, args, { cwd: run.cwd, env, stdio: ["ignore", "pipe", "pipe"], detached: !IS_WIN, windowsHide: true });
  fs.writeFileSync(path.join(run.dir, "pid"), String(child.pid));
  writeStatus(run, { kind, agent: backend.agent, status: "running", pid: child.pid, startedAt: new Date(started).toISOString(), timeoutSec });

  const state = { threadId: null, usage: null, errors: [] };
  let buf = "", timedOut = false, cancelled = false;
  child.stdout.on("data", chunk => {
    events.write(chunk);
    buf += chunk.toString("utf8");
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      backend.onEvent(ev, state);
    }
  });
  child.stderr.pipe(stderr);

  const timer = setTimeout(() => { timedOut = true; killTree(child.pid); }, timeoutSec * 1000);
  const onSignal = () => { cancelled = true; killTree(child.pid); };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  process.on("SIGHUP", onSignal);

  child.on("close", code => {
    clearTimeout(timer);
    events.end(); stderr.end();
    const externallyCancelled = fs.existsSync(path.join(run.dir, "cancelled"));
    if (backend.finalize && !timedOut && !cancelled && !externallyCancelled) backend.finalize(state);
    const { threadId, usage, errors } = state;
    if (backend.lastMessage) { const m = backend.lastMessage(); if (m) fs.writeFileSync(lastPath, m + "\n"); }
    const lastMessage = fs.existsSync(lastPath) ? fs.readFileSync(lastPath, "utf8").trim() : "";
    const assets = backend.agent !== "codex" ? [] : collectImages(threadId, opts["assets-dir"] ? path.resolve(opts["assets-dir"]) : null, opts["asset-prefix"] || "codex");
    const status = timedOut ? "timeout" : (cancelled || externallyCancelled) ? "cancelled" : code === 0 && !errors.length ? "ok" : "failed";
    const summary = {
      runId: run.id, kind, agent: backend.agent, status, exitCode: code, threadId,
      durationSec: Math.round((Date.now() - started) / 1000),
      usage, errors, assets,
      lastMessagePath: fs.existsSync(lastPath) ? lastPath : null,
      runDir: run.dir,
      lastMessage,
    };
    if (status !== "ok") {
      const tail = fs.readFileSync(path.join(run.dir, "stderr.log"), "utf8").split(/\r?\n/).filter(Boolean).slice(-15).join("\n");
      if (!lastMessage) summary.stderrTail = tail;
      // Lets the caller fall back to the next agent instead of retrying an exhausted one.
      summary.quotaExhausted = QUOTA_RE.test([...errors, tail].join("\n"));
    }
    writeStatus(run, { ...summary, lastMessage: undefined, finishedAt: new Date().toISOString() });
    try { fs.unlinkSync(path.join(run.dir, "pid")); } catch {}
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
    process.exit(status === "ok" ? 0 : 1);
  });
}

function guardRecursion() {
  if (process.env[DEPTH_VAR]) fail("codex-bridge was called from inside a Codex run. Recursive delegation is not allowed.");
}

function agentOf(opts) {
  const agent = opts.agent || "codex";
  if (!AGENTS[agent]) fail(`--agent must be one of: ${Object.keys(AGENTS).join(", ")}`);
  if (agent !== "codex")
    for (const f of ["worktree", "assets-dir", "ephemeral", "allow-api-key"]) if (opts[f]) fail(`--${f} is Codex-only; it is not supported with --agent ${agent}.`);
  if (agent === "antigravity" && opts.images.length) fail("--image is not supported with --agent antigravity; reference image paths in the prompt instead.");
  return agent;
}

function cmdRun(opts) {
  guardRecursion();
  const agent = agentOf(opts);
  const exe = agent === "codex" ? resolveExe() : null;
  if (exe) requireSubscriptionAuth(exe, opts["allow-api-key"]);
  const cwd = path.resolve(opts.cd || process.cwd());
  if (!fs.existsSync(cwd)) fail(`Working directory does not exist: ${cwd}`);
  const task = readPrompt(opts).trim();
  if (!task) fail("No prompt. Pass --prompt, --prompt-file, positional text, or stdin.");
  const sandbox = opts.sandbox || "read-only";
  if (!["read-only", "workspace-write"].includes(sandbox)) fail("--sandbox must be read-only or workspace-write (danger-full-access is not exposed).");
  for (const img of opts.images) if (!fs.existsSync(img)) fail(`Image not found: ${img}`);
  const run = newRun(opts.kind || "exec", cwd);
  if (agent === "opencode") return runOpencode(opts.kind || "exec", task, run, opts, sandbox);
  if (agent === "antigravity") return runAntigravity(opts.kind || "exec", task, run, opts, sandbox);
  const prompt = contract("codex") + task;
  fs.writeFileSync(path.join(run.dir, "prompt.md"), prompt);
  // stdin stays closed (exec otherwise waits on it), so the prompt goes on the command line,
  // which Windows caps at ~32k chars.
  if (prompt.length > 30000) fail("Prompt too long for a command line (>30k chars). Put the detail in a file in the workspace and reference it.");
  const args = ["exec", "-C", cwd, "-s", sandbox];
  if (!isGitRepo(cwd)) args.push("--skip-git-repo-check");
  if (opts.worktree) args.push("--worktree");
  if (opts.model) args.push("-m", opts.model);
  if (opts.effort) args.push("-c", `model_reasoning_effort="${opts.effort}"`);
  if (opts.ephemeral) args.push("--ephemeral");
  for (const d of opts.addDirs) args.push("--add-dir", d);
  if (opts["assets-dir"]) {
    const a = path.resolve(opts["assets-dir"]);
    // Let Codex write into the assets folder even when it is outside the workspace.
    if (sandbox === "workspace-write" && !a.startsWith(cwd)) args.push("--add-dir", a);
  }
  for (const img of opts.images) args.push("-i", img);
  args.push("--", prompt);
  execute(opts.kind || "exec", codexBackend(args, run, exe), run, opts);
}

function reviewTarget(opts) {
  return opts.base ? `the changes on the current branch relative to \`${opts.base}\` (git diff ${opts.base}...HEAD)`
    : opts.commit ? `the changes introduced by commit ${opts.commit} (git show ${opts.commit})`
    : "the uncommitted changes: staged, unstaged and untracked files (git status, git diff HEAD, and read untracked files)";
}

function cmdReview(opts) {
  guardRecursion();
  const agent = agentOf(opts);
  const exe = agent === "codex" ? resolveExe() : null;
  if (exe) requireSubscriptionAuth(exe, opts["allow-api-key"]);
  const cwd = path.resolve(opts.cd || process.cwd());
  if (!isGitRepo(cwd)) fail(`Not a git repository: ${cwd}. Use \`run --kind review --sandbox read-only\` for non-git folders.`);
  const run = newRun("review", cwd);
  if (agent !== "codex") {
    // OpenCode and Antigravity have no review preset: state the target in the prompt and run read-only.
    const focus = readPrompt(opts).trim() || "Look for bugs, regressions, performance problems, unnecessary complexity and missing tests. List findings most severe first, with file:line.";
    return (agent === "opencode" ? runOpencode : runAntigravity)("review", `Review ${reviewTarget(opts)}. Review only; do not modify any file. ${focus}`, run, opts, "read-only");
  }
  const args = ["exec", "review", "-c", 'sandbox_mode="read-only"'];
  if (opts.model) args.push("-m", opts.model);
  const focus = readPrompt(opts).trim();
  if (!focus) {
    if (opts.base) args.push("--base", opts.base);
    else if (opts.commit) args.push("--commit", opts.commit);
    else args.push("--uncommitted");
  } else {
    // Codex rejects a custom prompt together with a preset target, so state the target in the prompt.
    const text = `${contract("codex")}Review ${reviewTarget(opts)}. Review only; do not modify any file. ${focus}`;
    fs.writeFileSync(path.join(run.dir, "prompt.md"), text);
    args.push("--", text);
  }
  execute("review", codexBackend(args, run, exe), run, opts);
}

function readStatus(id) {
  return JSON.parse(fs.readFileSync(path.join(RUNS, id, "status.json"), "utf8"));
}

function listRuns() {
  if (!fs.existsSync(RUNS)) return [];
  return fs.readdirSync(RUNS).sort().reverse();
}

function cmdCancel(opts) {
  const id = opts.last ? listRuns().find(r => { try { return readStatus(r).status === "running"; } catch { return false; } }) : opts._[0];
  if (!id) fail("No run id given and no running job found.");
  const dir = path.join(RUNS, id);
  const pidFile = path.join(dir, "pid");
  if (!fs.existsSync(pidFile)) fail(`Run ${id} is not running.`, 1);
  const pid = Number(fs.readFileSync(pidFile, "utf8"));
  fs.writeFileSync(path.join(dir, "cancelled"), new Date().toISOString());
  killTree(pid);
  process.stdout.write(JSON.stringify({ runId: id, status: alive(pid) ? "kill-sent" : "cancelled", pid }, null, 2) + "\n");
}

function cmdList(opts) {
  const n = Number(opts.limit || 10);
  const rows = listRuns().slice(0, n).map(id => {
    try {
      const s = readStatus(id);
      if (s.status === "running" && s.pid && !alive(s.pid)) s.status = "dead";
      return { runId: id, kind: s.kind, agent: s.agent || "codex", status: s.status, durationSec: s.durationSec ?? null, cwd: s.cwd, assets: (s.assets || []).length };
    } catch { return { runId: id, status: "unknown" }; }
  });
  process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
}

function cmdDoctor(opts) {
  if (opts.agent === "antigravity") {
    const exe = resolveAgy();
    const out = (args, timeout) => {
      const [cmd, a] = opencodeCommand(exe, args);
      const r = spawnSync(cmd, a, { encoding: "utf8", windowsHide: true, env: agyEnv(), timeout });
      return { ok: r.status === 0, text: (r.stdout || "").trim() };
    };
    const models = out(["models"], 60000);
    process.stdout.write(JSON.stringify({
      exe, version: out(["--version"]).text, auth: models.ok ? "signed-in" : "unknown (agy models failed)",
      models: models.ok ? models.text.split(/\r?\n/).filter(l => l.includes("\t")).map(l => l.split("\t")[0]) : [],
      sandbox: "always --sandbox; read-only also denies write_file", runsDir: RUNS,
    }, null, 2) + "\n");
    return;
  }
  if (opts.agent === "opencode") {
    const exe = resolveOpencode();
    const [cmd, args] = opencodeCommand(exe, ["--version"]);
    process.stdout.write(JSON.stringify({
      exe, version: (spawnSync(cmd, args, { encoding: "utf8", windowsHide: true }).stdout || "").trim(), auth: opencodeAuth(exe),
      allowedModels: `${OPENCODE_PROVIDER}*`, defaultModel: OPENCODE_DEFAULT_MODEL, runsDir: RUNS,
    }, null, 2) + "\n");
    return;
  }
  const exe = resolveExe();
  const version = spawnSync(exe, ["--version"], { encoding: "utf8" }).stdout.trim();
  const features = spawnSync(exe, ["features", "list"], { encoding: "utf8" }).stdout || "";
  const flag = name => (features.match(new RegExp(`^${name}\\s+\\S+(?:\\s\\S+)?\\s+(true|false)`, "m")) || [])[1] ?? "unknown";
  process.stdout.write(JSON.stringify({
    exe, version, auth: authMode(exe),
    features: { image_generation: flag("image_generation"), hooks: flag("hooks") },
    mcpServerMode: /\bmcp-server\b/.test(spawnSync(exe, ["--help"], { encoding: "utf8" }).stdout || "") ? "available" : "not in this build",
    runsDir: RUNS, generatedImagesDir: GENERATED,
    apiKeyEnvPresent: Boolean(process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY),
  }, null, 2) + "\n");
}

function cmdRaw(argv) {
  const exe = resolveExe();
  const r = spawnSync(exe, argv, { stdio: "inherit" });
  process.exit(r.status ?? 1);
}

const [sub, ...rest] = process.argv.slice(2);
switch (sub) {
  case "run": cmdRun(parseArgs(rest)); break;
  case "review": cmdReview(parseArgs(rest)); break;
  case "cancel": cmdCancel(parseArgs(rest)); break;
  case "list": cmdList(parseArgs(rest)); break;
  case "doctor": cmdDoctor(parseArgs(rest)); break;
  case "raw": cmdRaw(rest); break;
  default:
    process.stdout.write(`usage: codex-bridge <run|review|cancel|list|doctor|raw> [options]
  run     [--agent codex|opencode|antigravity] --cd DIR [--sandbox read-only|workspace-write] [--timeout SEC=900] [--prompt TEXT | --prompt-file F | stdin]
          [--image F]... [--assets-dir DIR] [--asset-prefix NAME] [--worktree] [--add-dir DIR]... [--model M] [--effort low|medium|high|xhigh] [--kind LABEL]
  review  [--agent codex|opencode|antigravity] --cd REPO [--base BRANCH | --commit SHA | (default) uncommitted] [--prompt FOCUS] [--timeout SEC]
          opencode: --model must start with opencode-go/ (default opencode-go/kimi-k3); --effort becomes the model variant;
          --worktree, --assets-dir and --ephemeral are Codex-only; read-only denies edits and all but read-only shell commands.
          antigravity: signed-in Google account, API keys stripped; always --sandbox (commands cannot write the workspace,
          file tools can in workspace-write); read-only denies write_file; no --image. Failed runs report quotaExhausted.
  cancel  RUN_ID | --last
  list    [--limit N]
  doctor  [--agent opencode|antigravity]
  raw     ARGS...   (pass-through to codex.exe; this is what the \`codex\` shim runs)
`);
    process.exit(sub ? 2 : 0);
}
