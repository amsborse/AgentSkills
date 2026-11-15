// Pure logic for the experience bench (perf-bench.mjs). No browser, no I/O: everything here is
// unit-tested in tests/perf-bench.test.mjs. Numbers the bench cannot measure stay null; null is
// never treated as 0, as a pass, or as "no change".

import fs from 'node:fs';
import path from 'node:path';

export const SCHEMA = 'experience-bench/1';
export const TIERS = ['ultra', 'high', 'balanced', 'low', 'static'];
export const MOTIONS = ['no-preference', 'reduce'];

// Every metric is "lower is better". `floor` is the smallest absolute difference worth reporting
// (timer resolution, rounding of Event Timing to 8 ms, GC jitter); `rel` is the smallest relative
// one. A difference has to clear both floors and the measured spread to count as a change.
export const METRICS = {
  lcp: { label: 'LCP', unit: 'ms', floor: 50, rel: 0.05 },
  fcp: { label: 'FCP', unit: 'ms', floor: 50, rel: 0.05 },
  ttfb: { label: 'TTFB', unit: 'ms', floor: 20, rel: 0.05 },
  load: { label: 'Load event', unit: 'ms', floor: 50, rel: 0.05 },
  cls: { label: 'CLS', unit: '', floor: 0.01, rel: 0.05 },
  inp: { label: 'INP', unit: 'ms', floor: 16, rel: 0.1 },
  longTaskTotal: { label: 'Long task time', unit: 'ms', floor: 50, rel: 0.1 },
  longTaskCount: { label: 'Long tasks', unit: '', floor: 1, rel: 0.1 },
  loafWorst: { label: 'Worst long animation frame', unit: 'ms', floor: 16, rel: 0.1 },
  frameP50: { label: 'Frame gap p50', unit: 'ms', floor: 1, rel: 0.05 },
  frameP95: { label: 'Frame gap p95', unit: 'ms', floor: 4, rel: 0.1 },
  frameWorst: { label: 'Worst frame gap', unit: 'ms', floor: 16, rel: 0.15 },
  droppedPct: { label: 'Dropped frames', unit: '%', floor: 2, rel: 0.1 },
  heapUsed: { label: 'JS heap after GC', unit: 'bytes', floor: 262144, rel: 0.05 },
  heapGrowth: { label: 'Heap growth per repeat', unit: 'bytes', floor: 65536, rel: 0.1 },
  bytesTotal: { label: 'Bytes loaded', unit: 'bytes', floor: 1024, rel: 0.01 },
  bytesScript: { label: 'Script bytes', unit: 'bytes', floor: 512, rel: 0.01 },
  bytesImage: { label: 'Image bytes', unit: 'bytes', floor: 1024, rel: 0.01 },
  requests: { label: 'Requests', unit: '', floor: 1, rel: 0 },
};

// Core Web Vitals "good" thresholds (https://web.dev/articles/vitals). They are defined for the
// 75th percentile of field data; applied to a lab run they are indicative only.
export const DEFAULT_BUDGET = { lcp: 2500, inp: 200, cls: 0.1 };

const num = (v) => typeof v === 'number' && Number.isFinite(v);

export function parseList(spec, allowed, name) {
  const items = String(spec ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!items.length) throw new Error(`--${name} needs at least one value`);
  if (allowed) for (const i of items) if (!allowed.includes(i)) throw new Error(`--${name}: "${i}" is not one of ${allowed.join(', ')}`);
  return [...new Set(items)];
}

export function parseCpu(spec) {
  const rates = parseList(spec, null, 'cpu').map((s) => Number(s.replace(/x$/i, '')));
  if (rates.some((r) => !num(r) || r < 1 || r > 20)) throw new Error('--cpu takes slowdown rates between 1 and 20, e.g. 1,4');
  return rates;
}

