// Independent evaluation: the supervisor runs every check itself and decides keep, revert or
// inconclusive from evidence. Agent claims never count.
import fs from 'node:fs';
import path from 'node:path';
import { run, runSync, matchesAny } from '../../../../nightly-evolution/scripts/lib/util.mjs';
import { measureMetric, compare } from '../../../../nightly-evolution/scripts/lib/measure.mjs';
import { makeRedactor } from '../../../../history-learning/scripts/lib/redact.mjs';
import { gitPaths } from './workspace.mjs';

/** Test counts from common runners, or null when the output has none. */
export function parseCounts(text) {
  const s = String(text || '');
  const num = (re) => { const m = re.exec(s); return m ? Number(m[1]) : null; };
  // node --test (spec and TAP reporters)
  let passed = num(/^[ℹ#] pass (\d+)/m);
  let failed = num(/^[ℹ#] fail (\d+)/m);
  let skipped = num(/^[ℹ#] skipped (\d+)/m);
  if (passed != null || failed != null) return { passed: passed ?? 0, failed: failed ?? 0, skipped: skipped ?? 0 };
  // unittest
  const ran = num(/^Ran (\d+) tests? in/m);
  if (ran != null) {
    const f = num(/failures=(\d+)/) ?? 0;
    const e = num(/errors=(\d+)/) ?? 0;
    skipped = num(/skipped=(\d+)/) ?? 0;
    return { passed: Math.max(0, ran - f - e - skipped), failed: f + e, skipped };
  }
  // pytest, jest, vitest, mocha: "3 passed, 1 failed, 2 skipped"; pytest errors count as failures
  const tail = s.split('\n').slice(-40).join('\n');
  const grab = (word) => { const all = [...tail.matchAll(new RegExp(`(\\d+) ${word}`, 'g'))]; return all.length ? Number(all.at(-1)[1]) : null; };
  passed = grab('passed') ?? grab('passing');
  failed = grab('failed') ?? grab('failing');
  const errors = grab('errors?');
  skipped = grab('skipped') ?? grab('pending');
  if (passed == null && failed == null && errors == null) return null;
  return { passed: passed ?? 0, failed: (failed ?? 0) + (errors ?? 0), skipped: skipped ?? 0 };
}

/** Run every check once; checks of kind "tests" run `repeat` times so flaky tests show up. */
export async function runChecks(commands, cwd, { timeoutMs = 30 * 60_000, logDir, repeat = 1, env, deadline } = {}) {
  const out = [];
  for (const c of commands) {
    const n = c.kind === 'tests' ? Math.max(1, repeat) : 1;
    const runs = [];
    for (let i = 0; i < n; i++) {
      const left = deadline ? deadline - Date.now() : Infinity;
      if (left <= 0) break;
      const logFile = logDir ? path.join(logDir, `${c.name.replace(/[^\w.-]+/g, '_')}-${Date.now()}-${i}.log`) : undefined;
      const r = await run(c.run, { cwd: c.cwd ? path.join(cwd, c.cwd) : cwd, timeoutMs: Math.min(timeoutMs, left), env, logFile });
      runs.push({ code: r.code, ms: r.ms, timedOut: r.timedOut, counts: parseCounts(`${r.stdout}\n${r.stderr}`), tail: `${r.stdout}\n${r.stderr}`.slice(-1500), logFile });
    }
    if (!runs.length) { out.push({ name: c.name, run: c.run, kind: c.kind || 'check', ok: false, skipped: true, error: 'no time left to run' }); continue; }
    const oks = runs.map((r) => r.code === 0);
    const flaky = oks.some(Boolean) && oks.some((v) => !v);
    const last = runs.at(-1);
    out.push({
      name: c.name, run: c.run, kind: c.kind || 'check',
      ok: oks.every(Boolean), flaky, code: last.code, timedOut: runs.some((r) => r.timedOut),
      missing_tool: last.code === 127 || /not recognized as an internal or external command|command not found|No module named/i.test(last.tail),
      ms: Math.round(runs.reduce((a, r) => a + r.ms, 0) / runs.length),
      counts: last.counts, runs: runs.length, tail: last.tail, logFile: last.logFile,
    });
  }
  return out;
}

export async function measureMetrics(defs, cwd, logDir) {
  const out = {};
  for (const def of defs || []) {
    try {
      for (const m of await measureMetric(def, { cwd, vars: {}, logDir })) out[m.name] = { ...m, def };
    } catch (error) {
      out[def.name] = { name: def.name, ok: false, value: null, error: error.message, def };
    }
  }
  return out;
}

const ASSERT = /\b(assert\w*|expect\s*\(|should\.|\.toBe|\.toEqual|t\.(ok|is|equal|deepEqual|throws)|self\.assert\w*|pytest\.raises)/g;
const SKIP_ADDED = /(\b(it|test|describe)\.(skip|todo)\(|\bxit\(|\bxdescribe\(|@pytest\.mark\.(skip|xfail)|@unittest\.skip|\{\s*skip:\s*true|\.only\()/;
const SECRET_RULE = /KEY|TOKEN|SECRET|PRIVATE|CREDENTIAL|PASSWORD|JWT|BEARER/;
// Assertions that check nothing; they never balance out a removed real assertion.
const TRIVIAL_ASSERT = /\b(assert(\.ok)?\(\s*(true|1|True)\s*\)|expect\(\s*(true|1)\s*\)\.toBe(Truthy)?\(\s*(true|1)?\s*\)|self\.assertTrue\(\s*True\s*\)|assert\s+True\b)/g;
const TEST_FILE = /(^|\/)(tests?|__tests__|spec)\/|[._-](test|spec)\.[^/]+$|(^|\/)test_[^/]+\.py$|_test\.(py|go)$/;

/** What changed in `cwd` relative to `baseSha`, tracked and untracked, with the risk checks. */
export function inspectDiff(cwd, baseSha, { protectedPaths = [] } = {}) {
  // Renames off and NUL-separated: a moved file counts as deleted at its old path (so moving a
  // protected file or a test is seen), and unusual names come back literally.
  const tracked = gitPaths(cwd, ['diff', '--no-renames', '--name-only', baseSha, '--']);
  const untracked = gitPaths(cwd, ['ls-files', '--others', '--exclude-standard']);
  const files = [...new Set([...tracked, ...untracked])].sort();
  const patch = runSync(['git', '-c', 'core.quotePath=false', 'diff', '--no-renames', '--unified=0', '--no-color', baseSha, '--'], { cwd, allowFail: true }).stdout;
  // Assertions balance per file, and trivial ones (assert(true)) never offset a removed one.
  const perFile = new Map();
  const tally = (f) => { if (!perFile.has(f)) perFile.set(f, { removed: 0, added: 0 }); return perFile.get(f); };
  const real = (text) => (text.match(ASSERT) || []).length - (text.match(TRIVIAL_ASSERT) || []).length;
  let removedAsserts = 0;
  const skipsAdded = [];
  let testScriptChanged = false;
  let file = '';
  let oldFile = '';
  const added = [];
  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git ')) { file = ''; oldFile = ''; continue; }
    if (line.startsWith('--- ')) { oldFile = line === '--- /dev/null' ? '' : line.replace(/^--- (a\/)?/, ''); continue; }
    if (line.startsWith('+++ ')) { file = line === '+++ /dev/null' ? oldFile : line.replace(/^\+\+\+ (b\/)?/, ''); continue; }
    const isTest = TEST_FILE.test(file);
    if (line.startsWith('+')) {
      added.push(line.slice(1));
      if (isTest) { tally(file).added += Math.max(0, real(line)); if (SKIP_ADDED.test(line)) skipsAdded.push(file); }
    } else if (line.startsWith('-') && isTest) {
      const n = (line.match(ASSERT) || []).length;
      tally(file).removed += n;
      removedAsserts += n;
    }
    if (/(^|\/)package\.json$/.test(file) && /^[+-]\s*"(pre|post)?test(:[^"]*)?"\s*:/.test(line)) testScriptChanged = true;
  }
  for (const f of untracked) {
    try {
      const text = fs.readFileSync(path.join(cwd, f), 'utf8');
      added.push(text);
      if (TEST_FILE.test(f)) { tally(f).added += Math.max(0, real(text)); if (SKIP_ADDED.test(text)) skipsAdded.push(f); }
    } catch { /* binary or vanished */ }
  }
  const netRemoved = [...perFile.values()].reduce((n, x) => n + Math.max(0, x.removed - x.added), 0);
  // Only secret-type rules count; emails, IPs and paths in code are not secrets.
  const { hits } = makeRedactor({ home: '/no-home-check', user: '' })(added.join('\n'));
  const secrets = Object.entries(hits || {}).filter(([k, n]) => n > 0 && SECRET_RULE.test(k)).map(([k]) => k);
  const deletedTests = gitPaths(cwd, ['diff', '--no-renames', '--name-only', '--diff-filter=D', baseSha, '--']).filter((f) => TEST_FILE.test(f));
  return {
    files,
    protected: files.filter((f) => matchesAny(f, protectedPaths)),
    removed_assertions: netRemoved,
    removed_assertion_lines: removedAsserts,
    skips_added: [...new Set(skipsAdded)],
    deleted_tests: deletedTests,
    test_script_changed: testScriptChanged,
    secrets,
    stat: runSync(['git', 'diff', '--shortstat', baseSha, '--'], { cwd, allowFail: true }).stdout.trim(),
  };
}

const sum = (checks, k) => checks.reduce((n, c) => n + (c.counts?.[k] ?? 0), 0);
const hasCounts = (checks) => checks.some((c) => c.counts);

/**
 * Decide the verdict. `baseline` and `after` are runChecks results (same command list);
 * `diff` is inspectDiff; `metrics` is { before, after } from measureMetrics.
 */
export function decide({ task, baseline = [], after = [], diff, metrics = { before: {}, after: {} }, report = null, config }) {
  const regressions = [];
  const improvements = [];
  const notes = [];

  if (task.writes === 'report') {
    if (diff.files.length) return verdict('revert', [`report loop changed files: ${diff.files.slice(0, 5).join(', ')}`], [], notes, 0.9);
    if (!report || !String(report).trim()) return verdict('inconclusive', [], [], ['the agent returned no report'], 0.3);
    return verdict('keep', [], ['report produced'], notes, 0.6);
  }

  if (!diff.files.length) return verdict('inconclusive', [], [], ['no files changed'], 0.2, 'no_change');
  if (diff.protected.length) regressions.push(`protected paths changed: ${diff.protected.join(', ')}`);
  if (diff.secrets.length) regressions.push(`possible secret added (${diff.secrets.join(', ')})`);
  if (diff.removed_assertions > 0) regressions.push(`${diff.removed_assertions} assertion(s) removed from test files`);
  if (diff.skips_added.length) regressions.push(`tests skipped or focused in ${diff.skips_added.join(', ')}`);
  if (diff.deleted_tests.length) regressions.push(`test files deleted: ${diff.deleted_tests.join(', ')}`);
  if (diff.test_script_changed) regressions.push('the package.json test script changed (the evaluation surface is frozen)');

  const base = new Map(baseline.map((c) => [c.name, c]));
  for (const c of after) {
    const b = base.get(c.name);
    if (c.flaky) regressions.push(`${c.name} is flaky (passed and failed across ${c.runs} runs)`);
    if (!b) { if (c.ok) improvements.push(`new check ${c.name} passes`); continue; }
    if (b.ok && !c.ok && !c.flaky) regressions.push(`${c.name} passed at baseline and now fails (exit ${c.code}${c.timedOut ? ', timed out' : ''})`);
    if (!b.ok && c.ok) improvements.push(`${c.name} failed at baseline and now passes`);
    if (b.counts && !c.counts && !c.missing_tool) regressions.push(`${c.name} reported test counts at baseline and none after the change`);
    if (b.counts && c.counts) {
      if (c.counts.failed > b.counts.failed) regressions.push(`${c.name}: failures ${b.counts.failed} -> ${c.counts.failed}`);
      if (c.counts.passed < b.counts.passed) regressions.push(`${c.name}: passed ${b.counts.passed} -> ${c.counts.passed}`);
      if (c.counts.skipped > b.counts.skipped) regressions.push(`${c.name}: skipped ${b.counts.skipped} -> ${c.counts.skipped}`);
      if (c.counts.passed > b.counts.passed) improvements.push(`${c.name}: passed ${b.counts.passed} -> ${c.counts.passed}`);
      if (c.counts.failed < b.counts.failed) improvements.push(`${c.name}: failures ${b.counts.failed} -> ${c.counts.failed}`);
    }
  }
  for (const b of baseline) if (!after.some((c) => c.name === b.name) && b.ok) regressions.push(`${b.name} did not run after the change`);

  const metricResults = [];
  for (const [name, a] of Object.entries(metrics.after || {})) {
    const b = metrics.before?.[name];
    const cmp = compare(a.def || {}, b, a);
    metricResults.push({ name, ...cmp });
    if (cmp.verdict === 'regressed' && cmp.gate) regressions.push(`metric ${name}: ${cmp.before} -> ${cmp.after} (${cmp.pct}%)`);
    if (cmp.verdict === 'improved') improvements.push(`metric ${name}: ${cmp.before} -> ${cmp.after} (${cmp.pct}%)`);
    if (cmp.verdict === 'unknown') notes.push(`metric ${name} could not be compared`);
  }

  const ran = after.filter((c) => !c.skipped && !c.missing_tool);
  if (regressions.length) return verdict('revert', regressions, improvements, notes, 0.9, 'verification_failed', metricResults);
  if (!ran.length) {
    notes.push('no evaluation command could run');
    return verdict(config.require_verification ? 'inconclusive' : 'keep', [], improvements, notes, 0.2, 'unverified', metricResults);
  }
  const anyPass = ran.some((c) => c.ok);
  if (!anyPass) {
    notes.push('no check passes before or after the change, so nothing proves it');
    if (config.require_verification) return verdict('inconclusive', [], improvements, notes, 0.3, 'unverified', metricResults);
  }

  const rule = task.keep_rule || 'no-regression';
  const passedUp = hasCounts(after) && sum(after, 'passed') > sum(baseline, 'passed');
  const failuresDown = (hasCounts(after) && sum(after, 'failed') < sum(baseline, 'failed')) || after.some((c) => !base.get(c.name)?.ok && c.ok && base.has(c.name));
  const metricUp = metricResults.some((m) => m.verdict === 'improved');
  const met = { 'no-regression': true, 'tests-up': passedUp, 'failures-down': failuresDown, 'metric-up': metricUp }[rule];
  if (!met) return verdict('inconclusive', [], improvements, [...notes, `keep rule ${rule} not met`], 0.4, 'rule_not_met', metricResults);
  const confidence = Math.min(0.95, 0.6 + 0.1 * improvements.length + (ran.length > 1 ? 0.1 : 0));
  return verdict('keep', [], improvements, notes, Number(confidence.toFixed(2)), null, metricResults);
}

function verdict(v, regressions, improvements, notes, confidence, failure = null, metrics = []) {
  return { verdict: v, regressions, improvements, notes, confidence, failure, metrics };
}
