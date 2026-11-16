// audit-design experience bench: the statistics, comparison and budget logic are unit-tested
// here; the browser runner is tested against a quiet fixture and one with planted defects when
// Playwright is available (set PLAYWRIGHT_PROJECT to a folder that has it installed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  SCHEMA, METRICS, DEFAULT_BUDGET, parseList, parseCpu, buildMatrix, withTier, validateScript, samplePath, median, percentile, stat,
  frameStats, inpFrom, heapGrowth, flattenRun, summarizeRuns, conditionComplete, compareStat, compareReports, validateBudget, checkBudget,
  notValidated, renderBenchMarkdown, benchStatus, findVitalsLib, tallyBytes, BROWSERS, NETWORKS, frameRateDrift,
} from '../skills/audit-design/scripts/lib/bench.mjs';

test('web-vitals is found in a project even though its exports map hides package.json', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-wv-'));
  assert.equal(findVitalsLib(project), null, 'absent package means the built-in observers are used');
  const pkg = path.join(project, 'node_modules', 'web-vitals');
  fs.mkdirSync(path.join(pkg, 'dist'), { recursive: true });
  // Same shape as the published package: no "./package.json" entry in exports.
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: 'web-vitals', version: '9.9.9', exports: { '.': './dist/web-vitals.js' } }));
  assert.equal(findVitalsLib(project), null, 'a package without the browser build is not used');
  fs.writeFileSync(path.join(pkg, 'dist', 'web-vitals.iife.js'), 'var webVitals={};');
  assert.throws(() => createRequire(path.join(project, 'package.json')).resolve('web-vitals/package.json'), 'the old lookup cannot see it');
  const nested = path.join(project, 'apps', 'web');
  fs.mkdirSync(nested, { recursive: true });
  for (const from of [project, nested]) assert.deepEqual(findVitalsLib(from), { file: path.join(pkg, 'dist', 'web-vitals.iife.js'), version: '9.9.9' });
  fs.rmSync(project, { recursive: true, force: true });
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bench = path.join(root, 'skills/audit-design/scripts/perf-bench.mjs');
const audit = path.join(root, 'skills/audit-design/scripts/visual-audit.mjs');
const fx = (n) => path.join(root, 'tests/fixtures/perf-bench', n);
const fixture = (n) => pathToFileURL(fx(n)).href;
const desktop = { name: 'desktop', width: 1280, height: 800, mobile: false };

test('option lists reject unknown values instead of ignoring them', () => {
  assert.deepEqual(parseList('light, dark,light', ['light', 'dark'], 'themes'), ['light', 'dark']);
  assert.throws(() => parseList('sepia', ['light', 'dark'], 'themes'), /sepia/);
  assert.throws(() => parseList('', null, 'cpu'), /at least one/);
  assert.deepEqual(parseCpu('1,4x'), [1, 4]);
  assert.throws(() => parseCpu('0'), /between 1 and 20/);
  assert.throws(() => parseCpu('fast'), /between 1 and 20/);
});

test('the run matrix covers every combination with stable ids, and tiers go in the URL', () => {
  const cells = buildMatrix({ viewports: [desktop], themes: ['dark'], cpu: [1, 4], motions: ['no-preference', 'reduce'], tiers: ['default', 'low'] });
  assert.equal(cells.length, 8);
  assert.equal(cells[0].id, 'desktop.dark.cpu1x.motion');
  assert.ok(cells.some((c) => c.id === 'desktop.dark.cpu4x.reduced-motion.tier-low'));
  assert.equal(new Set(cells.map((c) => c.id)).size, 8);
  assert.equal(withTier('http://localhost:3000/a?x=1', 'low'), 'http://localhost:3000/a?x=1&quality=low');
  assert.equal(withTier('http://localhost:3000/a', 'default'), 'http://localhost:3000/a');
});