// The run matrix. Tier "default" means "leave the page alone" (no ?quality= override).
export function buildMatrix({ viewports, themes, cpu, motions, tiers }) {
  const cells = [];
  for (const vp of viewports) for (const theme of themes) for (const rate of cpu) for (const motion of motions) for (const tier of tiers) {
    cells.push({ id: [vp.name, theme, `cpu${rate}x`, motion === 'reduce' ? 'reduced-motion' : 'motion', tier === 'default' ? null : `tier-${tier}`].filter(Boolean).join('.'), viewport: vp, theme, cpu: rate, motion, tier });
  }
  return cells;
}

export function withTier(url, tier, param = 'quality') {
  if (!tier || tier === 'default') return url;
  const u = new URL(url);
  u.searchParams.set(param, tier);
  return u.href;
}

// ---- Interaction scripts --------------------------------------------------------------------
// A script is a list of steps replayed with real input events, so the same gesture can be
// measured before and after a change. Coordinates are fractions of the viewport (0..1).
const STEP_TYPES = {
  wait: { ms: 'number' },
  scroll: { by: 'number', duration: 'number?' },
  move: { path: 'points', duration: 'number?' },
  hover: { selector: 'string' },
  click: { selector: 'string' },
  press: { key: 'string' },
  type: { selector: 'string', text: 'string' },
  drag: { from: 'point', to: 'point', duration: 'number?' },
  tab: { count: 'number?' },
  tap: { selector: 'string' },
};

export const BROWSERS = ['chromium', 'firefox', 'webkit'];
// Chrome DevTools presets (bytes per second, round-trip ms), as Lighthouse and DevTools use them.
export const NETWORKS = {
  'slow-4g': { downloadThroughput: 1.6e6 / 8 * 0.9, uploadThroughput: 750e3 / 8 * 0.9, latency: 150 * 3.75 },
  'fast-4g': { downloadThroughput: 9e6 / 8 * 0.9, uploadThroughput: 1.5e6 / 8 * 0.9, latency: 60 * 2.75 },
  '3g': { downloadThroughput: 500e3 / 8 * 0.8, uploadThroughput: 500e3 / 8 * 0.8, latency: 400 * 5 },
};
const isPoint = (p) => Array.isArray(p) && p.length === 2 && p.every((n) => num(n) && n >= 0 && n <= 1);

export function validateScript(script) {
  if (!script || typeof script !== 'object' || !Array.isArray(script.steps) || !script.steps.length) throw new Error('interaction script needs a non-empty "steps" array');
  script.steps.forEach((step, i) => {
    const spec = STEP_TYPES[step?.type];
    if (!spec) throw new Error(`step ${i + 1}: unknown type "${step?.type}" (use ${Object.keys(STEP_TYPES).join(', ')})`);
    for (const [key, kindRaw] of Object.entries(spec)) {
      const optional = kindRaw.endsWith('?');
      const kind = kindRaw.replace('?', '');
      const v = step[key];
      if (v === undefined) { if (optional) continue; throw new Error(`step ${i + 1} (${step.type}): "${key}" is required`); }
      const good = kind === 'number' ? num(v) : kind === 'string' ? typeof v === 'string' && v.length > 0 : kind === 'point' ? isPoint(v) : kind === 'points' ? Array.isArray(v) && v.length >= 2 && v.every(isPoint) : false;
      if (!good) throw new Error(`step ${i + 1} (${step.type}): "${key}" must be ${kind === 'point' ? 'a [x, y] pair of viewport fractions' : kind === 'points' ? 'a list of at least two [x, y] viewport fractions' : `a ${kind}`}`);
    }
  });
  return { name: typeof script.name === 'string' ? script.name : 'interaction', steps: script.steps };
}

// Points along a polyline at a steady pace: one point per ~16 ms of the requested duration.
export function samplePath(points, duration = 600, stepMs = 16) {
  const n = Math.max(2, Math.round(duration / stepMs));
  const lens = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) { const d = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]); lens.push(d); total += d; }
  const out = [];
  for (let k = 0; k <= n; k++) {
    let dist = total * (k / n);
    let seg = 0;
    while (seg < lens.length - 1 && dist > lens[seg]) { dist -= lens[seg]; seg++; }
    const t = lens[seg] ? Math.min(1, dist / lens[seg]) : 0;
    out.push([points[seg][0] + (points[seg + 1][0] - points[seg][0]) * t, points[seg][1] + (points[seg + 1][1] - points[seg][1]) * t]);
  }
  return out;
}

