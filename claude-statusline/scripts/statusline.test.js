// Tests for statusline.js. Run: node --test ~/.claude/scripts/statusline.test.js
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const sl = require(path.join(__dirname, "..", "statusline.js"));

const MB = 1048576;
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
const P = (p, pp, n, mb, c = "") => ({ p, pp, n, ws: mb * MB, c });

// One session (100) with an MCP server, a bash task running node, the status line's own chain,
// and a second session (200); plus the desktop app, which is not a CLI session.
const procs = [
  P(100, 1, "claude.exe", 300, '"C:\\Users\\x\\.local\\bin\\claude.exe"'),
  P(110, 100, "node.exe", 60, "node C:/Users/x/.claude/scripts/serena-gate.mjs"),
  P(111, 110, "conhost.exe", 8),
  P(120, 100, "bash.exe", 6, "bash.exe -c ..."),
  P(121, 120, "bash.exe", 8),
  P(122, 121, "node.exe", 400, '"C:\\Program Files\\nodejs\\node.exe" scripts/validate.mjs'),
  P(130, 100, "cmd.exe", 5, "cmd /c node statusline.js"),
  P(131, 130, "node.exe", 40, "node C:/Users/x/.claude/statusline.js"),
  P(140, 100, "conhost.exe", 9),
  P(200, 1, "claude.exe", 250, '"C:\\Users\\x\\.local\\bin\\claude.exe"'),
  P(300, 1, "claude.exe", 160, '"C:\\Program Files\\WindowsApps\\Claude_5\\app\\claude.exe"'),
  P(301, 300, "claude.exe", 20, '"C:\\Program Files\\WindowsApps\\Claude_5\\app\\claude.exe" --type=renderer'),
];

test("groups background processes per session and skips the status line itself", () => {
  const m = sl.computeMetrics(procs, 100);
  assert.deepStrictEqual(m.session.items.map((i) => [i.label, Math.round(i.ws / MB)]), [["validate", 414], ["serena-gate", 68]]);
  assert.strictEqual(Math.round(m.session.total / MB), 300 + 414 + 68);
  assert.strictEqual(m.all.count, 2, "desktop app is not a CLI session");
  assert.strictEqual(Math.round(m.all.total / MB), 300 + 414 + 68 + 9 + 250);
});

test("unknown session pid still reports all sessions", () => {
  const m = sl.computeMetrics(procs, 999);
  assert.strictEqual(m.session, null);
  assert.strictEqual(m.all.count, 2);
});

test("metrics line never exceeds the width and never drops the core numbers", () => {
  const m = sl.computeMetrics(procs, 100);
  const time = sl.timeSegment({ started: 0, planned_at: 0, steps: 5, done: 2, minutes: 20 }, null, 6 * 60000);
  for (let w = 28; w <= 200; w++) {
    const line = strip(sl.renderMetrics(m, w, "1;2;3", "", time));
    assert.ok([...line].length <= w, `width ${w}: ${line}`);
    assert.match(line, /⚙ ?2/, `bg count at ${w}`);
    assert.match(line, /782M/, `session RAM at ${w}`);
    assert.match(line, /2[×:] ?1\.0G/, `all sessions at ${w}`);
    assert.match(line, /2\/5/, `progress at ${w}`);
  }
  assert.match(strip(sl.renderMetrics(m, 200, "1;2;3", "", time)), /validate 414M · serena-gate 68M/);
  assert.match(strip(sl.renderMetrics(m, 75, "1;2;3", "", time)), /\+1/);
});

test("header shrinks to fit narrow widths", () => {
  const h = { name: "Peach", folder: "TaskbarDashboard", branch: "feature/long-branch-name", model: "Opus 5.5", pct: 42, cost: "$1.20" };
  for (const w of [120, 80, 60, 40, 30]) {
    const line = strip(sl.renderHeader(h, w, "1;2;3"));
    assert.ok([...line].length <= w, `width ${w}: ${line}`);
    assert.match(line, /42%/);
  }
});

