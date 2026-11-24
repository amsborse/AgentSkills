// Logs a finished Claude task to a calendar when the turn stops. Opt-in twice: nothing is logged
// unless a config file names the logger command AND Claude gave the task a title for this plan.
// The title is never taken from the prompt; the duration comes from the eta.js plan timer.
//   node ~/.claude/scripts/claude-task-log.js title "<short title>" [--kind fix|feature|review|ops|research|other]
//   node ~/.claude/scripts/claude-task-log.js hook-stop        settings.json Stop hook (session from stdin)
//   node ~/.claude/scripts/claude-task-log.js status           show the config and the last failure
// Config (CLAUDE_CONFIG_DIR or ~/.claude)/claude-task-log.json:
//   { "command": ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "<Log-ClaudeTask.ps1>"],
//     "exe": "<optional Sutra.Desktop.exe>", "timeoutSeconds": 240, "notify": true }
// The logger gets -Title -Minutes -Kind -RequestId [-Exe]; the request id is <session>-<plan start>, so a
// retried log writes the same calendar event. Every outcome is appended to cache/eta/task-log.log; a failure
// also shows one Windows toast, repeated only when the failure text changes or after a success.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const KINDS = ["fix", "feature", "review", "ops", "research", "other"];
const home = () => process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
const etaDir = () => path.join(home(), "cache", "eta");
const clean = (s) => String(s).replace(/[^\w-]/g, "");
const taskFile = (session) => path.join(etaDir(), `${clean(session)}.task.json`);
const planFile = (session) => path.join(etaDir(), `${clean(session)}.json`);
const statusFile = () => path.join(etaDir(), "task-log-status.json");
const logFile = () => path.join(etaDir(), "task-log.log");

const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; } };
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value));
  fs.renameSync(tmp, file);
}
function log(line) {
  fs.mkdirSync(etaDir(), { recursive: true });
  fs.appendFileSync(logFile(), `${new Date().toISOString()} ${line}\n`);
}

// Pure: what the Stop hook should do for this session's plan and title.
function decide(plan, task, config, now) {
  if (!config || !Array.isArray(config.command) || !config.command.length) return { action: "off" };
  if (!task || !task.title) return { action: "skip", reason: "no title set for this task" };
  if (!plan || !plan.started) return { action: "skip", reason: "no eta plan, so no duration", keepTitle: true };
  if (task.loggedFor === plan.started) return { action: "skip", reason: "already logged for this plan" };
  const raw = Math.round((now - plan.started) / 60000);
  const minutes = Math.min(1440, Math.max(1, raw));
  return { action: "log", minutes, clamped: minutes !== raw ? raw : null, started: plan.started };
}

function loggerArgs(config, job) {
  const args = [...config.command.slice(1), "-Title", job.title, "-Minutes", String(job.minutes), "-Kind", job.kind, "-RequestId", job.requestId];
  if (config.exe) args.push("-Exe", config.exe);
  return args;
}

function toast(config, message) {
  if (config.notify === false) return;
  if (Array.isArray(config.notifyCommand)) {
    spawnSync(config.notifyCommand[0], [...config.notifyCommand.slice(1), message], { windowsHide: true });
    return;
  }
  if (process.platform !== "win32") return;
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "''");
  const ps = `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null
$x = New-Object Windows.Data.Xml.Dom.XmlDocument
$x.LoadXml('<toast scenario="reminder"><visual><binding template="ToastGeneric"><text>Claude calendar: task not logged</text><text>${esc(message)}</text></binding></visual><actions><action content="Dismiss" arguments="dismiss" activationType="system"/></actions></toast>')
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe').Show([Windows.UI.Notifications.ToastNotification]::new($x))`;
  spawnSync("powershell", ["-NoProfile", "-EncodedCommand", Buffer.from(ps, "utf16le").toString("base64")], { windowsHide: true });
}