test('interaction scripts are validated before anything runs', () => {
  assert.equal(validateScript({ steps: [{ type: 'click', selector: '#a' }] }).name, 'interaction');
  assert.throws(() => validateScript({ steps: [] }), /non-empty/);
  assert.throws(() => validateScript({ steps: [{ type: 'teleport' }] }), /unknown type "teleport"/);
  assert.throws(() => validateScript({ steps: [{ type: 'click' }] }), /"selector" is required/);
  assert.throws(() => validateScript({ steps: [{ type: 'move', path: [[0, 0]] }] }), /at least two/);
  assert.throws(() => validateScript({ steps: [{ type: 'drag', from: [0, 0], to: [2, 0] }] }), /viewport fractions/);
  const pts = samplePath([[0, 0], [1, 0], [1, 1]], 320);
  assert.equal(pts.length, 21);
  assert.deepEqual(pts[0], [0, 0]);
  assert.deepEqual(pts[pts.length - 1], [1, 1]);
  assert.deepEqual(pts[10], [1, 0]);
});

test('statistics ignore missing values and never invent a number', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, null, 3, 2]), 2.5);
  assert.equal(median([null, undefined, NaN]), null);
  assert.equal(percentile([1, 2, 3, 4, 5], 0.5), 3);
  assert.deepEqual(stat([10, null, 30]), { median: 20, min: 10, max: 30, n: 2 });
  assert.deepEqual(stat([null]), { median: null, min: null, max: null, n: 0 });
});

test('frame pacing estimates the refresh interval, so 120 Hz is not read as dropped frames', () => {
  const steady = (ms, n) => Array.from({ length: n }, (_, i) => i * ms);
  const f60 = frameStats(steady(16.67, 120));
  assert.ok(Math.abs(f60.fps - 60) < 0.5);
  assert.equal(f60.droppedPct, 0);
  assert.equal(frameStats(steady(8.33, 240)).droppedPct, 0);
  const janky = steady(16.67, 60);
  for (let i = 30; i < 60; i++) janky[i] += 100; // one 116 ms gap: six frames missed
  const j = frameStats(janky);
  assert.ok(j.worst > 110);
  assert.ok(j.droppedPct > 5 && j.droppedPct < 15);
  assert.equal(frameStats([0, 16, 32]).p95, null, 'too few frames is unknown, not perfect');
});

test('INP is the worst interaction, and unknown when nothing was interacted with', () => {
  assert.equal(inpFrom([]), null);
  assert.equal(inpFrom([40, 320, 64]), 320);
  const many = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(inpFrom(many), 98, 'past 50 interactions one outlier per 50 is skipped');
  // Only interactions of 16 ms or more are observed; the page's own count says how many there were.
  assert.equal(inpFrom([300, 200, 20], 100), 20, 'ranked against every interaction, not only the slow ones seen');
  assert.equal(inpFrom([300, 200], 100), null, 'the ranked interaction was below the observation threshold: unknown');
  assert.equal(inpFrom([300], 10), 300);
  assert.equal(inpFrom([40, 320], null), 320, 'no count from the page: fall back to what was seen');
});

test('heap growth is a slope after warm-up and needs enough samples', () => {
  assert.equal(heapGrowth([1000, 2000]), null);
  assert.equal(heapGrowth([5000, 1000, 1000, 1000, 1000]), 0, 'a warm-up allocation is not a leak');
  assert.equal(heapGrowth([1000, 2000, 3000, 4000, 5000]), 1000);
});

const run = (over = {}) => ({ lcp: 100, fcp: 90, ttfb: 5, load: 120, cls: 0, inp: 40, longTasks: { count: 0, total: 0 }, loaf: { worst: 0 }, frames: { p50: 16.7, p95: 17, worst: 20, droppedPct: 0 }, heap: { used: 2e6, growth: null }, bytes: { total: 5000, byType: { script: 3000 }, requests: 3 }, ...over });
const condition = (id, runs) => { const s = summarizeRuns(runs); return { id, completed: s.completed, complete: conditionComplete(s.completed, runs.length), summary: s.summary, errors: [] }; };
const rep = (conds, env = {}) => ({ schema: SCHEMA, url: 'http://localhost/', environment: { browser: 'chromium', browserVersion: '1', renderer: 'gpu', headed: true, cpuModel: 'x', platform: 'p', ...env }, runsPerCondition: 3, repeats: 1, script: null, vitalsSource: 'built-in', conditions: conds, notValidated: [] });