test("time segment: plan, pace, overrun, finished, idle", () => {
  const min = 60000;
  assert.strictEqual(sl.timeSegment({ started: 0, planned_at: 0, steps: 4, done: 0, minutes: 20 }, null, 5 * min).full, "⏱ 5m · 0/4 · ~15m left");
  assert.strictEqual(sl.timeSegment({ started: 0, planned_at: 0, steps: 4, done: 1, minutes: 20 }, null, 10 * min).full, "⏱ 10m · 1/4 · ~30m left");
  assert.strictEqual(sl.timeSegment({ started: 0, planned_at: 0, steps: 4, done: 0, minutes: 5 }, null, 9 * min).full, "⏱ 9m · 0/4 · over estimate");
  assert.strictEqual(sl.timeSegment({ started: 0, steps: 4, done: 4, finished: 75 * min }, null, 80 * min).full, "✓ done in 1h15");
  assert.strictEqual(sl.timeSegment(null, { started: 0, idleSince: 3 * min }, 9 * min).full, "⏸ 3m");
  assert.strictEqual(sl.timeSegment(null, { started: 0, idleSince: null }, 45000).full, "⏱ 45s");
  assert.strictEqual(sl.timeSegment(null, null, 0), null);
});

test("session ids used in cache file names keep their characters", () => {
  assert.strictEqual(sl.safeId("fdf63028-d67f-4f55-8f88-54ec59474166"), "fdf63028-d67f-4f55-8f88-54ec59474166");
  assert.strictEqual(sl.safeId("../evil\\x"), "evilx");
});

test("eta hooks: a new prompt clears a finished plan, Stop finishes an open one", () => {
  const { execFileSync } = require("child_process");
  const fs = require("fs");
  const os = require("os");
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), "eta-"));
  const eta = path.join(__dirname, "eta.js");
  const env = { ...process.env, CLAUDE_CONFIG_DIR: cfg, CLAUDE_CODE_SESSION_ID: "t-1" };
  const run = (...a) => execFileSync("node", [eta, ...a], { env, input: JSON.stringify({ session_id: "t-1" }), encoding: "utf8" });
  const file = path.join(cfg, "cache", "eta", "t-1.json");
  run("plan", "3", "10");
  run("hook-stop");
  const s = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.ok(s.finished && s.done === 3);
  assert.match(run("hook-prompt"), /eta\.js plan/);
  assert.ok(!fs.existsSync(file), "finished plan cleared on new prompt");
  run("hook-stop"); // no plan: no error, no file
  assert.ok(!fs.existsSync(file));
  fs.rmSync(cfg, { recursive: true, force: true });
});

test("usage line: limits, resets, cost rate and free RAM fit every width", () => {
  const H = 3600000, GB = 1073741824;
  const u = { five: { pct: 26, resetsAt: 80 * 60000 }, week: { pct: 85, resetsAt: 3 * 24 * H + 4 * H }, cost: 0.98, perHour: 2.1, freeB: 2 * GB, totalB: 32 * GB };
  assert.strictEqual(strip(sl.renderUsage(u, 200, 0)), "5h 26% ↻ 1h20 │ week 85% ↻ 3d4h │ $0.98 · $2.10/h │ RAM 2.0G free");
  for (let w = 20; w <= 200; w++) {
    const line = strip(sl.renderUsage(u, w, 0));
    assert.ok([...line].length <= w || w < 22, `width ${w}: ${line}`);
    assert.match(line, /5h ?26%/, `5h at ${w}`);
    assert.match(line, /2\.0G/, `RAM at ${w}`);
  }
  assert.match(sl.renderUsage(u, 200, 0), /255;85;85m85%/, "weekly 85% is red");
  assert.match(sl.renderUsage(u, 200, 0), /255;85;85m2\.0G/, "under 10% free RAM is red");
  assert.ok(!/\/h/.test(strip(sl.renderUsage({ ...u, perHour: null }, 200, 0))), "no rate before it means anything");
  assert.strictEqual(strip(sl.renderUsage({ ...u, five: null, week: null, cost: null }, 200, 0)), "RAM 2.0G free");
});

test("header shows uncommitted files and warns on a full context", () => {
  const h = { name: "Peach", folder: "Tools", branch: "main", dirty: 23, model: "Opus 5.5", pct: 85 };
  assert.match(strip(sl.renderHeader(h, 120, "1;2;3")), /main · 23 changed .*⚠ 85%/);
  assert.match(strip(sl.renderHeader(h, 30, "1;2;3")), /±23/);
  assert.match(strip(sl.renderHeader({ ...h, dirty: null }, 120, "1;2;3")), /main ±\?/);
  assert.ok(!/changed|±/.test(strip(sl.renderHeader({ ...h, dirty: 0 }, 120, "1;2;3"))));
});

test("narrow header shows the changed count without a stray gap", () => {
  const h = { name: "Peach", folder: "Tools", branch: "main", dirty: 23, model: "Opus 5.5", pct: 62 };
  const line = strip(sl.renderHeader(h, 34, "1;2;3"));
  assert.ok(/│ {2}±23/.test(line) && !/ {3}±23/.test(line), line); // separator is "  │  "; a third space is the bug
});
