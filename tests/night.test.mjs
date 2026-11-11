// End-to-end and unit tests for the night orchestrator. Every agent here is the deterministic fake
// in fixtures/night/fake-agent.mjs: no model, paid or otherwise, is ever called.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toYaml } from '../nightly-evolution/scripts/lib/yaml.mjs';
import { assess, tick, MAX_RESTARTS } from '../skills/night/scripts/lib/watchdog.mjs';
import { priority, scoreLoop, followUpTasks } from '../skills/night/scripts/lib/plan.mjs';
import { inspectDiff, decide } from '../skills/night/scripts/lib/evaluate.mjs';
import { checkpoint, revertTo, commitTask } from '../skills/night/scripts/lib/workspace.mjs';
import { discoverSkills } from '../skills/night/scripts/lib/loops.mjs';
import { DEFAULT_CONFIG } from '../skills/night/scripts/lib/state.mjs';
import { _test } from '../skills/night/scripts/lib/supervisor.mjs';

const { Supervisor } = _test;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const NIGHT = path.resolve(HERE, '..', 'skills', 'night', 'scripts', 'night.mjs');
const FAKE_SRC = path.join(HERE, 'fixtures', 'night', 'fake-agent.mjs');
const fwd = (p) => p.replace(/\\/g, '/');
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const hasPython = ['python', 'python3', 'py'].find((c) => spawnSync(c, ['-c', 'import unittest'], { stdio: 'ignore' }).status === 0);

// Command agents run through `cmd /d /s /c` verbatim on Windows, so the temp root must have no spaces.
function tmpRoot(label) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), `night-${label}-`));
  assert.ok(!/\s/.test(base), `temp dir must have no spaces: ${base}`);
  return base;
}

const MATH = 'export const add = (a, b) => a + b;\nexport const mul = (a, b) => a * b;\n';
const MATH_TEST = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from './math.js';\ntest('add', () => assert.equal(add(2, 3), 5));\n";

/** A git repo with the given files, one commit, and a night config that uses the fake agent. */
function makeRepo(label, files, { plan = 'js-test', config = {} } = {}) {
  const base = tmpRoot(label);
  const repo = path.join(base, 'repo');
  fs.mkdirSync(repo);
  for (const [f, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(repo, f)), { recursive: true });
    fs.writeFileSync(path.join(repo, f), body);
  }
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.name', 'night-test');
  git(repo, 'config', 'user.email', 'night-test@localhost');
  git(repo, 'config', 'core.autocrlf', 'false');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'init');
  const fake = path.join(base, 'fake.mjs');
  fs.copyFileSync(FAKE_SRC, fake);
  const ctx = { base, repo, fake, counter: path.join(base, 'counter') };
  writeConfig(ctx, plan, config);
  return ctx;
}

function writeConfig(ctx, plan, config = {}) {
  const { evaluation = {}, ...rest } = config;
  const cfg = {
    max_iterations: 6,
    max_concurrent_agents: 1,
    evaluation: { flaky_repeat: 1, ...evaluation },
    retry: { backoff_base_seconds: 1, backoff_max_seconds: 2 },
    timeouts: { heartbeat_seconds: 1, finalize_minutes: 1 },
    workspace: { dir: fwd(path.join(ctx.base, 'ws')) },
    agents: { order: [], commands: { fake: { run: `node ${fwd(ctx.fake)} {cwd} ${plan} ${fwd(ctx.counter)}` } } },
    ...rest,
  };
  fs.mkdirSync(path.join(ctx.repo, '.night'), { recursive: true });
  fs.writeFileSync(path.join(ctx.repo, '.night', 'config.yaml'), toYaml(cfg));
}

// Under `node --test`, NODE_TEST_CONTEXT makes a nested `node --test` report to this runner
// instead of printing results, so the evaluated repo's checks must not inherit it.
const { NODE_TEST_CONTEXT: _ctx, ...BASE_ENV } = process.env;
const ENV = { ...BASE_ENV, NIGHT_AGENTS: 'fake' };