test('a run is flattened with unknowns kept unknown, and failed runs do not count', () => {
  const f = flattenRun(run({ inp: null, bytes: { total: null, byType: {}, requests: 0 } }));
  assert.equal(f.inp, null);
  assert.equal(f.bytesScript, null, 'no byte data means unknown, not zero');
  assert.equal(flattenRun(run({ bytes: { total: 900, byType: {}, requests: 1 } })).bytesScript, 0, 'measured and none of that type is a real zero');
  const s = summarizeRuns([run(), run({ lcp: 140 }), { error: 'timeout' }]);
  assert.equal(s.completed, 2);
  assert.equal(s.failed, 1);
  assert.equal(s.summary.lcp.median, 120);
  assert.equal(s.summary.heapGrowth.n, 0);
  assert.equal(conditionComplete(2, 3), true);
  assert.equal(conditionComplete(1, 3), false);
  assert.equal(conditionComplete(0, 1), false);
});

test('a difference inside the noise band is "no measurable change"', () => {
  const s = (median, min, max, n = 5) => ({ median, min, max, n });
  assert.equal(compareStat('lcp', s(1000, 980, 1020), s(1030, 1000, 1050)).verdict, 'no measurable change', 'under the 50 ms floor');
  assert.equal(compareStat('lcp', s(1000, 800, 1200), s(1150, 1100, 1200)).verdict, 'no measurable change', 'inside the baseline spread');
  assert.equal(compareStat('lcp', s(1000, 980, 1020), s(1300, 1280, 1320)).verdict, 'regressed');
  assert.equal(compareStat('lcp', s(1000, 980, 1020), s(700, 690, 710)).verdict, 'improved');
  assert.equal(compareStat('inp', s(null, null, null, 0), s(40, 40, 40)).verdict, 'unknown', 'an unmeasured side is never a pass');
  assert.match(compareStat('lcp', s(1000, 1000, 1000, 1), s(1300, 1300, 1300, 1)).caution, /single run/);
});

test('reports compare condition by condition and flag unlike environments', () => {
  const base = rep([condition('a', [run(), run(), run()]), condition('b', [run(), run(), run()])]);
  const same = compareReports(base, rep([condition('a', [run(), run(), run()]), condition('b', [run(), run(), run()])]));
  assert.equal(same.verdict, 'no measurable change');
  assert.equal(same.comparable, true);
  const worse = compareReports(base, rep([condition('a', [run({ inp: 400 }), run({ inp: 420 }), run({ inp: 410 })]), condition('b', [run(), run(), run()])]));
  assert.equal(worse.verdict, 'regressed');
  assert.deepEqual(worse.conditions[0].regressed, ['inp']);
  const partial = compareReports(base, rep([condition('a', [run({ lcp: 20 }), run({ lcp: 20 }), run({ lcp: 20 })]), condition('c', [run()])]));
  assert.equal(partial.verdict, 'improved, with unknowns');
  assert.deepEqual(partial.missingConditions, ['b']);
  const broken = compareReports(base, rep([condition('a', [run(), { error: 'x' }, { error: 'x' }]), condition('b', [run(), run(), run()])]));
  assert.equal(broken.conditions[0].verdict, 'unknown');
  assert.equal(broken.verdict, 'unknown', 'an incomplete condition cannot be called unchanged');
  const other = compareReports(base, rep(base.conditions, { renderer: 'SwiftShader' }));
  assert.equal(other.comparable, false);
  assert.match(other.warning, /different environments/);
  assert.throws(() => compareReports({ schema: 'x' }, base), /schema/);
});