// Runs the logger once and records the outcome. Called by the detached worker, or inline in tests.
function runJob(job) {
  const config = readJson(path.join(home(), "claude-task-log.json"));
  if (!config) { log(`fail ${job.requestId}: config disappeared`); return false; }
  const result = spawnSync(config.command[0], loggerArgs(config, job), {
    encoding: "utf8", windowsHide: true, timeout: (config.timeoutSeconds || 240) * 1000,
  });
  const status = readJson(statusFile()) || {};
  if (result.status === 0) {
    log(`ok ${job.requestId}: ${job.minutes} min, ${job.kind}, "${job.title}"`);
    writeJson(statusFile(), { lastFailure: null, lastSuccess: Date.now() });
    return true;
  }
  const output = `${result.stderr || ""}\n${result.stdout || ""}`.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const why = result.error ? result.error.message : (output[output.length - 1] || `exit ${result.status}`);
  const message = why.slice(0, 200);
  log(`fail ${job.requestId}: ${message}`);
  if (status.lastFailure !== message) toast(config, message);
  writeJson(statusFile(), { ...status, lastFailure: message, lastFailureAt: Date.now() });
  return false;
}

function hookStop(input, now = Date.now()) {
  if (!input || !input.session_id || input.agent_id) return null;
  const config = readJson(path.join(home(), "claude-task-log.json"));
  const task = readJson(taskFile(input.session_id));
  const plan = readJson(planFile(input.session_id));
  const d = decide(plan, task, config, now);
  if (d.action === "off") return d;
  if (d.action === "skip") {
    if (task && task.title) log(`skip ${clean(input.session_id)}: ${d.reason}`);
    return d;
  }
  // Consume the title before starting the worker, so a second Stop on the same plan cannot log twice
  // and a later plan never reuses this title.
  writeJson(taskFile(input.session_id), { loggedFor: d.started });
  if (d.clamped !== null) log(`note ${clean(input.session_id)}: ${d.clamped} min clamped to ${d.minutes}`);
  const job = { title: task.title, kind: task.kind || "other", minutes: d.minutes, requestId: `${clean(input.session_id)}-${d.started}` };
  if (process.env.CLAUDE_TASK_LOG_SYNC === "1") { runJob(job); return { ...d, job }; }
  const child = spawn(process.execPath, [__filename, "worker", JSON.stringify(job)], { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
  return { ...d, job };
}

function setTitle(session, args) {
  const kindAt = args.indexOf("--kind");
  let kind = "other";
  if (kindAt >= 0) {
    kind = String(args[kindAt + 1] || "").toLowerCase();
    if (!KINDS.includes(kind)) throw new Error(`--kind must be one of ${KINDS.join(", ")}`);
    args = args.filter((_, i) => i !== kindAt && i !== kindAt + 1);
  }
  const title = args.join(" ").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!title) throw new Error('usage: claude-task-log.js title "<short title>" [--kind fix]');
  const previous = readJson(taskFile(session)) || {};
  writeJson(taskFile(session), { ...previous, title, kind });
  return { title, kind };
}

module.exports = { decide, loggerArgs, hookStop, runJob, setTitle, KINDS };

if (require.main === module) {
  const [cmd, ...args] = process.argv.slice(2);
  try {
    if (cmd === "hook-stop") {
      let input = null;
      try { input = JSON.parse(fs.readFileSync(0, "utf8")); } catch (e) { console.error(`claude-task-log hook: bad input: ${e.message}`); }
      hookStop(input);
    } else if (cmd === "worker") {
      process.exit(runJob(JSON.parse(args[0])) ? 0 : 1);
    } else if (cmd === "title") {
      const session = process.env.CLAUDE_CODE_SESSION_ID;
      if (!session) throw new Error("CLAUDE_CODE_SESSION_ID is not set; run this from a Claude Code tool command");
      const t = setTitle(session, args);
      console.log(`claude-task-log: "${t.title}" (${t.kind}) will be logged when this task stops`);
    } else if (cmd === "status") {
      const config = readJson(path.join(home(), "claude-task-log.json"));
      const status = readJson(statusFile()) || {};
      console.log(config ? `on: ${config.command.join(" ")}` : "off: no claude-task-log.json");
      console.log(status.lastFailure ? `last failure: ${status.lastFailure}` : "no failure since the last success");
    } else {
      throw new Error("usage: claude-task-log.js title <text> [--kind k] | hook-stop | status");
    }
  } catch (e) {
    // A broken Stop hook must not block Claude, but it must not be silent either.
    console.error(`claude-task-log: ${e.message}`);
    try { log(`error: ${e.message}`); } catch {}
    process.exit(cmd === "hook-stop" ? 0 : 1);
  }
}