function night(ctx, args, { timeout = 180_000, env = ENV } = {}) {
  const r = spawnSync(process.execPath, [NIGHT, ...args], { cwd: ctx.repo, env, encoding: 'utf8', timeout });
  return { code: r.status, out: `${r.stdout}${r.stderr}`, timedOut: r.error?.code === 'ETIMEDOUT' };
}

const state = (ctx) => JSON.parse(fs.readFileSync(path.join(ctx.repo, '.night', 'state.json'), 'utf8'));
const jsonl = (ctx, name) => {
  const f = path.join(ctx.repo, '.night', name);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
};
const report = (ctx) => fs.readFileSync(state(ctx).report, 'utf8');
const onBranch = (ctx, file) => {
  try { return git(ctx.repo, 'show', `${state(ctx).branch}:${file}`); } catch { return null; }
};

test('JS repo: several iterations keep new tests on the run branch and leave main alone', () => {
  const ctx = makeRepo('js', { 'package.json': '{"type":"module"}\n', 'math.js': MATH, 'math.test.js': MATH_TEST });
  const r = night(ctx, ['run', 'tests']);
  assert.equal(r.code, 0, r.out);
  const s = state(ctx);
  assert.equal(s.status, 'done', r.out);
  const kept = jsonl(ctx, 'experiments.jsonl').filter((e) => e.verdict === 'keep');
  assert.ok(kept.length >= 2, `expected 2 kept experiments, got ${kept.length}\n${r.out}`);
  assert.ok(onBranch(ctx, 'gen1.test.js') && onBranch(ctx, 'gen2.test.js'));
  assert.ok(!fs.existsSync(path.join(ctx.repo, 'gen1.test.js')), 'the user checkout must not change');
  assert.equal(git(ctx.repo, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main');
  assert.equal(git(ctx.repo, 'log', '--oneline', 'main').split('\n').length, 1);
  assert.match(report(ctx), /Finished|kept/i);
});

test('Python unittest repo: tests are detected and kept', { skip: !hasPython && 'python not installed' }, () => {
  const ctx = makeRepo('py', {
    'calc.py': 'def add(a, b):\n    return a + b\n\ndef mul(a, b):\n    return a * b\n',
    'test_calc.py': 'import unittest\nfrom calc import add\n\nclass T(unittest.TestCase):\n    def test_add(self):\n        self.assertEqual(add(2, 3), 5)\n',
  }, { plan: 'py-test' });
  const r = night(ctx, ['run', 'tests']);
  assert.equal(r.code, 0, r.out);
  const base = JSON.parse(fs.readFileSync(path.join(ctx.repo, '.night', 'baseline.json'), 'utf8'));
  assert.ok(base.commands.some((c) => c.kind === 'tests'), JSON.stringify(base.commands));
  assert.ok(onBranch(ctx, 'test_gen1.py'), r.out);
});

test('failing tests: bugs mode keeps the fix that turns the baseline green', () => {
  const ctx = makeRepo('red', { 'package.json': '{"type":"module"}\n', 'math.js': MATH.replace('a + b', 'a - b'), 'math.test.js': MATH_TEST }, { plan: 'fix-add' });
  const r = night(ctx, ['run', 'bugs']);
  assert.equal(r.code, 0, r.out);
  const base = JSON.parse(fs.readFileSync(path.join(ctx.repo, '.night', 'baseline.json'), 'utf8'));
  assert.equal(base.red, true);
  assert.match(onBranch(ctx, 'math.js'), /a \+ b/, r.out);
  assert.ok(jsonl(ctx, 'experiments.jsonl').some((e) => e.verdict === 'keep'));
});

test('no tests: nothing is kept without verification and the report says what is unknown', () => {
  const ctx = makeRepo('none', { 'package.json': '{"type":"module"}\n', 'math.js': MATH });
  const r = night(ctx, ['run', 'tests', '--max-iterations', '2']);
  assert.equal(r.code, 0, r.out);
  const exps = jsonl(ctx, 'experiments.jsonl');
  assert.ok(exps.length >= 1, r.out);
  assert.ok(exps.every((e) => e.verdict !== 'keep'), JSON.stringify(exps.map((e) => e.verdict)));
  assert.equal(onBranch(ctx, 'gen1.test.js'), null);
  assert.match(report(ctx), /no check ran/);
});

test('uncommitted user changes in the checkout survive a run untouched', () => {
  const ctx = makeRepo('dirty', { 'package.json': '{"type":"module"}\n', 'math.js': MATH, 'math.test.js': MATH_TEST, 'README.md': '# demo\n' });
  fs.writeFileSync(path.join(ctx.repo, 'README.md'), '# demo\nmy unsaved notes\n');
  fs.writeFileSync(path.join(ctx.repo, 'scratch.txt'), 'untracked work\n');
  // .night/ is night's own folder (it adds it to .git/info/exclude), so it is left out of the comparison.
  const userStatus = () => git(ctx.repo, 'status', '--porcelain').split('\n').filter((l) => !l.includes('.night/')).join('\n');
  const before = userStatus();
  const r = night(ctx, ['run', 'tests']);
  assert.equal(r.code, 0, r.out);
  assert.equal(fs.readFileSync(path.join(ctx.repo, 'README.md'), 'utf8'), '# demo\nmy unsaved notes\n');
  assert.equal(fs.readFileSync(path.join(ctx.repo, 'scratch.txt'), 'utf8'), 'untracked work\n');
  assert.equal(userStatus(), before);
  assert.match(git(ctx.repo, 'diff', 'README.md'), /\+my unsaved notes/);
  assert.ok(onBranch(ctx, 'gen1.test.js'), 'the run still worked on its own branch');
  assert.equal(onBranch(ctx, 'scratch.txt'), null, 'uncommitted files never reach the run branch');
});

test('no frontend: auto mode plans no visual or accessibility loop', () => {
  const ctx = makeRepo('nofe', { 'package.json': '{"type":"module"}\n', 'math.js': MATH, 'math.test.js': MATH_TEST });
  const r = night(ctx, ['plan', 'auto', '--json']);
  assert.equal(r.code, 0, r.out);
  const { tasks } = JSON.parse(r.out);
  assert.ok(tasks.length > 0);
  assert.ok(tasks.every((t) => !['night-visual', 'night-accessibility'].includes(t.loop)), tasks.map((t) => t.loop).join(','));
  for (const t of tasks) {
    assert.equal(t.priority, priority(t.scores));
    assert.ok(t.basis && Object.keys(t.basis).length >= 5, `task ${t.id} needs a basis for every score`);
  }
});

test('unavailable tool: a check whose binary is missing is reported, not counted as a failure', () => {
  const ctx = makeRepo('tool', { 'package.json': '{"type":"module"}\n', 'math.js': MATH, 'math.test.js': MATH_TEST }, {
    config: { evaluation: { commands: [{ name: 'test', run: 'node --test', kind: 'tests' }, { name: 'lint', run: 'no-such-linter-xyz --check .', kind: 'lint' }] } },
  });
  const r = night(ctx, ['run', 'tests']);
  assert.equal(r.code, 0, r.out);
  const base = JSON.parse(fs.readFileSync(path.join(ctx.repo, '.night', 'baseline.json'), 'utf8'));
  assert.equal(base.red, false);
  assert.equal(base.checks.find((c) => c.name === 'lint').missing_tool, true);
  assert.ok(onBranch(ctx, 'gen1.test.js'), r.out);
  assert.match(report(ctx), /tool missing/);
});

// Regression: a forced agent that is not installed used to relaunch the task every second until
// the deadline instead of stopping.
test('a requested agent that is not available ends the run quickly', () => {
  const ctx = makeRepo('noagent', { 'package.json': '{"type":"module"}\n', 'math.js': MATH, 'math.test.js': MATH_TEST });
  const t0 = Date.now();
  const r = night(ctx, ['run', 'tests', '--agent', 'nosuch-agent'], { timeout: 60_000 });
  assert.equal(r.timedOut, false, 'the run must not spin until the deadline');
  const s = state(ctx);
  assert.equal(s.stop_reason, 'agents_unavailable', r.out);
  assert.equal(s.iterations, 0);
  assert.ok(s.warnings.some((w) => /nosuch-agent is not available/.test(w)), JSON.stringify(s.warnings));
  assert.ok(Date.now() - t0 < 60_000);
});

// Regression: an agent that reports no cost used to make the report say "cost $0".
test('cost stays unknown when the agent reports none', () => {
  const ctx = makeRepo('cost', { 'package.json': '{"type":"module"}\n', 'math.js': MATH, 'math.test.js': MATH_TEST });
  const r = night(ctx, ['run', 'tests']);
  assert.equal(r.code, 0, r.out);
  assert.equal(state(ctx).usage.cost_known, false);
  const text = report(ctx);
  assert.doesNotMatch(text, /cost[^\n]*\$0\b/i);
  assert.match(text, /total cost/);
});

test('token budget: the run stops before a task that would exceed it', () => {
  const ctx = makeRepo('budget', { 'package.json': '{"type":"module"}\n', 'math.js': MATH, 'math.test.js': MATH_TEST }, { plan: 'usage', config: { token_budget: 1500, max_iterations: 10 } });
  const r = night(ctx, ['run', 'tests']);
  assert.equal(r.code, 0, r.out);
  const s = state(ctx);
  assert.equal(s.stop_reason, 'token_budget_predicted', r.out);
  assert.equal(s.iterations, 2);
  assert.equal(s.usage.input_tokens + s.usage.output_tokens, 1400);
  assert.equal(s.usage.cost_usd, 0.5);
  assert.ok(s.usage.input_tokens + s.usage.output_tokens <= 1500);
});

test('a repeatedly failing change is blocked and reverting it keeps the earlier kept work', () => {
  const ctx = makeRepo('block', { 'package.json': '{"type":"module"}\n', 'math.js': MATH, 'math.test.js': MATH_TEST }, { plan: 'js-test,break' });
  const r = night(ctx, ['run', 'tests']);
  assert.equal(r.code, 0, r.out);
  const s = state(ctx);
  assert.ok(s.tasks.some((t) => t.status === 'blocked'), JSON.stringify(s.tasks.map((t) => [t.id, t.status])));
  assert.ok(onBranch(ctx, 'gen1.test.js'), 'the kept test from the first task survives');
  assert.doesNotMatch(onBranch(ctx, 'math.js'), /a \* b \+ 1/, 'the breaking change never lands');
  const reverted = jsonl(ctx, 'experiments.jsonl').filter((e) => e.verdict === 'revert');
  assert.ok(reverted.length >= 2);
  assert.ok(jsonl(ctx, 'failures.jsonl').length >= 2);
});

// Lane worktrees live at <workspace.dir>/<run id>/lane-N.
const lanes = (ctx) => {
  const ws = path.join(ctx.base, 'ws');
  if (!fs.existsSync(ws)) return [];
  return fs.readdirSync(ws).flatMap((run) => fs.readdirSync(path.join(ws, run)).filter((d) => d.startsWith('lane-')).map((d) => path.join(ws, run, d)));
};

function killTree(pid) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
  else try { process.kill(-pid, 'SIGKILL'); } catch { process.kill(pid, 'SIGKILL'); }
}

async function waitFor(fn, ms, label) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if (fn()) return; } catch { /* not ready yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timed out waiting for ${label}`);
}

test('interrupted session: a killed run resumes, reverts the half-done task and finishes', async () => {
  const ctx = makeRepo('resume', { 'package.json': '{"type":"module"}\n', 'math.js': MATH, 'math.test.js': MATH_TEST }, { plan: 'hang' });
  const child = spawn(process.execPath, [NIGHT, 'run', 'tests'], { cwd: ctx.repo, env: ENV, stdio: 'ignore', detached: process.platform !== 'win32' });
  try {
    await waitFor(() => lanes(ctx).some((d) => fs.existsSync(path.join(d, 'half-done.txt'))), 60_000, 'the hanging agent to start');
  } finally { killTree(child.pid); }
  await new Promise((r) => setTimeout(r, 1000));
  assert.equal(state(ctx).status === 'done', false);
  writeConfig(ctx, 'js-test');
  const r = night(ctx, ['resume']);
  assert.equal(r.code, 0, r.out);
  const s = state(ctx);
  assert.equal(s.status, 'done', r.out);
  assert.ok(s.tasks.some((t) => t.history.some((h) => h.failure === 'interrupted')), JSON.stringify(s.tasks.map((t) => t.history)));
  assert.equal(onBranch(ctx, 'half-done.txt'), null, 'the interrupted work is not kept');
  assert.ok(onBranch(ctx, 'gen1.test.js'), r.out);
  for (const d of lanes(ctx)) assert.ok(!fs.existsSync(path.join(d, 'half-done.txt')), `lane ${d} still has the half-done file`);
});

// Watchdog decisions are pure, so they are tested directly.
const NOW = Date.parse('2026-11-10T03:00:00Z');
const ago = (s) => new Date(NOW - s * 1000).toISOString();
const running = (o = {}) => ({ status: 'running', phase: 'agent', heartbeat_at: ago(10), restarts: 0, ...o });

test('watchdog: healthy, dead, stalled, long phase, backoff and give-up', () => {
  assert.equal(assess(null).action, 'exit');
  assert.equal(assess({ status: 'done' }).action, 'exit');
  assert.equal(assess(running(), { now: NOW, alive: true }).action, 'wait');
  assert.equal(assess(running(), { now: NOW, alive: false }).action, 'restart');
  assert.equal(assess(running({ heartbeat_at: ago(900) }), { now: NOW, alive: true }).action, 'kill_restart');
  // A 40-minute build: old heartbeat, but the declared phase deadline has not passed.
  const build = running({ phase: 'evaluate', heartbeat_at: ago(900), phase_deadline: new Date(NOW + 1_800_000).toISOString() });
  assert.equal(assess(build, { now: NOW, alive: true }).action, 'wait');
  const backing = running({ restarts: 2, last_restart_at: ago(60) });
  assert.equal(assess(backing, { now: NOW, alive: false, backoffBaseSeconds: 30 }).action, 'wait'); // 120s needed
  assert.equal(assess(running({ restarts: 2, last_restart_at: ago(121) }), { now: NOW, alive: false, backoffBaseSeconds: 30 }).action, 'restart');
  assert.equal(assess(running({ restarts: MAX_RESTARTS }), { now: NOW, alive: false }).action, 'give_up');
  const stopped = assess(running(), { now: NOW, alive: false, stopRequested: true });
  assert.deepEqual([stopped.action, stopped.status], ['give_up', 'stopped']);
});

test('watchdog tick restarts a dead supervisor through the injected spawner only', () => {
  const ctx = makeRepo('wd', { 'a.txt': 'a\n' });
  const p = path.join(ctx.repo, '.night', 'state.json');
  fs.writeFileSync(p, JSON.stringify({ run_id: 'r1', status: 'running', phase: 'agent', pid: 999999, heartbeat_at: new Date(Date.now() - 600_000).toISOString(), restarts: 0, tasks: [] }));
  let spawned = 0;
  const v = tick(ctx.repo, { spawner: () => { spawned += 1; return 4242; } });
  assert.equal(v.action, 'restart');
  assert.equal(spawned, 1);
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.equal(s.restarts, 1);
  // Immediately after, backoff holds the next restart.
  assert.equal(tick(ctx.repo, { spawner: () => { spawned += 1; return 1; } }).action, 'wait');
  assert.equal(spawned, 1);
});

test('planning: priority follows the formula and failing tests raise the bug loop', () => {
  assert.equal(priority({ impact: 5, confidence: 4, risk_reduction: 5, effort: 2, execution_cost: 2 }), 25);
  const bug = { name: 'night-bug-hunter', modes: ['bugs'], signals: ['failing-tests'], writes: 'code', minutes: 30 };
  const green = scoreLoop(bug, { signals: [], evaluation: [{ kind: 'tests' }], red: false });
  const red = scoreLoop(bug, { signals: [], evaluation: [{ kind: 'tests' }], red: true });
  assert.ok(red.priority > green.priority, `${red.priority} > ${green.priority}`);
  assert.ok(red.basis.impact && red.basis.confidence);
});

test('help lists each mode once', () => {
  const r = spawnSync(process.execPath, [NIGHT, 'help'], { cwd: path.resolve(HERE, '..'), env: ENV, encoding: 'utf8' });
  const modes = r.stdout.match(/^Modes: (.*)\. Anything/m)[1].split(', ');
  assert.ok(modes.includes('auto') && modes.includes('tests'));
  assert.deepEqual(modes, [...new Set(modes)]);
});

// Regression tests from the independent audit. Each one failed before its fix.

/** A bare committed repo with no night config, for testing the git and diff helpers directly. */
function plainRepo(label, files) {
  const repo = path.join(tmpRoot(label), 'repo');
  fs.mkdirSync(repo);
  for (const [f, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(repo, f)), { recursive: true });
    fs.writeFileSync(path.join(repo, f), body);
  }
  for (const args of [['init', '-q', '-b', 'main'], ['config', 'user.name', 'night-test'], ['config', 'user.email', 'night-test@localhost'], ['config', 'core.autocrlf', 'false'], ['add', '.'], ['commit', '-q', '-m', 'init']]) git(repo, ...args);
  return repo;
}