test('network presets are part of the comparison environment, including legacy unthrottled reports', () => {
  const conds = [condition('a', [run(), run(), run()])];
  const base = rep(conds, { network: null });
  const slow = rep([condition('a', [run({ lcp: 1500 }), run({ lcp: 1500 }), run({ lcp: 1500 })])], { network: 'slow-4g' });
  const different = compareReports(base, slow);
  assert.equal(different.comparable, false);
  assert.match(different.warning, /different environments.*network/);
  assert.match(renderBenchMarkdown({ ...slow, status: 'measured', comparison: different }), /Warning:.*network/);
  assert.equal(compareReports(slow, base).comparable, false, 'shaped to unthrottled also differs');
  assert.equal(compareReports(slow, rep(conds, { network: 'fast-4g' })).comparable, false, 'different presets differ');
  assert.equal(compareReports(slow, rep(conds, { network: 'slow-4g' })).comparable, true);
  assert.equal(compareReports(base, rep(conds)).comparable, true, 'missing network in older reports means unthrottled');
  assert.equal(compareReports(rep(conds), slow).comparable, false, 'legacy reports must still differ from shaped runs');
});

test('budgets fail on a breach, an accepted trade-off needs a reason, and unmeasured is not a pass', () => {
  const conds = [condition('a', [run({ lcp: 3000, inp: null })])];
  const def = checkBudget(conds, { budgets: DEFAULT_BUDGET, tradeoffs: [] }, { isDefault: true });
  assert.deepEqual(def.breaches.map((b) => b.metric), ['lcp']);
  assert.deepEqual(def.unmeasured, [{ condition: 'a', metric: 'inp' }]);
  assert.match(def.source, /indicative/);
  const traded = checkBudget(conds, validateBudget({ budgets: { lcp: 2500 }, tradeoffs: [{ metric: 'lcp', limit: 3200, reason: 'hero video', date: '2026-11-14' }] }));
  assert.equal(traded.breaches.length, 0);
  assert.throws(() => validateBudget({ budgets: { lcp: 2500 }, tradeoffs: [{ metric: 'lcp', limit: 3200 }] }), /reason and date/);
  assert.throws(() => validateBudget({ budgets: { speed: 1 } }), /unknown metric/);
  assert.throws(() => validateBudget({}), /"budgets" object/);
  for (const k of Object.keys(DEFAULT_BUDGET)) assert.ok(METRICS[k]);
});

test('a project budget that could not be evaluated is incomplete, never a pass', () => {
  const conds = [condition('a', [run({ inp: null }), run({ inp: null }), run({ inp: null })])];
  const report = rep(conds);
  const own = { ...report, budget: checkBudget(conds, validateBudget({ budgets: { inp: 200, lcp: 2500 } })) };
  assert.deepEqual(own.budget.unmeasured, [{ condition: 'a', metric: 'inp' }]);
  const st = benchStatus(own);
  assert.equal(st.code, 2);
  assert.match(st.status, /incomplete.*not measured.*INP/i);
  // The built-in budget is indicative: its unmeasured metrics are reported, not failed.
  const def = { ...report, budget: checkBudget(conds, { budgets: DEFAULT_BUDGET, tradeoffs: [] }, { isDefault: true }) };
  assert.ok(def.budget.unmeasured.length);
  assert.equal(benchStatus(def).code, 0);
  assert.match(renderBenchMarkdown({ ...def, status: 'measured', notValidated: [] }), /Not measured, so not checked/);
});

test('page weight is unknown when any request could not be sized', () => {
  const all = tallyBytes([{ type: 'script', bytes: 1000 }, { type: 'image', bytes: 500 }, { type: 'script', bytes: 24 }]);
  assert.deepEqual(all, { total: 1524, byType: { script: 1024, image: 500 }, unsized: 0 });
  const partial = tallyBytes([{ type: 'script', bytes: 1000 }, { type: 'image', bytes: null }]);
  assert.equal(partial.total, null, 'a partial sum is not the page weight');
  assert.equal(partial.unsized, 1);
  const flat = flattenRun({ bytes: { ...partial, requests: 2 } });
  assert.equal(flat.bytesTotal, null);
  assert.equal(flat.bytesScript, null);
  assert.equal(flat.requests, 2);
  assert.equal(tallyBytes([]).total, null, 'no requests seen: unknown, not zero');
});

