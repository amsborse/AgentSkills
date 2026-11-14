// Claude Code status line.
// Line 1: session color badge, folder, git branch, model, context usage bar and cost.
// Line 1 also shows how many files are uncommitted, and the context % turns amber at 50% and red at 80%.
// Line 2: time on the current task (with Claude's own estimate of time left, recorded through
//         scripts/eta.js), this session's background processes with the RAM each one uses (its whole process tree),
//         this session's total RAM, and the combined count and RAM of all Claude Code sessions.
// Line 3: plan usage (5-hour and weekly limits with time until reset), session cost and cost per
//         hour, and free RAM on the machine. Usage turns amber at 50% and red at 80%; RAM turns
//         amber under 20% free and red under 10%.
// All lines are fitted to the width Claude Code passes in COLUMNS: when the window is narrow the
// folder, branch, model and bar shrink or drop first; the process metrics always stay visible.
// The badge color comes from CLAUDE_SESSION_ACCENT, set per session by the `claude` wrapper in
// claude-colors.ps1. Process data comes from scripts/statusline-procs.ps1, refreshed in the background.
const { execSync, spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
const PROC_CACHE = path.join(CONFIG_DIR, "cache", "statusline-procs.json");
const PROC_SCRIPT = path.join(CONFIG_DIR, "scripts", "statusline-procs.ps1");
const REFRESH_MS = 4000; // start a new snapshot when the cached one is older than this
const STALE_MS = 30000; // mark numbers as stale past this age
const SHELLS = new Set(["bash.exe", "sh.exe", "cmd.exe", "powershell.exe", "pwsh.exe", "conhost.exe"]);
const RUNTIMES = new Set(["node.exe", "python.exe", "pythonw.exe", "bun.exe", "deno.exe", "uv.exe"]);

const esc = "\x1b[";
const reset = esc + "0m";
const dim = (s) => `${esc}2m${s}${reset}`;
const fgc = (c, s) => (c ? `${esc}38;2;${c}m${s}${reset}` : s);
const RED = "255;85;85";
const YELLOW = "255;200;60";
const visibleLength = (s) => [...s.replace(/\x1b\[[0-9;]*m/g, "")].length;

// Saves the plan's 5-hour and weekly limits for Sutra Desktop's AI Capacity page.
// Claude Code only passes rate_limits to the status line (Pro/Max), so this is the one place to read them.
function saveRateLimits(limits) {
  if (!limits || !(limits.five_hour || limits.seven_day)) return;
  try {
    const file = path.join(CONFIG_DIR, "sutra-rate-limits.json");
    const body = { captured_at: new Date().toISOString(), rate_limits: { five_hour: limits.five_hour, seven_day: limits.seven_day } };
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(body));
    fs.renameSync(tmp, file);
  } catch {}
}

function fmtBytes(b) {
  const mb = b / 1048576;
  if (mb < 1000) return `${Math.round(mb)}M`;
  const gb = mb / 1024;
  return `${gb < 10 ? gb.toFixed(1) : Math.round(gb)}G`;
}

function fmtDur(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}

// Pure: the time segment. eta is the scripts/eta.js state for this session (or null); turn is
// { started, idleSince } for the current prompt. Returns full and compact forms.
function timeSegment(eta, turn, now) {
  if (eta && eta.finished) {
    const t = fmtDur(eta.finished - eta.started);
    return { full: `✓ done in ${t}`, compact: `✓${t}` };
  }
  if (eta) {
    const elapsed = now - eta.started;
    let left;
    if (eta.done > 0) left = (elapsed / eta.done) * (eta.steps - eta.done); // real pace so far
    else left = eta.minutes * 60000 - (now - eta.planned_at);
    const leftTxt = left > 0 ? `~${fmtDur(left)} left` : "over estimate";
    const leftShort = left > 0 ? `~${fmtDur(left)}` : "over";
    return {
      full: `⏱ ${fmtDur(elapsed)} · ${eta.done}/${eta.steps} · ${leftTxt}`,
      compact: `⏱${fmtDur(elapsed)} ${eta.done}/${eta.steps} ${leftShort}`,
    };
  }
  if (turn) {
    const end = turn.idleSince || now;
    const t = fmtDur(end - turn.started);
    return turn.idleSince ? { full: `⏸ ${t}`, compact: `⏸${t}` } : { full: `⏱ ${t}`, compact: `⏱${t}` };
  }
  return null;
}

function childrenIndex(procs) {
  const kids = new Map();
  for (const p of procs) {
    if (!kids.has(p.pp)) kids.set(p.pp, []);
    kids.get(p.pp).push(p);
  }
  return kids;
}

function subtree(root, kids) {
  const out = [];
  const stack = [root];
  const seen = new Set();
  while (stack.length) {
    const p = stack.pop();
    if (seen.has(p.p)) continue; // guards against pid reuse loops
    seen.add(p.p);
    out.push(p);
    for (const k of kids.get(p.p) || []) if (k.p !== p.p) stack.push(k);
  }
  return out;
}

// A readable name for one process: the script a runtime is running, else the exe name.
function procName(p) {
  const exe = (p.n || "").toLowerCase();
  if (RUNTIMES.has(exe)) {
    const m = (p.c || "").match(/([^\\/"'\s]+)\.(m?js|cjs|ts|py)\b/i);
    if (m) return m[1];
  }
  return exe.replace(/\.exe$/, "");
}

// A background item is named after its heaviest non-shell process, so a bash task that runs
// `node validate.mjs` shows as "validate" rather than "bash".
function itemLabel(tree) {
  const real = tree.filter((p) => !SHELLS.has((p.n || "").toLowerCase()));
  if (!real.length) return procName(tree[0]);
  return procName(real.reduce((a, b) => (b.ws > a.ws ? b : a)));
}

const isOwnHelper = (p) => /statusline(-procs)?\.(js|ps1)/i.test(p.c || "");
const isCliSession = (p) =>
  (p.n || "").toLowerCase() === "claude.exe" && !/WindowsApps|--type=/i.test(p.c || "");

// Pure: turns a process snapshot into the numbers shown on line 2.
function computeMetrics(procs, claudePid) {
  const kids = childrenIndex(procs);
  const byPid = new Map(procs.map((p) => [p.p, p]));
  const sum = (list) => list.reduce((a, p) => a + (p.ws || 0), 0);

  let session = null;
  const root = byPid.get(claudePid);
  if (root) {
    const items = [];
    for (const child of kids.get(root.p) || []) {
      if ((child.n || "").toLowerCase() === "conhost.exe") continue;
      const tree = subtree(child, kids);
      if (tree.some(isOwnHelper)) continue; // the status line's own process chain
      items.push({ label: itemLabel(tree), ws: sum(tree), procs: tree.length });
    }
    items.sort((a, b) => b.ws - a.ws);
    session = { selfWs: root.ws || 0, items, total: (root.ws || 0) + items.reduce((a, i) => a + i.ws, 0) };
  }

  const roots = procs.filter(isCliSession).filter((p) => !isCliSession(byPid.get(p.pp) || {}));
  const all = {
    count: roots.length,
    total: roots.reduce((a, r) => a + sum(subtree(r, kids).filter((p) => !isOwnHelper(p))), 0),
  };
  return { session, all };
}

// Pure: renders line 2 to fit `width`, dropping per-process detail before the core numbers.
function renderMetrics(m, width, accent, note, time) {
  const sep = dim(" │ ");
  const flag = note ? " " + note : "";
  if (!m.session) {
    const core = `${dim("all")} ${m.all.count}× ${fmtBytes(m.all.total)}`;
    return (time ? time.full + sep : "") + dim("⚙ session not found") + sep + core + flag;
  }
  const s = m.session;
  const fits = (str) => visibleLength(str) <= width;
  const variants = [
    { bg: `⚙ ${s.items.length} bg`, me: `${dim("this")} ${fgc(accent, fmtBytes(s.total))}`, all: `${dim("all")} ${m.all.count}× ${fmtBytes(m.all.total)}`, sep },
    { bg: `⚙${s.items.length}`, me: fgc(accent, fmtBytes(s.total)), all: `Σ${m.all.count}:${fmtBytes(m.all.total)}`, sep: " " },
  ];
  for (const v of variants) v.t = time ? (v.sep === sep ? time.full : time.compact) + v.sep : "";
  for (const v of variants) {
    const core = v.t + v.bg + v.sep + v.me + v.sep + v.all + flag;
    if (!fits(core)) continue;
    // Add the heaviest background processes until the line is full; the rest become "+N".
    const shown = [];
    for (let i = 0; i < s.items.length; i++) {
      const next = [...shown, `${s.items[i].label} ${fmtBytes(s.items[i].ws)}`];
      const rest = s.items.length - next.length;
      const detail = next.join(dim(" · ")) + (rest ? dim(` +${rest}`) : "");
      if (!fits(v.t + v.bg + " " + detail + v.sep + v.me + v.sep + v.all + flag)) break;
      shown.push(next[next.length - 1]);
    }
    const rest = s.items.length - shown.length;
    const detail = shown.length ? " " + shown.join(dim(" · ")) + (rest ? dim(` +${rest}`) : "") : "";
    return v.t + v.bg + detail + v.sep + v.me + v.sep + v.all + flag;
  }
  // Narrower than even the compact form: keep the numbers, never hide them.
  return `${time ? time.compact + " " : ""}⚙${s.items.length} ${fmtBytes(s.total)} Σ${m.all.count}:${fmtBytes(m.all.total)}${flag}`;
}

// Pure: renders line 1 to fit `width`, shrinking the least important parts first.
function renderHeader(h, width, accent) {
  const sep = dim("  │  ");
  const badge = (name) => `${esc}48;2;${accent};38;2;18;20;24;1m ${name} ${reset}`;
  const bar = (n) => {
    const filled = Math.min(n, Math.round((h.pct / 100) * n));
    const color = h.pct >= 80 ? RED : h.pct >= 50 ? YELLOW : accent;
    const pct = h.pct >= 80 ? fgc(RED, `⚠ ${h.pct}%`) : h.pct >= 50 ? fgc(YELLOW, `${h.pct}%`) : `${h.pct}%`;
    return (n ? fgc(color, "█".repeat(filled)) + dim("░".repeat(n - filled)) + " " : "") + pct;
  };
  // Uncommitted files: "· 23 changed" when there is room, "±23" when tight; "±?" if git failed.
  const dirty = (long, lead = " ") =>
    h.dirty == null ? fgc(YELLOW, `${lead}±?`) : h.dirty > 0 ? fgc(YELLOW, long ? `${lead}· ${h.dirty} changed` : `${lead}±${h.dirty}`) : "";
  const cut = (s, n) => ([...s].length > n ? [...s].slice(0, Math.max(1, n - 1)).join("") + "…" : s);
  const build = (o) =>
    [
      badge(o.short ? h.name.slice(0, 1).toUpperCase() : h.name.toUpperCase()),
      fgc(accent, cut(h.folder, o.folder)),
      o.branch && h.branch && dim("⎇ ") + cut(h.branch, o.branch) + dirty(o.branch >= 16),
      !o.branch && h.branch && dirty(false, ""),
      o.model && h.model,
      bar(o.bar),
    ].filter(Boolean).join(o.tight ? " " : sep);
  const steps = [
    { folder: 40, branch: 30, model: true, bar: 10 },
    { folder: 24, branch: 16, model: true, bar: 5 },
    { folder: 20, branch: 12, model: false, bar: 5 },
    { folder: 16, branch: 0, model: false, bar: 0 },
    { folder: 12, branch: 0, model: false, bar: 0, tight: true },
    { folder: 8, branch: 0, model: false, bar: 0, tight: true, short: true },
  ];
  for (const o of steps) {
    const line = build(o);
    if (visibleLength(line) <= width) return line;
  }
  return build(steps[steps.length - 1]);
}

// "1h20" until a reset; days once it is a day or more away.
function fmtUntil(ms) {
  if (!(ms > 0)) return "now";
  const h = Math.floor(ms / 3600000);
  return h >= 24 ? `${Math.floor(h / 24)}d${h % 24 ? (h % 24) + "h" : ""}` : fmtDur(ms);
}
const levelColor = (pct, amber, red) => (pct >= red ? RED : pct >= amber ? YELLOW : null);

// Pure: line 3. u = { five, week: { pct, resetsAt (ms) } | null, cost, perHour (USD or null), freeB, totalB }.
// To fit, drops the weekly reset time, then cost per hour, then the weekly limit and cost;
// the 5-hour limit and free RAM always stay.
function renderUsage(u, width, now) {
  const lim = (label, l, withReset) => {
    if (!l) return null;
    const pct = fgc(levelColor(l.pct, 50, 80), `${Math.round(l.pct)}%`);
    return `${dim(label)} ${pct}` + (withReset && l.resetsAt ? dim(` ↻ ${fmtUntil(l.resetsAt - now)}`) : "");
  };
  const usedRam = u.totalB ? (1 - u.freeB / u.totalB) * 100 : 0;
  const ram = (label) => `${dim(label)} ${fgc(levelColor(usedRam, 80, 90), fmtBytes(u.freeB))}` + (label === "RAM" ? dim(" free") : "");
  const money = (rate) =>
    u.cost == null ? null : `$${u.cost.toFixed(2)}` + (rate && u.perHour != null ? dim(` · $${u.perHour.toFixed(2)}/h`) : "");
  const variants = [
    [lim("5h", u.five, true), lim("week", u.week, true), money(true), ram("RAM")],
    [lim("5h", u.five, true), lim("week", u.week, false), money(true), ram("RAM")],
    [lim("5h", u.five, true), lim("week", u.week, false), money(false), ram("RAM")],
    [lim("5h", u.five, false), lim("wk", u.week, false), money(false), ram("free")],
    [lim("5h", u.five, false), money(false), ram("free")],
    [lim("5h", u.five, false), ram("free")],
  ];
  for (const [i, parts] of variants.entries()) {
    const line = parts.filter(Boolean).join(i < 3 ? dim(" │ ") : " ");
    if (visibleLength(line) <= width) return line;
  }
  return variants[variants.length - 1].filter(Boolean).join(" ");
}

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
const safeId = (id) => String(id || "").replace(/[^\w-]/g, "");

// The current turn starts when the status line first sees a new prompt_id. The turn counts as idle
// once the transcript has not been written for two minutes.
function readTurn(d, now) {
  const id = safeId(d.session_id);
  if (!id || !d.prompt_id) return null;
  const file = path.join(CONFIG_DIR, "cache", "turn", `${id}.json`);
  let turn = readJson(file);
  if (!turn || turn.prompt_id !== d.prompt_id) {
    turn = { prompt_id: d.prompt_id, started: now };
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(turn));
    } catch {}
  }
  let idleSince = null;
  try {
    const mtime = fs.statSync(d.transcript_path).mtimeMs;
    if (now - mtime > 120000 && mtime > turn.started) idleSince = mtime;
  } catch {}
  return { started: turn.started, idleSince };
}

// Claude's plan from scripts/eta.js; unfinished plans untouched for 2 hours and finished ones
// older than 10 minutes are ignored.
function readEta(d, now) {
  const eta = readJson(path.join(CONFIG_DIR, "cache", "eta", `${safeId(d.session_id)}.json`));
  if (!eta || !(eta.steps > 0)) return null;
  if (eta.finished ? now - eta.finished > 600000 : now - eta.updated > 7200000) return null;
  return eta;
}

function readSnapshot() {
  let snap = null;
  try { snap = JSON.parse(fs.readFileSync(PROC_CACHE, "utf8")); } catch {}
  let error = null;
  try { error = fs.readFileSync(PROC_CACHE + ".err", "utf8").trim(); } catch {}
  return { snap, error };
}

// Starts a background snapshot when the cache is old; a lock file keeps redraws from piling up.
function refreshSnapshot(snap) {
  if (snap && Date.now() - snap.at < REFRESH_MS) return;
  const lock = PROC_CACHE + ".lock";
  try {
    if (Date.now() - fs.statSync(lock).mtimeMs < 15000) return;
  } catch {}
  try {
    fs.mkdirSync(path.dirname(PROC_CACHE), { recursive: true });
    fs.writeFileSync(lock, String(process.pid));
    // Two hops on purpose: Node kills attached children when it exits (Windows job object), and
    // Windows PowerShell started detached has no console and silently does nothing. So a detached
    // Node starts PowerShell normally and waits for it.
    const ps = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", PROC_SCRIPT, "-Out", PROC_CACHE];
    const inner = `const r=require("child_process").spawnSync("powershell.exe",${JSON.stringify(ps)},{windowsHide:true,stdio:"ignore"});` +
      `if(r.error||r.status)require("fs").writeFileSync(${JSON.stringify(PROC_CACHE + ".err")},"collector exit "+(r.error?r.error.message:r.status))`;
    spawn(process.execPath, ["-e", inner], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  } catch (e) {
    try { fs.writeFileSync(PROC_CACHE + ".err", `spawn failed: ${e.message}`); } catch {}
  }
}

function main(raw) {
  let d = {};
  try { d = JSON.parse(raw); } catch {}
  saveRateLimits(d.rate_limits);

  const rgb = (hex) => {
    const h = (hex || "").replace("#", "");
    return h.length === 6 ? [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(";") : null;
  };
  const accent = rgb(process.env.CLAUDE_SESSION_ACCENT) || "180;180;190";
  const dir = (d.workspace && d.workspace.current_dir) || d.cwd || process.cwd();
  const cols = parseInt(process.env.COLUMNS, 10);
  const width = Number.isFinite(cols) && cols > 0 ? cols : 120;

  let branch = "";
  let dirty = 0;
  try {
    branch = execSync("git branch --show-current", { cwd: dir, timeout: 800, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {}
  if (branch) {
    try {
      const out = execSync("git status --porcelain", { cwd: dir, timeout: 800, stdio: ["ignore", "pipe", "ignore"] }).toString();
      dirty = out.split("\n").filter(Boolean).length;
    } catch {
      dirty = null; // timed out or failed: shown as "±?", never as clean
    }
  }

  const header = renderHeader({
    name: process.env.CLAUDE_SESSION_COLOR || "Claude",
    folder: path.basename(dir),
    branch,
    dirty,
    model: d.model && d.model.display_name,
    pct: Math.round((d.context_window && d.context_window.used_percentage) || 0),
  }, width, accent);

  const now = Date.now();
  const time = timeSegment(readEta(d, now), readTurn(d, now), now);
  const { snap, error } = readSnapshot();
  refreshSnapshot(snap);
  let metrics;
  if (error) {
    metrics = (time ? time.full + " " : "") + fgc(RED, `⚙ process stats failed: ${error.slice(0, Math.max(10, width - 26))}`);
  } else if (!snap || !Array.isArray(snap.procs)) {
    metrics = (time ? time.full + " " : "") + dim("⚙ reading processes…");
  } else {
    const stale = Date.now() - snap.at > STALE_MS ? fgc(YELLOW, "(stale)") : "";
    metrics = renderMetrics(computeMetrics(snap.procs, parseInt(process.env.CLAUDE_PID, 10)), width, accent, stale, time);
  }
  const rl = d.rate_limits || {};
  const limit = (l) => (l && typeof l.used_percentage === "number" ? { pct: l.used_percentage, resetsAt: l.resets_at ? l.resets_at * 1000 : null } : null);
  const cost = d.cost && typeof d.cost.total_cost_usd === "number" ? d.cost.total_cost_usd : null;
  const hours = d.cost && d.cost.total_duration_ms ? d.cost.total_duration_ms / 3600000 : 0;
  const usage = renderUsage({
    five: limit(rl.five_hour),
    week: limit(rl.seven_day),
    cost,
    perHour: cost != null && hours >= 0.1 ? cost / hours : null, // under 6 minutes the rate is noise
    freeB: os.freemem(),
    totalB: os.totalmem(),
  }, width, now);
  process.stdout.write(header + "\n" + metrics + "\n" + usage);
}

if (require.main === module) {
  let raw = "";
  process.stdin.on("data", (c) => (raw += c));
  process.stdin.on("end", () => main(raw));
} else {
  module.exports = { renderUsage, fmtUntil, computeMetrics, renderMetrics, timeSegment, fmtDur, safeId, renderHeader, fmtBytes, visibleLength, itemLabel };
}