test('diff inspection sees renamed protected files and tests, per-file assertion loss, trivial asserts and test-script edits', () => {
  const repo = plainRepo('diff', {
    '.github/ci.yml': 'on: push\n',
    'package.json': '{\n  "scripts": {\n    "test": "node --test"\n  }\n}\n',
    'a.test.js': 'assert.equal(1, 1);\nassert.equal(2, 2);\n',
    'b.test.js': 'assert.equal(3, 3);\n',
  });
  const base = git(repo, 'rev-parse', 'HEAD');
  git(repo, 'mv', '.github/ci.yml', 'ci.yml');
  git(repo, 'mv', 'b.test.js', 'b.txt');
  fs.writeFileSync(path.join(repo, 'a.test.js'), 'assert(true);\nassert.ok(true);\n');
  fs.writeFileSync(path.join(repo, 'package.json'), '{\n  "scripts": {\n    "test": "echo ok"\n  }\n}\n');
  fs.writeFileSync(path.join(repo, 'café.txt'), 'x\n');
  const d = inspectDiff(repo, base, { protectedPaths: ['.github/**'] });
  assert.deepEqual(d.protected, ['.github/ci.yml']);
  assert.deepEqual(d.deleted_tests, ['b.test.js']);
  assert.equal(d.removed_assertions, 3, 'two real asserts replaced by trivial ones, plus the moved test file');
  assert.equal(d.test_script_changed, true);
  assert.ok(d.files.includes('café.txt'), d.files.join(', '));
});