test('status: incomplete beats a breach, and the report always says what it cannot prove', () => {
  const ok = rep([condition('a', [run(), run(), run()])]);
  assert.deepEqual(benchStatus(ok), { status: 'measured', code: 0 });
  assert.equal(benchStatus({ ...ok, budget: { breaches: [{}] } }).code, 3);
  assert.equal(benchStatus({ ...ok, comparison: { verdict: 'regressed' } }).code, 3);
  assert.equal(benchStatus({ ...rep([condition('a', [{ error: 'x' }])]), budget: { breaches: [{}] } }).code, 2);
  assert.equal(benchStatus(rep([])).code, 2);
  const headless = notValidated({ headed: false, renderer: 'ANGLE (SwiftShader)' }, {});
  assert.ok(headless.some((n) => /Field performance/.test(n)));
  assert.ok(headless.some((n) => /headless/.test(n)));
  assert.ok(headless.some((n) => /Software renderer/.test(n)));
  assert.ok(headless.some((n) => /INP .* not measured/.test(n)));
  assert.ok(!notValidated({ headed: true, renderer: 'NVIDIA' }, { script: true, repeats: 5 }).some((n) => /headless|Software|INP/.test(n)));
  const md = renderBenchMarkdown({ ...ok, status: 'measured', notes: ['a note'], notValidated: headless, budget: checkBudget(ok.conditions, { budgets: DEFAULT_BUDGET }, { isDefault: true }) });
  assert.match(md, /Lab data, not field data/);
  assert.match(md, /## Not validated/);
  assert.match(md, /a note/);
  assert.match(md, /Heap growth per repeat \| unknown/);
});

test('other engines and shaped networks are named in the caveats, and a tap needs a target', () => {
  assert.deepEqual(BROWSERS, ['chromium', 'firefox', 'webkit']);
  for (const n of Object.values(NETWORKS)) assert.ok(n.downloadThroughput > 0 && n.uploadThroughput > 0 && n.latency > 0);
  assert.ok(NETWORKS['3g'].downloadThroughput < NETWORKS['slow-4g'].downloadThroughput && NETWORKS['slow-4g'].downloadThroughput < NETWORKS['fast-4g'].downloadThroughput);
  const chromium = notValidated({ headed: true, renderer: 'NVIDIA', browser: 'chromium' }, { script: true, repeats: 5 });
  assert.ok(chromium.some((n) => /measured Chromium only/.test(n)));
  assert.ok(chromium.some((n) => /without network throttling/.test(n)));
  const webkit = notValidated({ headed: true, renderer: 'x', browser: 'webkit' }, { script: true, repeats: 5 });
  assert.ok(webkit.some((n) => /not the Safari app or an iPhone/.test(n) && /unknown, not zero/.test(n)));
  assert.ok(notValidated({ headed: true, renderer: 'x', browser: 'firefox' }, {}).some((n) => /Firefox: the Playwright build/.test(n)));
  const shaped = notValidated({ headed: true, renderer: 'x', network: 'slow-4g' }, {});
  assert.ok(shaped.some((n) => /slow-4g preset.*not a real radio link/.test(n)));
  assert.ok(!shaped.some((n) => /without network throttling/.test(n)));
  assert.equal(validateScript({ steps: [{ type: 'tap', selector: '#a' }] }).steps.length, 1);
  assert.throws(() => validateScript({ steps: [{ type: 'tap' }] }), /"selector" is required/);
});

// ---- Runner -----------------------------------------------------------------------------------
function findPlaywright() {
  const dir = process.env.PLAYWRIGHT_PROJECT;
  if (!dir) return null;
  const req = createRequire(path.resolve(dir, 'package.json'));
  for (const m of ['@playwright/test', 'playwright']) { try { req.resolve(m); return dir; } catch {} }
  return null;
}
const pw = findPlaywright();
const skip = pw ? false : 'set PLAYWRIGHT_PROJECT to a folder with playwright installed to run the browser bench';

function exec(scriptPath, args) {
  return new Promise((resolve) => {
    execFile(process.execPath, [scriptPath, ...args], { maxBuffer: 1 << 26, timeout: 240000 }, (err, stdout, stderr) => {
      let report = null;
      try { report = JSON.parse(stdout); } catch {}
      resolve({ code: err ? err.code : 0, report, stderr });
    });
  });
}
const tmp = (n) => fs.mkdtempSync(path.join(os.tmpdir(), `pb-${n}-`));

test('usage errors exit 1 before any browser starts', async () => {
  assert.equal((await exec(bench, [])).code, 1);
  const remote = await exec(bench, ['--url', 'https://example.com']);
  assert.equal(remote.code, 1);
  assert.match(remote.stderr, /refusing a remote URL/);
  assert.equal((await exec(bench, ['--url', fixture('clean.html'), '--runs', '0'])).code, 1);
  assert.equal((await exec(bench, ['--url', fixture('clean.html'), '--tiers', 'turbo'])).code, 1);
  assert.match((await exec(bench, ['--url', fixture('clean.html'), '--script', fx('missing.json')])).stderr, /cannot read interaction script/);
  assert.match((await exec(bench, ['--url', fixture('clean.html'), '--browser', 'netscape'])).stderr, /--browser must be one of chromium, firefox, webkit/);
  assert.match((await exec(bench, ['--url', fixture('clean.html'), '--network', 'dialup'])).stderr, /--network must be one of/);
  const ffCpu = await exec(bench, ['--url', fixture('clean.html'), '--browser', 'firefox', '--cpu', '4']);
  assert.equal(ffCpu.code, 1);
  assert.match(ffCpu.stderr, /only Chromium can slow the processor/);
  assert.match((await exec(bench, ['--url', fixture('clean.html'), '--browser', 'webkit', '--network', '3g'])).stderr, /only Chromium can shape the network/);
  assert.match((await exec(bench, ['--url', fixture('clean.html'), '--baseline', fx('click.json')])).stderr, /not an experience-bench/);
});

test('without Playwright the bench says nothing was measured and exits 2', async () => {
  const r = await exec(audit, ['--perf', '--url', fixture('clean.html'), '--project', tmp('nopw')]);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /Nothing was measured/);
});

