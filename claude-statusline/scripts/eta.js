// Lets Claude record its own rough plan for the current task so the status line can show progress
// and an estimated time left. The estimate is Claude's guess, refined by the real pace once steps
// complete; statusline.js shows it with a "~".
//   node ~/.claude/scripts/eta.js plan <steps> <minutes> [note]   start or re-plan the current task
//   node ~/.claude/scripts/eta.js step [note]                     one more step finished
//   node ~/.claude/scripts/eta.js done                            task finished
//   node ~/.claude/scripts/eta.js hook-prompt | hook-stop         settings.json hooks (session from stdin):
//     a new prompt clears the last finished plan and reminds Claude to plan; Stop finishes an open plan.
// The session comes from CLAUDE_CODE_SESSION_ID, which Claude Code sets for every tool command.
const fs = require("fs");
const os = require("os");
const path = require("path");

const dir = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"), "cache", "eta");
const [cmd, ...args] = process.argv.slice(2);
const isHook = cmd === "hook-prompt" || cmd === "hook-stop";
let session = process.env.CLAUDE_CODE_SESSION_ID;
if (isHook) {
  // Hooks get the session on stdin. A broken hook must not block the prompt, but it must not be silent.
  try { session = JSON.parse(fs.readFileSync(0, "utf8")).session_id; }
  catch (e) { console.error(`eta hook: bad input: ${e.message}`); process.exit(0); }
}
const fail = (msg) => { console.error(`eta: ${msg}`); process.exit(1); };

if (!session) fail("CLAUDE_CODE_SESSION_ID is not set; run this from a Claude Code tool command");
const file = path.join(dir, `${session.replace(/[^\w-]/g, "")}.json`);
let state = null;
try { state = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
const now = Date.now();

if (cmd === "hook-prompt") {
  if (state && state.finished) fs.rmSync(file, { force: true });
  console.log("Status line ETA: for this task run `node ~/.claude/scripts/eta.js plan <steps> <minutes>` first (your honest rough guess), `eta.js step` after each step, and re-plan if scope changes. Skip only for a one-line answer.");
  process.exit(0);
} else if (cmd === "hook-stop") {
  if (!state || state.finished) process.exit(0);
  state.done = state.steps;
  state.finished = now;
} else if (cmd === "plan") {
  const steps = parseInt(args[0], 10);
  const minutes = parseFloat(args[1]);
  if (!(steps > 0) || !(minutes > 0)) fail("usage: eta.js plan <steps> <minutes> [note]");
  // Re-planning keeps finished steps and the original start, so elapsed time stays honest.
  const keep = state && !state.finished;
  state = {
    started: keep ? state.started : now,
    planned_at: now,
    steps,
    done: keep ? Math.min(state.done, steps) : 0,
    minutes,
    note: args.slice(2).join(" ") || (keep ? state.note : ""),
    finished: null,
  };
} else if (cmd === "step") {
  if (!state || state.finished) fail("no active plan; run `eta.js plan <steps> <minutes>` first");
  state.done = Math.min(state.steps, state.done + 1);
  if (args.length) state.note = args.join(" ");
} else if (cmd === "done") {
  if (!state) fail("no plan to finish");
  state.done = state.steps;
  state.finished = now;
} else {
  fail("usage: eta.js plan <steps> <minutes> [note] | step [note] | done");
}

state.updated = now;
fs.mkdirSync(dir, { recursive: true });
const tmp = `${file}.${process.pid}.tmp`;
fs.writeFileSync(tmp, JSON.stringify(state));
fs.renameSync(tmp, file);
console.log(`eta: ${state.done}/${state.steps} steps, plan ${state.minutes}m${state.finished ? ", finished" : ""}`);