test('reverting after a rename restores the source and removes non-ASCII new files', () => {
  const repo = plainRepo('revert', { 'src.js': 'export {};\n' });
  const cp = checkpoint(repo, null);
  git(repo, 'mv', 'src.js', 'dst.js');
  fs.writeFileSync(path.join(repo, 'naïve file.txt'), 'x\n');
  revertTo(repo, cp);
  assert.ok(fs.existsSync(path.join(repo, 'src.js')));
  assert.ok(!fs.existsSync(path.join(repo, 'dst.js')));
  assert.ok(!fs.existsSync(path.join(repo, 'naïve file.txt')));
  assert.equal(git(repo, 'status', '--porcelain'), '');
});

test('a task commit takes only its own files, not what the agent staged', () => {
  const repo = plainRepo('commit', { 'keep.txt': 'k\n' });
  fs.writeFileSync(path.join(repo, 'a.txt'), 'a\n');
  fs.writeFileSync(path.join(repo, 'b.txt'), 'b\n');
  git(repo, 'add', 'b.txt');
  commitTask(repo, { files: ['a.txt'], message: 'task' });
  assert.deepEqual(git(repo, 'show', '--name-only', '--format=', 'HEAD').split('\n'), ['a.txt']);
});

test('vanished test counts and a changed test script are regressions', () => {
  const task = { writes: 'code', keep_rule: 'no-regression' };
  const diff = { files: ['math.js'], protected: [], secrets: [], removed_assertions: 0, skips_added: [], deleted_tests: [] };
  const baseline = [{ name: 'test', ok: true, code: 0, counts: { passed: 3, failed: 0, skipped: 0 } }];
  const vanished = decide({ task, baseline, after: [{ name: 'test', ok: true, code: 0, counts: null }], diff, config: DEFAULT_CONFIG });
  assert.equal(vanished.verdict, 'revert', JSON.stringify(vanished));
  const script = decide({ task, baseline, after: baseline, diff: { ...diff, test_script_changed: true }, config: DEFAULT_CONFIG });
  assert.equal(script.verdict, 'revert', JSON.stringify(script));
});