const baselineFile = path.join(tmp('base'), 'baseline.json');
const common = ['--project', pw, '--viewports', 'desktop=1280x800', '--runs', '3', '--script', fx('click.json'), '--repeats', '5', '--settle', '700', '--json'];
const cleanRun = pw ? exec(audit, ['--perf', '--url', fixture('clean.html'), ...common, '--tiers', 'default,low', '--out', tmp('clean'), '--save-baseline', baselineFile]) : null;

test('a quiet page measures clean, through visual-audit --perf, with every caveat stated', { skip }, async () => {
  const { code, report } = await cleanRun;
  assert.equal(code, 0);
  assert.equal(report.schema, SCHEMA);
  assert.equal(report.kind, 'lab');
  assert.equal(report.status, 'measured');
  assert.ok(report.environment.browserVersion);
  assert.deepEqual(report.conditions.map((c) => c.id), ['desktop.dark.cpu1x.motion', 'desktop.dark.cpu1x.motion.tier-low']);
  const s = report.conditions[0].summary;
  assert.equal(s.lcp.n, 3);
  assert.ok(s.lcp.median > 0 && s.lcp.median < 2500);
  assert.equal(s.cls.median, 0);
  assert.equal(s.longTaskTotal.median, 0);
  assert.ok(s.heapUsed.median > 0);
  assert.ok(s.heapGrowth.median < 65536, `a page that keeps nothing must not look like a leak (${s.heapGrowth.median} bytes per repeat)`);
  assert.ok(s.frameP50.median > 0);
  assert.equal(s.bytesTotal.median, fs.statSync(fx('clean.html')).size);
  assert.equal(report.bytesKind, 'decoded');
  assert.equal(report.conditions[0].tierObserved, 'high');
  assert.equal(report.conditions[1].tierObserved, 'low', 'the ?quality= override reached the page');
  assert.ok(!report.notes.some((n) => /asked for tier/.test(n)));
  assert.ok(report.notValidated.some((n) => /Field performance/.test(n)));
  assert.equal(report.budget.breaches.length, 0);
  assert.equal(JSON.parse(fs.readFileSync(baselineFile, 'utf8')).schema, SCHEMA);
});

