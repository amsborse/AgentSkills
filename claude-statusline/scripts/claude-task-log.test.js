// Tests for claude-task-log.js with a fake logger; never runs the desktop app or touches a calendar.
// Run: node --test ~/.claude/scripts/claude-task-log.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const script = path.join(__dirname, "claude-task-log.js");

function sandbox({ exitCode = 0, message = "", config = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "task-log-"));
  const calls = path.join(root, "calls.jsonl");
  const toasts = path.join(root, "toasts.txt");
  const fake = path.join(root, "fake-logger.js");
  fs.writeFileSync(fake, `require("fs").appendFileSync(${JSON.stringify(calls)}, JSON.stringify(process.argv.slice(2)) + "\\n");
if (${JSON.stringify(message)}) console.error(${JSON.stringify(message)});
process.exit(${exitCode});`);
  const notify = path.join(root, "fake-toast.js");
  fs.writeFileSync(notify, `require("fs").appendFileSync(${JSON.stringify(toasts)}, process.argv[2] + "\\n");`);
  if (config) fs.writeFileSync(path.join(root, "claude-task-log.json"), JSON.stringify({ command: [process.execPath, fake], notifyCommand: [process.execPath, notify] }));
  const env = { ...process.env, CLAUDE_CONFIG_DIR: root, CLAUDE_TASK_LOG_SYNC: "1", CLAUDE_CODE_SESSION_ID: "s1" };
  const run = (args, input) => spawnSync(process.execPath, [script, ...args], { env, input, encoding: "utf8" });
  const lines = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean) : []);
  const plan = (startedMinutesAgo) => {
    fs.mkdirSync(path.join(root, "cache", "eta"), { recursive: true });
    fs.writeFileSync(path.join(root, "cache", "eta", "s1.json"), JSON.stringify({ started: Date.now() - startedMinutesAgo * 60000, steps: 3, done: 1, finished: null }));
  };
  return {
    root, run, plan,
    stop: (extra = {}) => run(["hook-stop"], JSON.stringify({ session_id: "s1", ...extra })),
    calls: () => lines(calls).map((l) => JSON.parse(l)),
    toasts: () => lines(toasts),
    log: () => lines(path.join(root, "cache", "eta", "task-log.log")).join("\n"),
  };
}
const arg = (call, name) => call[call.indexOf(name) + 1];

test("logs the title with the plan's elapsed minutes, kind and a stable request id", () => {
  const s = sandbox();
  s.plan(25);
  assert.strictEqual(s.run(["title", "Fix", "the", "week", "panel", "--kind", "fix"]).status, 0);
  s.stop();
  const [call] = s.calls();
  assert.strictEqual(arg(call, "-Title"), "Fix the week panel");
  assert.strictEqual(arg(call, "-Minutes"), "25");
  assert.strictEqual(arg(call, "-Kind"), "fix");
  assert.match(arg(call, "-RequestId"), /^s1-\d+$/);
  assert.match(s.log(), /ok s1-\d+: 25 min, fix/);
});

test("a second Stop on the same plan does not log again, even if a title is set again", () => {
  const s = sandbox();
  s.plan(5);
  s.run(["title", "Task"]);
  s.stop();
  s.stop();
  s.run(["title", "Task again"]);
  s.stop();
  assert.strictEqual(s.calls().length, 1);
});

test("nothing is logged without a title, and the prompt is never used as one", () => {
  const s = sandbox();
  s.plan(5);
  s.stop({ prompt: "secret prompt text", last_assistant_message: "x" });
  assert.strictEqual(s.calls().length, 0);
});

test("nothing is logged without a config, so the feature is off by default", () => {
  const s = sandbox({ config: false });
  s.plan(5);
  s.run(["title", "Task"]);
  s.stop();
  assert.strictEqual(s.calls().length, 0);
  assert.match(s.run(["status"]).stdout, /^off/);
});

test("subagent stops are ignored", () => {
  const s = sandbox();
  s.plan(5);
  s.run(["title", "Task"]);
  s.stop({ agent_id: "a1" });
  assert.strictEqual(s.calls().length, 0);
});

test("a title without a plan waits for a plan instead of guessing a duration", () => {
  const s = sandbox();
  s.run(["title", "Task"]);
  s.stop();
  assert.strictEqual(s.calls().length, 0);
  assert.match(s.log(), /skip s1: no eta plan/);
  s.plan(3);
  s.stop();
  assert.strictEqual(s.calls().length, 1);
});

test("durations are clamped to the 1..1440 minutes the calendar accepts, and the clamp is logged", () => {
  const s = sandbox();
  s.plan(0);
  s.run(["title", "Quick"]);
  s.stop();
  assert.strictEqual(arg(s.calls()[0], "-Minutes"), "1");
  assert.match(s.log(), /0 min clamped to 1/);
});

test("a failure is logged every time but toasts once until the text changes or a success clears it", () => {
  const s = sandbox({ exitCode: 1, message: "The Claude calendar needs permission." });
  for (let i = 0; i < 2; i++) {
    s.plan(5 + i); // a new plan each round, as after each new prompt
    s.run(["title", `Task ${i}`]);
    s.stop();
  }
  assert.strictEqual(s.calls().length, 2);
  assert.deepStrictEqual(s.toasts(), ["The Claude calendar needs permission."]);
  assert.strictEqual((s.log().match(/fail s1-/g) || []).length, 2);
  assert.match(s.run(["status"]).stdout, /last failure: The Claude calendar needs permission/);
});

test("unknown kinds are rejected when the title is set", () => {
  const s = sandbox();
  const r = s.run(["title", "Task", "--kind", "bugfix"]);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /--kind must be one of/);
});

test("a broken Stop payload never blocks Claude", () => {
  const s = sandbox();
  const r = s.run(["hook-stop"], "not json");
  assert.strictEqual(r.status, 0);
  assert.match(r.stderr, /bad input/);
});