// ---- Statistics -----------------------------------------------------------------------------
export function median(values) {
  const v = values.filter(num).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function percentile(values, p) {
  const v = values.filter(num).sort((a, b) => a - b);
  if (!v.length) return null;
  const idx = (v.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return v[lo] + (v[hi] - v[lo]) * (idx - lo);
}

// Median with the observed spread. n is how many runs actually produced the number.
export function stat(values) {
  const v = values.filter(num);
  if (!v.length) return { median: null, min: null, max: null, n: 0 };
  return { median: median(v), min: Math.min(...v), max: Math.max(...v), n: v.length };
}

// Frame pacing from requestAnimationFrame timestamps. The refresh interval is estimated from
// the fastest gaps instead of assumed, so a 120 Hz display is not reported as half dropped.
export function frameStats(timestamps) {
  if (!Array.isArray(timestamps) || timestamps.length < 10) return { frames: timestamps?.length ?? 0, p50: null, p95: null, worst: null, interval: null, droppedPct: null, fps: null };
  const gaps = [];
  for (let i = 1; i < timestamps.length; i++) gaps.push(timestamps[i] - timestamps[i - 1]);
  const interval = Math.max(1, percentile(gaps, 0.1));
  let dropped = 0;
  for (const g of gaps) dropped += Math.max(0, Math.round(g / interval) - 1);
  const span = timestamps[timestamps.length - 1] - timestamps[0];
  return {
    frames: timestamps.length,
    p50: percentile(gaps, 0.5),
    p95: percentile(gaps, 0.95),
    worst: Math.max(...gaps),
    interval,
    droppedPct: (dropped / (dropped + gaps.length)) * 100,
    fps: span > 0 ? (gaps.length / span) * 1000 : null,
  };
}

// The shortest common gap between frames is the screen's refresh interval. When it differs
// between runs, the screen or the browser changed its rate part-way (power saving, a display
// that went to sleep, a window that was covered): frame pacing and INP from the two halves cannot
// be compared, and a slow half must not be read as a slow page. Returns notes, empty when steady.
export function frameRateDrift(conditions) {
  const seen = [];
  for (const c of conditions || []) for (const r of c.runs || []) if (!r.error && r.frames?.interval) seen.push({ id: c.id, interval: r.frames.interval });
  if (seen.length < 2) return [];
  const lo = Math.min(...seen.map((x) => x.interval)), hi = Math.max(...seen.map((x) => x.interval));
  if (hi / lo < 1.5) return [];
  const slow = [...new Set(seen.filter((x) => x.interval / lo >= 1.5).map((x) => x.id))];
  return [`The refresh interval changed during the measurement, from ${lo.toFixed(1)} ms to ${hi.toFixed(1)} ms (${Math.round(1000 / lo)} to ${Math.round(1000 / hi)} frames a second). Frame pacing and INP are not comparable across these runs; keep the screen awake and the window uncovered, then measure again. Slower in: ${slow.join(', ')}.`];
}

// INP for a short lab session: the worst interaction, skipping one outlier per 50 interactions.
// `count` is the page's own interaction count: only interactions of 16 ms or more are observed,
// so the rank is taken against all of them. Null when nothing was interacted with, or when the
// ranked interaction was too fast to be observed (below 16 ms, exact value unknown). Never 0.
export function inpFrom(durations, count) {
  const v = (durations || []).filter(num).sort((a, b) => b - a);
  if (!v.length) return null;
  const rank = Math.floor(Math.max(v.length, num(count) ? count : 0) / 50);
  return rank < v.length ? v[rank] : null;
}

// Page weight from the requests seen. One request of unknown size makes the total unknown: a
// partial sum would read as a lighter page than it is.
export function tallyBytes(requests) {
  const byType = {};
  let total = 0;
  let unsized = 0;
  for (const r of requests) {
    if (!num(r.bytes)) { unsized++; continue; }
    byType[r.type] = (byType[r.type] || 0) + r.bytes;
    total += r.bytes;
  }
  return { total: requests.length && !unsized ? total : null, byType, unsized };
}

// Least-squares slope of heap size over repeats of the same scenario, ignoring the first sample
// (warm-up allocations are not a leak). Needs three samples after warm-up; otherwise unknown.
export function heapGrowth(series) {
  const v = (series || []).filter(num).slice(1);
  if (v.length < 3) return null;
  const n = v.length;
  const mx = (n - 1) / 2;
  const my = v.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  v.forEach((y, x) => { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; });
  return sxy / sxx;
}

// One flat record of numbers per run; this is what gets summarized and compared.
export function flattenRun(run) {
  const f = run.frames || {};
  const b = run.bytes || {};
  return {
    lcp: run.lcp ?? null, fcp: run.fcp ?? null, ttfb: run.ttfb ?? null, load: run.load ?? null, cls: run.cls ?? null, inp: run.inp ?? null,
    longTaskTotal: run.longTasks?.total ?? null, longTaskCount: run.longTasks?.count ?? null, loafWorst: run.loaf?.worst ?? null,
    frameP50: f.p50 ?? null, frameP95: f.p95 ?? null, frameWorst: f.worst ?? null, droppedPct: f.droppedPct ?? null,
    heapUsed: run.heap?.used ?? null, heapGrowth: run.heap?.growth ?? null,
    bytesTotal: b.total ?? null, bytesScript: num(b.total) ? b.byType?.script ?? 0 : null, bytesImage: num(b.total) ? b.byType?.image ?? 0 : null, requests: b.requests ?? null,
  };
}

export function summarizeRuns(runs) {
  const okRuns = runs.filter((r) => !r.error);
  const flat = okRuns.map(flattenRun);
  const summary = {};
  for (const key of Object.keys(METRICS)) summary[key] = stat(flat.map((r) => r[key]));
  return { summary, completed: okRuns.length, failed: runs.length - okRuns.length };
}

// A condition counts only when most of its runs completed; a half-measured cell is incomplete.
export const conditionComplete = (completed, requested) => completed >= Math.max(1, Math.ceil(requested / 2));

// ---- Comparison -----------------------------------------------------------------------------
// The noise band is the larger of: half the range seen in either set of runs, the metric's
// absolute floor, and its relative floor. Inside the band the verdict is "no measurable change".
export function compareStat(key, before, after) {
  const m = METRICS[key];
  if (!before || !after || !num(before.median) || !num(after.median)) return { metric: key, verdict: 'unknown', before: before?.median ?? null, after: after?.median ?? null, delta: null, noise: null };
  const half = (s) => (s.n > 1 ? (s.max - s.min) / 2 : 0);
  const noise = Math.max(half(before), half(after), m.floor, Math.abs(before.median) * m.rel);
  const delta = after.median - before.median;
  const single = before.n < 2 || after.n < 2;
  const verdict = Math.abs(delta) <= noise ? 'no measurable change' : delta < 0 ? 'improved' : 'regressed';
  return { metric: key, verdict, before: before.median, after: after.median, delta, noise, ...(single ? { caution: 'single run on one side: spread unknown, verdict rests on the floor only' } : {}) };
}

export function compareReports(baseline, candidate) {
  if (baseline?.schema !== SCHEMA || candidate?.schema !== SCHEMA) throw new Error(`both reports must have schema ${SCHEMA}`);
  const byId = new Map(baseline.conditions.map((c) => [c.id, c]));
  const conditions = [];
  for (const c of candidate.conditions) {
    const b = byId.get(c.id);
    if (!b) { conditions.push({ id: c.id, verdict: 'unknown', reason: 'condition missing from the baseline', metrics: [] }); continue; }
    if (!b.complete || !c.complete) { conditions.push({ id: c.id, verdict: 'unknown', reason: 'incomplete runs on one side', metrics: [] }); continue; }
    const metrics = Object.keys(METRICS).map((k) => compareStat(k, b.summary[k], c.summary[k]));
    const regressed = metrics.filter((m) => m.verdict === 'regressed').map((m) => m.metric);
    const improved = metrics.filter((m) => m.verdict === 'improved').map((m) => m.metric);
    conditions.push({ id: c.id, verdict: regressed.length ? 'regressed' : improved.length ? 'improved' : 'no measurable change', regressed, improved, metrics });
  }
  const missing = baseline.conditions.filter((b) => !candidate.conditions.some((c) => c.id === b.id)).map((b) => b.id);
  const any = (v) => conditions.some((c) => c.verdict === v);
  const sameEnv = envKey(baseline.environment) === envKey(candidate.environment);
  return {
    verdict: any('regressed') ? 'regressed' : any('unknown') || missing.length ? (any('improved') ? 'improved, with unknowns' : 'unknown') : any('improved') ? 'improved' : 'no measurable change',
    comparable: sameEnv,
    ...(sameEnv ? {} : { warning: 'baseline and candidate were measured in different environments (browser, renderer, headed mode or machine); the comparison is not like for like' }),
    missingConditions: missing,
    conditions,
  };
}

export const envKey = (e) => [e?.browserVersion, e?.renderer, e?.headed, e?.cpuModel, e?.platform].join('|');

// ---- Budgets --------------------------------------------------------------------------------
// budget file: { "budgets": { "lcp": 2500, ... }, "tradeoffs": [{ "metric", "condition"?, "limit", "reason", "date" }] }
// An accepted trade-off raises the limit for one metric, and has to say why and when.
export function validateBudget(file) {
  if (!file || typeof file !== 'object' || !file.budgets || typeof file.budgets !== 'object') throw new Error('budget file needs a "budgets" object');
  for (const [k, v] of Object.entries(file.budgets)) {
    if (!METRICS[k]) throw new Error(`budget: unknown metric "${k}" (known: ${Object.keys(METRICS).join(', ')})`);
    if (!num(v) || v < 0) throw new Error(`budget: "${k}" must be a non-negative number`);
  }
  for (const t of file.tradeoffs || []) {
    if (!METRICS[t.metric] || !num(t.limit) || !t.reason || !t.date) throw new Error('budget: every trade-off needs metric, limit, reason and date');
  }
  return { budgets: file.budgets, tradeoffs: file.tradeoffs || [] };
}

export function checkBudget(conditions, budget, { isDefault = false } = {}) {
  const breaches = [];
  const unmeasured = [];
  for (const c of conditions) {
    for (const [metric, base] of Object.entries(budget.budgets)) {
      const t = (budget.tradeoffs || []).find((x) => x.metric === metric && (!x.condition || x.condition === c.id));
      const limit = t ? Math.max(base, t.limit) : base;
      const value = c.summary?.[metric]?.median;
      if (!num(value)) { unmeasured.push({ condition: c.id, metric }); continue; }
      if (value > limit) breaches.push({ condition: c.id, metric, value, limit, ...(t ? { tradeoff: t.reason } : {}) });
    }
  }
  return { source: isDefault ? 'default (Core Web Vitals "good" thresholds, indicative for lab data)' : 'project budget file', budgets: budget.budgets, tradeoffs: budget.tradeoffs || [], breaches, unmeasured, isDefault };
}

// ---- Report ---------------------------------------------------------------------------------
// What a local lab run can never tell you. Printed in every report so a clean run is not read
// as "fast for real users".
export function notValidated(env, opts = {}) {
  const list = [
    'Field performance: these are lab numbers from one machine, not the 75th percentile of real users.',
    'Real mobile hardware, GPU thermals and battery: CPU throttling slows JavaScript only, it does not emulate a phone GPU.',
    'Energy use and GPU memory: no scriptable measurement exists.',
  ];
  const b = env?.browser || 'chromium';
  if (b === 'chromium') list.push('Safari and Firefox: this run measured Chromium only. Re-run with --browser firefox or webkit for those engines.');
  else list.push(`${b === 'webkit' ? 'Safari: Playwright WebKit is the engine, not the Safari app or an iPhone' : 'Firefox: the Playwright build of the engine'}. Metrics this engine does not report (layout shift, long tasks, heap, sometimes LCP and INP) are unknown, not zero; CPU and network shaping are unavailable.`);
  list.push(env?.network ? `Network: shaped to the ${env.network} preset in the browser, which is not a real radio link.` : 'Network conditions: loaded locally without network throttling.');
  if (!env?.headed) list.push('Frame pacing ran headless: requestAnimationFrame timing without a display is not proven to match a real screen. Re-run with --headed for frame numbers you intend to quote.');
  if (/swiftshader|software|llvmpipe|basic render/i.test(env?.renderer || '')) list.push(`Software renderer (${env.renderer}): frame numbers say nothing about real GPUs.`);
  if (!env?.renderer) list.push('GPU renderer could not be read (WebGL unavailable): rendering path unknown.');
  if (!opts.script) list.push('No interaction script: INP and interaction frame pacing were not measured.');
  if (!opts.repeats || opts.repeats < 4) list.push('Memory growth: needs --repeats 4 or more with an interaction script; not measured.');
  if (opts.bytesKind === 'decoded') list.push('Transfer size: file:// pages have no transfer encoding, so byte counts are decoded sizes, not compressed transfer sizes.');
  return list;
}

const fmt = (key, v) => {
  if (!num(v)) return 'unknown';
  const u = METRICS[key].unit;
  if (u === 'bytes') return v >= 1048576 ? `${(v / 1048576).toFixed(2)} MB` : `${(v / 1024).toFixed(1)} KB`;
  if (key === 'cls') return v.toFixed(3);
  if (u === '%') return `${v.toFixed(1)}%`;
  return `${Math.round(v * 10) / 10}${u ? ` ${u}` : ''}`;
};
export const formatMetric = fmt;

const SHOWN = ['lcp', 'fcp', 'cls', 'inp', 'longTaskTotal', 'loafWorst', 'frameP95', 'droppedPct', 'heapUsed', 'heapGrowth', 'bytesTotal', 'bytesScript', 'requests'];

export function renderBenchMarkdown(report) {
  const e = report.environment;
  const lines = [
    `# Experience bench: ${report.url}`,
    '',
    `**Lab data, not field data.** ${report.runsPerCondition} run(s) per condition; each number is the median, shown with the observed range.`,
    '',
    `- Browser: ${e.browser} ${e.browserVersion} (${e.headed ? 'headed' : 'headless'})`,
    `- Renderer: ${e.renderer || 'unknown'}`,
    `- Machine: ${e.cpuModel || 'unknown CPU'}, ${e.cpuCount ?? '?'} threads, ${e.platform}`,
    `- CPU throttle: ${e.browser && e.browser !== 'chromium' ? 'not available in this engine' : 'Chrome DevTools Protocol slowdown rate per condition'}; network: ${e.network ? `shaped to the ${e.network} preset` : 'unthrottled'}`,
    `- Vitals source: ${report.vitalsSource}`,
    `- Interaction: ${report.script ? `"${report.script.name}", ${report.script.steps} step(s), repeated ${report.repeats}x per run` : 'none'}`,
    `- Result: **${report.status}**`,
    '',
  ];
  for (const c of report.conditions) {
    lines.push(`## ${c.id}${c.complete ? '' : ' (incomplete)'}`, '', `${c.completed} of ${report.runsPerCondition} runs completed.${c.errors?.length ? ` Errors: ${[...new Set(c.errors)].join('; ')}` : ''}`, '', '| Metric | Median | Range | Runs |', '|---|---|---|---|');
    for (const k of SHOWN) {
      const s = c.summary[k];
      lines.push(`| ${METRICS[k].label} | ${fmt(k, s.median)} | ${s.n ? `${fmt(k, s.min)} to ${fmt(k, s.max)}` : '-'} | ${s.n} |`);
    }
    // Which element moved, how far and in how many runs: a shift in one run of five is noise to
    // chase, the same shift in every run is a defect.
    const seen = new Map();
    (c.runs || []).forEach((r, i) => (r.shifts || []).forEach((sh) => {
      const key = (sh.moved || []).join(', ') || 'unknown element';
      const x = seen.get(key) || { runs: new Set(), worst: 0, by: null, at: sh.at };
      x.runs.add(i);
      if (sh.value >= x.worst) { x.worst = sh.value; x.by = sh.by?.[0] || null; x.at = sh.at; }
      seen.set(key, x);
    }));
    if (seen.size) {
      lines.push('', 'Layout shifts:');
      for (const [key, x] of seen) lines.push(`- ${key}: up to ${x.worst} at ${x.at} ms${x.by ? `, moved ${x.by[0]}px across and ${x.by[1]}px down` : ''}, in ${x.runs.size} of ${c.completed} run(s)`);
    }
    lines.push('');
  }
  if (report.budget) {
    lines.push('## Budget', '', `Source: ${report.budget.source}.`, '');
    if (!report.budget.breaches.length) lines.push('No measured metric is over budget.');
    for (const b of report.budget.breaches) lines.push(`- **Over budget** ${b.condition}: ${METRICS[b.metric].label} ${fmt(b.metric, b.value)} > ${fmt(b.metric, b.limit)}`);
    if (report.budget.unmeasured.length) lines.push(`- Not measured, so not checked: ${[...new Set(report.budget.unmeasured.map((u) => METRICS[u.metric].label))].join(', ')}`);
    lines.push('');
  }
  if (report.comparison) {
    const cmp = report.comparison;
    lines.push('## Compared with the baseline', '', `Overall: **${cmp.verdict}**.${cmp.warning ? ` Warning: ${cmp.warning}.` : ''}`, '');
    for (const c of cmp.conditions) {
      lines.push(`- ${c.id}: ${c.verdict}${c.reason ? ` (${c.reason})` : ''}`);
      for (const m of c.metrics.filter((x) => x.verdict === 'improved' || x.verdict === 'regressed')) lines.push(`  - ${METRICS[m.metric].label}: ${fmt(m.metric, m.before)} -> ${fmt(m.metric, m.after)} (${m.verdict}; noise band ±${fmt(m.metric, m.noise)})`);
    }
    if (cmp.missingConditions.length) lines.push(`- In the baseline but not measured now: ${cmp.missingConditions.join(', ')}`);
    lines.push('');
  }
  if (report.notes?.length) lines.push('## Notes', '', ...report.notes.map((n) => `- ${n}`), '');
  lines.push('## Not validated', '', ...report.notValidated.map((n) => `- ${n}`), '');
  return lines.join('\n');
}

// Exit code: 2 incomplete beats 3 (breach or regression) because an incomplete run proves nothing.
// A project's own budget that could not be evaluated is incomplete too: the project asked for
// that metric to be checked. The built-in budget is indicative, so its gaps are only reported.
export function benchStatus(report) {
  if (!report.conditions.length || report.conditions.some((c) => !c.complete)) return { status: 'incomplete', code: 2 };
  const b = report.budget;
  if (b && b.isDefault === false && b.unmeasured?.length) {
    return { status: `incomplete: budgeted metrics not measured (${[...new Set(b.unmeasured.map((u) => METRICS[u.metric]?.label || u.metric))].join(', ')})`, code: 2 };
  }
  if (report.budget?.breaches.length) return { status: 'over budget', code: 3 };
  if (report.comparison?.verdict === 'regressed') return { status: 'regressed against the baseline', code: 3 };
  return { status: 'measured', code: 0 };
}

/**
 * Finds the optional web-vitals package from a project folder: `{ file, version }` or null.
 * Walks node_modules directly because the package's `exports` map hides `package.json`, so
 * `require.resolve('web-vitals/package.json')` throws even when it is installed.
 */
export function findVitalsLib(project) {
  for (let dir = path.resolve(project); ; dir = path.dirname(dir)) {
    const pkg = path.join(dir, 'node_modules', 'web-vitals', 'package.json');
    const file = path.join(dir, 'node_modules', 'web-vitals', 'dist', 'web-vitals.iife.js');
    if (fs.existsSync(pkg) && fs.existsSync(file)) {
      try { return { file, version: JSON.parse(fs.readFileSync(pkg, 'utf8')).version || 'unknown' }; } catch { return null; }
    }
    if (path.dirname(dir) === dir) return null;
  }
}