test('planted defects are measured: slow interaction, long tasks, layout shift and a leak', { skip }, async () => {
  await cleanRun;
  const { code, report } = await exec(bench, ['--url', fixture('slow.html'), ...common, '--out', tmp('slow'), '--baseline', baselineFile, '--tiers', 'default,low']);
  assert.equal(code, 3);
  assert.equal(report.status, 'over budget');
  const s = report.conditions[0].summary;
  assert.ok(s.inp.median >= 280, `INP ${s.inp.median}`);
  assert.ok(s.longTaskTotal.median >= 1500, `long task time ${s.longTaskTotal.median}`);
  assert.ok(s.loafWorst.median >= 280);
  assert.ok(s.cls.median > 0.005, `CLS ${s.cls.median}`);
  const shift = report.conditions[0].runs[0].shifts[0];
  assert.ok(shift && shift.value > 0.005 && shift.moved.length > 0, `a layout shift names what moved: ${JSON.stringify(shift)}`);
  assert.ok(shift.moved.every((n) => typeof n === 'string' && n.length > 0));
  assert.ok(shift.by.length === shift.moved.length && shift.by.some(([x, y]) => x !== 0 || y !== 0), `and by how far: ${JSON.stringify(shift.by)}`);
  assert.ok(s.heapGrowth.median > 400000, `heap growth ${s.heapGrowth.median}`);
  assert.ok(s.droppedPct.median > 20);
  assert.ok(report.budget.breaches.some((b) => b.metric === 'inp'));
  assert.equal(report.comparison.verdict, 'regressed');
  for (const m of ['inp', 'longTaskTotal', 'heapGrowth', 'cls']) assert.ok(report.comparison.conditions[0].regressed.includes(m), `${m} should be reported as regressed`);
  assert.ok(report.notes.some((n) => /asked for tier "low"/.test(n)), 'a page that ignores ?quality= is called out');
});

test('an accepted trade-off moves the budget but a regression against the baseline still fails', { skip }, async () => {
  await cleanRun;
  const { code, report } = await exec(bench, ['--url', fixture('slow.html'), ...common, '--runs', '2', '--out', tmp('traded'), '--baseline', baselineFile, '--budget', fx('budget-loose.json')]);
  assert.equal(report.budget.breaches.length, 0);
  assert.equal(report.status, 'regressed against the baseline');
  assert.equal(code, 3);
});

test('the same page measured twice is not reported as a change', { skip }, async () => {
  await cleanRun;
  const { code, report } = await exec(bench, ['--url', fixture('clean.html'), ...common, '--out', tmp('again'), '--baseline', baselineFile]);
  assert.equal(code, 0);
  assert.equal(report.comparison.comparable, true);
  const c = report.comparison.conditions[0];
  for (const m of c.metrics.filter((x) => ['inp', 'cls', 'longTaskTotal', 'heapGrowth', 'bytesTotal', 'droppedPct'].includes(x.metric))) assert.equal(m.verdict, 'no measurable change', `${m.metric}: ${m.before} -> ${m.after}`);
  assert.notEqual(report.comparison.verdict, 'regressed');
});

test('a page that cannot load is incomplete, exits 2 and never becomes a baseline', { skip }, async () => {
  const saved = path.join(tmp('nobase'), 'b.json');
  const { code, report, stderr } = await exec(bench, ['--url', fixture('does-not-exist.html'), '--project', pw, '--runs', '2', '--settle', '0', '--frames', '0', '--json', '--out', tmp('missing'), '--save-baseline', saved]);
  assert.equal(code, 2);
  assert.equal(report.status, 'incomplete');
  assert.equal(report.conditions[0].completed, 0);
  assert.equal(report.conditions[0].summary.lcp.median, null);
  assert.ok(report.conditions[0].errors.length === 2);
  assert.match(stderr, /baseline not saved/);
  assert.equal(fs.existsSync(saved), false);
});