test('agents cannot queue skill evolution, and the engine is protected in its own repository', () => {
  const root = path.resolve(HERE, '..');
  const loopsByName = new Map(discoverSkills(root).loops.map((l) => [l.name, l]));
  const ctx = { signals: [], evaluation: [], red: false };
  const tasks = followUpTasks([{ loop: 'night-evolve-skills', title: 'rewrite the supervisor' }, { loop: 'night-tests', title: 'cover parseCounts' }], [], loopsByName, ctx, 't-1');
  assert.deepEqual(tasks.map((t) => t.loop), ['night-tests']);
  const paths = Supervisor.prototype.protectedPaths.call({ state: {}, config: { protected_paths: [] }, root });
  for (const p of ['skills/night/**', 'skills/night-evolve-skills/**', 'nightly-evolution/scripts/lib/**', 'tests/night.test.mjs']) assert.ok(paths.includes(p), p);
});

test('a checkpoint from an earlier attempt or another lane is never reverted to', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'night-cp-'));
  const self = { p: { checkpoints: dir } };
  fs.writeFileSync(path.join(dir, 't-1.json'), JSON.stringify({ sha: 'abc', untracked: [], dir: '/ws/lane-0', task: 't-1', attempt: 1 }));
  const own = (task) => Supervisor.prototype.ownCheckpoint.call(self, task);
  assert.ok(own({ id: 't-1', lane: '/ws/lane-0', attempts: 1 }));
  assert.equal(own({ id: 't-1', lane: '/ws/lane-0', attempts: 2 }), null, 'stale attempt');
  assert.equal(own({ id: 't-1', lane: '/ws/lane-1', attempts: 1 }), null, 'other lane');
  assert.equal(own({ id: 't-1', lane: null, attempts: 1 }), null, 'no lane');
});

test('a moved remote-tracking ref stops the run and the attempt is not kept', () => {
  const ctx = makeRepo('push', { 'package.json': '{"type":"module"}\n', 'math.js': MATH, 'math.test.js': MATH_TEST }, { plan: 'push' });
  const r = night(ctx, ['run', 'tests']);
  assert.equal(r.code, 0, r.out);
  const s = state(ctx);
  assert.equal(s.stop_reason, 'remote_refs_changed', r.out);
  assert.equal(onBranch(ctx, 'gen1.test.js'), null);
  assert.ok(s.warnings.some((w) => /remote-tracking refs changed/.test(w)), s.warnings.join('\n'));
});

test('a cost budget that cannot be enforced is warned about once', () => {
  const ctx = makeRepo('costwarn', { 'package.json': '{"type":"module"}\n', 'math.js': MATH, 'math.test.js': MATH_TEST }, { config: { cost_budget_usd: 1 } });
  const r = night(ctx, ['run', 'tests']);
  assert.equal(r.code, 0, r.out);
  const warned = state(ctx).warnings.filter((w) => /cost budget cannot be enforced/.test(w));
  assert.equal(warned.length, 1, state(ctx).warnings.join('\n'));
});