test('a script that leaves the page fails the run instead of reporting no interaction', { skip }, async () => {
  const { code, report } = await exec(bench, ['--url', fixture('leaves.html'), '--project', pw, '--runs', '2', '--settle', '0', '--script', fx('leave.json'), '--json', '--out', tmp('leave')]);
  assert.equal(code, 2);
  assert.equal(report.status, 'incomplete');
  assert.equal(report.conditions[0].completed, 0);
  assert.match(report.conditions[0].errors[0], /left the page at step 3 \(click #out\).*clean\.html/);
});

test('report: names what shifted, how far and in how many runs, and says when the network was shaped', () => {
  const shifted = run({ cls: 0.345, shifts: [{ at: 506, value: 0.345, moved: ['main', 'a.card'], by: [[0, 212], [0, 212]] }] });
  const c = { ...condition('a', [run(), shifted, run()]), runs: [run(), shifted, run()] };
  const md = renderBenchMarkdown({ ...rep([c], { network: 'slow-4g' }), status: 'measured' });
  assert.match(md, /Layout shifts:\n- main, a\.card: up to 0\.345 at 506 ms, moved 0px across and 212px down, in 1 of 3 run\(s\)/);
  assert.match(md, /network: shaped to the slow-4g preset/);
  const quiet = renderBenchMarkdown({ ...rep([condition('a', [run(), run(), run()])], { browser: 'firefox' }), status: 'measured' });
  assert.doesNotMatch(quiet, /Layout shifts/);
  assert.match(quiet, /CPU throttle: not available in this engine; network: unthrottled/);
});

test('observed frame timing drift is reported across runs without inferring a display change', () => {
  const at = (interval) => run({ frames: { p50: interval, p95: interval, worst: interval, droppedPct: 0, interval } });
  const steady = [{ id: 'a', runs: [at(3.2), at(3.3), { error: 'x' }] }, { id: 'b', runs: [at(3.2)] }];
  assert.deepEqual(frameRateDrift(steady), []);
  const [note] = frameRateDrift([...steady, { id: 'static', runs: [at(33.2), at(33.2)] }]);
  assert.match(note, /from 3\.2 ms to 33\.2 ms \(313 to 30 frames a second\)/);
  assert.match(note, /Slower in: static\./);
  assert.deepEqual(frameRateDrift([{ id: 'a', runs: [run({ frames: { interval: null } })] }]), [], 'no frame data is not a drift');
});

test('sustained page overload can cause timing drift without making measured INP incomparable', () => {
  const at = (interval, inp) => run({ inp, frames: frameStats(Array.from({ length: 120 }, (_, i) => i * interval)) });
  const runs = [at(16.7, 32), at(16.7, 32), at(16.7, 32)];
  const overloaded = [at(50, 240), at(50, 240), at(50, 240)];
  const conditions = [{ ...condition('static', runs), runs }, { ...condition('ultra', overloaded), runs: overloaded }];
  const notes = frameRateDrift(conditions);
  assert.equal(notes.length, 1);
  assert.match(notes[0], /observed frame timing drift/i);
  assert.match(notes[0], /cause.*unknown/i);
  assert.match(notes[0], /page (load|workload)/i);
  assert.doesNotMatch(notes[0], /refresh interval changed|screen.*changed|INP.*not comparable/i);
  assert.equal(conditions[1].summary.inp.median, 240, 'measured INP stays measured');
  const md = renderBenchMarkdown({ ...rep(conditions), status: 'measured', notes });
  assert.match(md, /cause.*unknown/i);
  assert.doesNotMatch(md, /INP.*not comparable/i);
});

test('Lantern tier evidence states unknown included run counts when raw reports are unavailable', () => {
  const readme = fs.readFileSync(path.join(root, 'demos/experience/README.md'), 'utf8');
  const caveat = readme.match(/Lantern `high` and `balanced`[\s\S]*?(?=\n\nWeight)/)?.[0];
  assert.ok(caveat, 'the measured tier caveat must be present');
  assert.match(caveat, /included run counts are unknown/i);
  assert.match(caveat, /raw.*reports.*(missing|unavailable|not present)/i);
  assert.doesNotMatch(caveat, /are [34] of 5 runs/);
});
