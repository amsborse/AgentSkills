#!/usr/bin/env node
// Experience bench: repeatable lab measurement of a running page with Playwright and the Chrome
// DevTools Protocol. It answers "did this change make the page slower?" with numbers and their
// spread, never with an impression. Run directly, or as `visual-audit.mjs --perf ...`.
//
//   node perf-bench.mjs --url http://localhost:3000 [--project DIR] [--out DIR]
//     [--viewports desktop=1440x900,mobile=390x844] [--themes dark] [--cpu 1,4]
//     [--motion no-preference,reduce] [--tiers default,ultra,high,balanced,low,static]
//     [--tier-param quality] [--runs 5] [--script steps.json] [--repeats 1] [--settle 1500]
//     [--frames 2000] [--headed] [--budget budget.json] [--baseline report.json]
//     [--save-baseline FILE] [--allow-remote] [--json]
//
// What it measures per run: LCP, FCP, TTFB, load, CLS, INP (with --script), long tasks, long
// animation frames, frame pacing, JS heap after a forced GC (and its growth over --repeats),
// bytes and requests by type. Every condition runs --runs times; the report gives the median and
// the observed range, and a comparison only calls a change real when it clears the noise band.
// Lab data only: see "Not validated" in the report for what it cannot tell you.
// Exit codes: 0 measured, 3 over budget or regressed against --baseline, 2 incomplete, 1 usage.
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseViewports, isLocalUrl } from './lib/audit.mjs';
import {
  SCHEMA, TIERS, MOTIONS, DEFAULT_BUDGET, parseList, parseCpu, buildMatrix, withTier, validateScript, samplePath,
  frameStats, inpFrom, heapGrowth, summarizeRuns, conditionComplete, compareReports, validateBudget, checkBudget,
  notValidated, renderBenchMarkdown, benchStatus, findVitalsLib, tallyBytes, BROWSERS, NETWORKS, frameRateDrift,
} from './lib/bench.mjs';

const USAGE = 'usage: node perf-bench.mjs --url URL [--project DIR] [--out DIR] [--viewports name=WxH,...] [--themes light,dark] [--cpu 1,4] [--motion no-preference,reduce] [--tiers default,low,...] [--tier-param NAME] [--runs N] [--browser chromium|firefox|webkit] [--network slow-4g|fast-4g|3g] [--script FILE] [--repeats N] [--settle MS] [--frames MS] [--headed] [--budget FILE] [--baseline FILE] [--save-baseline FILE] [--allow-remote] [--json]';
const usage = (msg) => {
  if (msg) console.error(`error: ${msg}`);
  console.error(USAGE);
  process.exit(msg ? 1 : 0);
};

let o;
try {
  ({ values: o } = parseArgs({
    options: {
      url: { type: 'string' },
      project: { type: 'string', default: process.cwd() },
      out: { type: 'string' },
      viewports: { type: 'string', default: 'desktop=1440x900' },
      themes: { type: 'string', default: 'dark' },
      cpu: { type: 'string', default: '1' },
      motion: { type: 'string', default: 'no-preference' },
      tiers: { type: 'string', default: 'default' },
      'tier-param': { type: 'string', default: 'quality' },
      runs: { type: 'string', default: '5' },
      script: { type: 'string' },
      repeats: { type: 'string', default: '1' },
      settle: { type: 'string', default: '1500' },
      frames: { type: 'string', default: '2000' },
      headed: { type: 'boolean', default: false },
      browser: { type: 'string', default: 'chromium' },
      network: { type: 'string' },
      budget: { type: 'string' },
      baseline: { type: 'string' },
      'save-baseline': { type: 'string' },
      'allow-remote': { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  }));
} catch (e) { usage(e.message); }
if (o.help) usage();
if (!o.url) usage('--url is required');

const int = (name, min, max) => {
  const n = Number(o[name]);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`--${name} must be a whole number from ${min} to ${max}`);
  return n;
};
const readJson = (file, what) => {
  try { return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')); } catch (e) { throw new Error(`cannot read ${what} ${file}: ${e.message}`); }
};
let viewports, themes, cpu, motions, tiers, RUNS, REPEATS, SETTLE, FRAMES, script = null, budget, baseline = null;
try {
  new URL(o.url);
  viewports = parseViewports(o.viewports);
  if (!viewports.length) throw new Error('--viewports needs at least one viewport');
  themes = parseList(o.themes, ['light', 'dark'], 'themes');
  cpu = parseCpu(o.cpu);
  motions = parseList(o.motion, MOTIONS, 'motion');
  tiers = parseList(o.tiers, ['default', ...TIERS], 'tiers');
  if (!BROWSERS.includes(o.browser)) throw new Error(`--browser must be one of ${BROWSERS.join(', ')}`);
  if (o.network && !NETWORKS[o.network]) throw new Error(`--network must be one of ${Object.keys(NETWORKS).join(', ')}`);
  if (o.browser !== 'chromium' && cpu.some((c) => c > 1)) throw new Error('--cpu above 1 needs --browser chromium: only Chromium can slow the processor');
  if (o.browser !== 'chromium' && o.network) throw new Error('--network needs --browser chromium: only Chromium can shape the network');
  RUNS = int('runs', 1, 50);
  REPEATS = int('repeats', 1, 50);
  SETTLE = int('settle', 0, 60000);
  FRAMES = int('frames', 0, 60000);
  if (o.script) script = validateScript(readJson(o.script, 'interaction script'));
  budget = o.budget ? validateBudget(readJson(o.budget, 'budget')) : { budgets: DEFAULT_BUDGET, tradeoffs: [] };
  if (o.baseline) {
    baseline = readJson(o.baseline, 'baseline');
    if (baseline.schema !== SCHEMA) throw new Error(`baseline ${o.baseline} is not an ${SCHEMA} report`);
  }
} catch (e) { usage(e.message); }
if (!isLocalUrl(o.url) && !o['allow-remote']) usage('refusing a remote URL without --allow-remote. Benchmark your own running app; for a third-party site, check its terms first and keep the load low.');

const outDir = path.resolve(o.out || path.join(os.tmpdir(), `perf-bench-${Date.now()}`));
fs.mkdirSync(outDir, { recursive: true });

const require = createRequire(path.resolve(o.project, 'package.json'));
let chromium;
for (const m of ['@playwright/test', 'playwright']) {
  try { chromium = require(m)[o.browser]; if (chromium) break; } catch {}
}
const CDP = o.browser === 'chromium';
if (!chromium) {
  console.error(`Playwright not found from ${o.project}. Point --project at a folder where @playwright/test or playwright is installed. Nothing was measured.`);
  process.exit(2);
}
// Optional: Google's web-vitals library, when the project has it. Without it the same numbers
// come from PerformanceObserver directly; the report says which source was used.
const vitals = findVitalsLib(o.project);
const vitalsLib = vitals?.file || null;
const vitalsVersion = vitals?.version || null;

// Runs in the page before any app script. Collects everything the page itself can observe.
const INIT = () => {
  const b = (window.__bench = {
    lcp: null, cls: 0, clsSupported: false, shifts: [], events: {}, longTasks: { count: 0, total: 0, blocking: 0 }, longTaskSupported: false,
    loaf: { count: 0, worst: 0 }, loafSupported: false, frames: null, wv: {}, errors: [],
  });
  const observe = (type, fn, extra = {}) => {
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) fn(e); }).observe({ type, buffered: true, ...extra }); return true; } catch { return false; }
  };
  observe('largest-contentful-paint', (e) => { b.lcp = e.startTime; });
  // CLS as defined: the largest session window (shifts under 1 s apart, window at most 5 s).
  let win = 0;
  let first = 0;
  let last = 0;
  b.clsSupported = observe('layout-shift', (e) => {
    if (e.hadRecentInput) return;
    if (win && e.startTime - last < 1000 && e.startTime - first < 5000) win += e.value;
    else { win = e.value; first = e.startTime; }
    last = e.startTime;
    if (win > b.cls) b.cls = win;
    // Which elements moved and by how many pixels [x, y]: the largest few shifts, so a non-zero
    // score names its cause.
    const name = (n) => { if (!n || n.nodeType !== 1) return 'text'; const c = typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.') : ''; return n.id ? `#${n.id}` : n.nodeName.toLowerCase() + c; };
    b.shifts.push({ at: Math.round(e.startTime), value: Math.round(e.value * 1e4) / 1e4, moved: (e.sources || []).slice(0, 3).map((x) => name(x.node)), by: (e.sources || []).slice(0, 3).map((x) => [Math.round(x.currentRect.x - x.previousRect.x), Math.round(x.currentRect.y - x.previousRect.y)]) });
    b.shifts.sort((x, y) => y.value - x.value).splice(5);
  });
  observe('event', (e) => { if (e.interactionId) b.events[e.interactionId] = Math.max(b.events[e.interactionId] || 0, e.duration); }, { durationThreshold: 16 });
  b.longTaskSupported = observe('longtask', (e) => { b.longTasks.count++; b.longTasks.total += e.duration; b.longTasks.blocking += Math.max(0, e.duration - 50); });
  b.loafSupported = observe('long-animation-frame', (e) => { b.loaf.count++; b.loaf.worst = Math.max(b.loaf.worst, e.duration); });
  window.addEventListener('error', (e) => b.errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => b.errors.push(`unhandled rejection: ${String(e.reason)}`));
  // Frame recorder: only runs while a measurement window is open.
  b.startFrames = () => {
    b.frames = [];
    const tick = (t) => { if (!b.frames) return; b.frames.push(t); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  };
  b.stopFrames = () => { const f = b.frames; b.frames = null; return f || []; };
};
const INIT_VITALS = () => {
  try {
    const wv = window.webVitals;
    const set = (k) => (m) => { window.__bench.wv[k] = m.value; };
    wv.onLCP(set('lcp'), { reportAllChanges: true });
    wv.onCLS(set('cls'), { reportAllChanges: true });
    wv.onINP(set('inp'), { reportAllChanges: true, durationThreshold: 16 });
    wv.onFCP(set('fcp'));
    wv.onTTFB(set('ttfb'));
  } catch (e) { window.__bench.errors.push(`web-vitals failed to start: ${e.message}`); }
};
const COLLECT = () => {
  const b = window.__bench;
  const nav = performance.getEntriesByType('navigation')[0];
  const fcp = performance.getEntriesByName('first-contentful-paint')[0];
  return {
    lcp: b.lcp, fcp: fcp ? fcp.startTime : null, cls: b.clsSupported ? b.cls : null, shifts: b.shifts,
    ttfb: nav ? nav.responseStart : null, load: nav && nav.loadEventEnd > 0 ? nav.loadEventEnd : null,
    events: Object.values(b.events), interactionCount: performance.interactionCount ?? null,
    longTasks: b.longTaskSupported ? b.longTasks : null, loaf: b.loafSupported ? b.loaf : null,
    wv: b.wv, errors: b.errors.slice(0, 5),
    tier: document.documentElement.dataset.quality || null,
  };
};
const RENDERER = () => {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return gl ? String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : null;
  } catch { return null; }
};

const sleep = (page, ms) => page.waitForTimeout(ms);

async function playStep(page, step, vp) {
  const px = ([x, y]) => [x * vp.width, y * vp.height];
  switch (step.type) {
    case 'wait': await sleep(page, step.ms); break;
    case 'scroll': {
      const n = Math.max(1, Math.round((step.duration ?? 600) / 16));
      for (let i = 0; i < n; i++) { await page.mouse.wheel(0, step.by / n); await sleep(page, 16); }
      break;
    }
    case 'move': for (const p of samplePath(step.path, step.duration ?? 600)) { await page.mouse.move(...px(p)); await sleep(page, 16); } break;
    case 'hover': await page.locator(step.selector).first().hover({ timeout: 5000 }); break;
    case 'click': await page.locator(step.selector).first().click({ timeout: 5000 }); break;
    // A real touch where the viewport has one, so touch handlers and INP see a tap; a click elsewhere.
    case 'tap': if (vp.mobile) await page.locator(step.selector).first().tap({ timeout: 5000 }); else await page.locator(step.selector).first().click({ timeout: 5000 }); break;
    case 'press': await page.keyboard.press(step.key); break;
    case 'type': await page.locator(step.selector).first().pressSequentially(step.text, { delay: 30, timeout: 5000 }); break;
    case 'tab': for (let i = 0; i < (step.count ?? 1); i++) { await page.keyboard.press('Tab'); await sleep(page, 60); } break;
    case 'drag': {
      await page.mouse.move(...px(step.from));
      await page.mouse.down();
      for (const p of samplePath([step.from, step.to], step.duration ?? 500)) { await page.mouse.move(...px(p)); await sleep(page, 16); }
      await page.mouse.up();
      break;
    }
  }
}

const TYPE = { Document: 'document', Stylesheet: 'style', Script: 'script', Image: 'image', Font: 'font', Media: 'media', XHR: 'data', Fetch: 'data' };

const PW_TYPE = { document: 'document', stylesheet: 'style', script: 'script', image: 'image', font: 'font', media: 'media', xhr: 'data', fetch: 'data' };

async function oneRun(browser, cell) {
  const pending = [];
  const ctx = await browser.newContext({
    viewport: { width: cell.viewport.width, height: cell.viewport.height }, colorScheme: cell.theme, reducedMotion: cell.motion,
    isMobile: cell.viewport.mobile, hasTouch: cell.viewport.mobile, deviceScaleFactor: 1,
  });
  try {
    await ctx.addInitScript(INIT);
    if (vitalsLib) { await ctx.addInitScript({ path: vitalsLib }); await ctx.addInitScript(INIT_VITALS); }
    const page = await ctx.newPage();
    const reqs = new Map();
    let cdp = null;
    if (CDP) {
      cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      if (o.network) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...NETWORKS[o.network] });
      if (cell.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cell.cpu });
      cdp.on('Network.requestWillBeSent', (e) => reqs.set(e.requestId, { url: e.request.url, type: TYPE[e.type] || 'other', bytes: null }));
      cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) r.bytes = e.encodedDataLength; });
    } else {
      // Firefox and WebKit have no DevTools protocol here: sizes come from Playwright, and a size
      // it cannot give stays unknown. Each run is a fresh context, so nothing is served from cache.
      page.on('request', (rq) => reqs.set(rq, { url: rq.url(), type: PW_TYPE[rq.resourceType()] || 'other', bytes: null }));
      page.on('requestfinished', (rq) => { pending.push(rq.sizes().then((z) => { const r = reqs.get(rq); if (r) r.bytes = z.responseBodySize + z.responseHeadersSize; }).catch(() => {})); });
    }

    await page.goto(withTier(o.url, cell.tier, o['tier-param']), { waitUntil: 'load', timeout: 45000 });
    await sleep(page, SETTLE);

    const heapSeries = [];
    const heap = async () => {
      if (!cdp) return null; // heap size is a Chromium-only measurement
      await cdp.send('HeapProfiler.collectGarbage');
      const { usedSize } = await cdp.send('Runtime.getHeapUsage');
      return usedSize;
    };
    let frames = [];
    if (script || FRAMES > 0) {
      await page.evaluate(() => window.__bench.startFrames());
      if (script) {
        for (let r = 0; r < REPEATS; r++) {
          for (const step of script.steps) await playStep(page, step, cell.viewport);
          if (REPEATS > 1) heapSeries.push(await heap());
        }
      } else await sleep(page, FRAMES);
      frames = await page.evaluate(() => window.__bench.stopFrames());
    }
    await sleep(page, 150); // let the last event-timing and long-frame entries be delivered
    const used = heapSeries.length ? heapSeries[heapSeries.length - 1] : await heap();
    const m = await page.evaluate(COLLECT);
    await Promise.all(pending);

    let fileSizes = false;
    const sized = [];
    for (const r of reqs.values()) {
      if (r.url.startsWith('data:') || r.url.startsWith('blob:')) continue;
      let bytes = r.bytes > 0 ? r.bytes : null;
      if (r.url.startsWith('file:')) { // nothing is transferred from disk: these are file sizes, whichever source reports them
        fileSizes = true;
        if (bytes === null) { try { bytes = fs.statSync(fileURLToPath(r.url.split(/[?#]/)[0])).size; } catch {} }
      }
      sized.push({ type: r.type, bytes });
    }
    const weight = tallyBytes(sized);
    const builtinInp = inpFrom(m.events, m.interactionCount);
    return {
      lcp: m.wv.lcp ?? m.lcp, fcp: m.wv.fcp ?? m.fcp, ttfb: m.wv.ttfb ?? m.ttfb, load: m.load, cls: m.wv.cls ?? m.cls,
      inp: script ? (m.wv.inp ?? builtinInp) : null,
      interactions: m.interactionCount, shifts: m.shifts,
      longTasks: m.longTasks, loaf: m.loaf, frames: frameStats(frames),
      heap: { used, series: heapSeries, growth: heapGrowth(heapSeries) },
      bytes: { ...weight, requests: sized.length, kind: fileSizes ? 'decoded' : 'transfer' },
      tierObserved: m.tier, pageErrors: m.errors,
    };
  } finally { await ctx.close(); }
}

let browser;
try {
  browser = await chromium.launch({ headless: !o.headed });
} catch (e) {
  console.error(`${o.browser} could not start: ${String(e.message || e).split('\n')[0]}. Nothing was measured.`);
  process.exit(2);
}
let renderer = null;
try {
  const p = await browser.newPage();
  renderer = await p.evaluate(RENDERER);
  await p.close();
} catch {}
const environment = {
  browser: o.browser, browserVersion: browser.version(), headed: o.headed, renderer, network: o.network || null,
  platform: `${os.platform()} ${os.release()} ${os.arch()}`, cpuModel: os.cpus()[0]?.model?.trim() || null, cpuCount: os.cpus().length,
  memoryGb: Math.round(os.totalmem() / 1073741824), node: process.version,
};

const notes = [];
const conditions = [];
let bytesKind = 'transfer';
for (const cell of buildMatrix({ viewports, themes, cpu, motions, tiers })) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    try { runs.push(await oneRun(browser, cell)); } catch (e) { runs.push({ error: String(e.message || e).split('\n')[0] }); }
  }
  const { summary, completed } = summarizeRuns(runs);
  const ok = runs.filter((r) => !r.error);
  if (ok.some((r) => r.bytes.kind === 'decoded')) bytesKind = 'decoded';
  const observed = [...new Set(ok.map((r) => r.tierObserved))];
  if (cell.tier !== 'default' && ok.length && !observed.every((t) => t === cell.tier)) {
    notes.push(`${cell.id}: asked for tier "${cell.tier}" with ?${o['tier-param']}=, but the page reported ${observed.map((t) => (t ? `"${t}"` : 'no data-quality attribute')).join(', ')}. The tier numbers for this condition may not be for that tier.`);
  }
  if (script && ok.length && ok.every((r) => r.inp === null)) {
    notes.push(`${cell.id}: INP is unknown: ${ok.some((r) => r.interactions > 0) ? 'every interaction finished under 16 ms, below what Event Timing reports' : 'the script produced no discrete interaction (click, key press or tap)'}.`);
  }
  const pageErrors = [...new Set(ok.flatMap((r) => r.pageErrors))];
  if (pageErrors.length) notes.push(`${cell.id}: the page threw while being measured: ${pageErrors.join('; ')}`);
  conditions.push({
    id: cell.id, viewport: cell.viewport, theme: cell.theme, cpu: cell.cpu, motion: cell.motion, tier: cell.tier, tierObserved: observed.length === 1 ? observed[0] : observed,
    completed, complete: conditionComplete(completed, RUNS), errors: runs.filter((r) => r.error).map((r) => r.error), summary, runs,
  });
}
await browser.close();
notes.push(...frameRateDrift(conditions));

const report = {
  schema: SCHEMA, kind: 'lab', url: o.url, date: new Date().toISOString(), environment,
  runsPerCondition: RUNS, repeats: REPEATS, settleMs: SETTLE, script: script ? { name: script.name, steps: script.steps.length } : null,
  vitalsSource: vitalsLib ? `web-vitals ${vitalsVersion}` : 'built-in PerformanceObserver (web-vitals not installed in --project)',
  bytesKind, conditions, notes,
};
report.budget = checkBudget(conditions, budget, { isDefault: !o.budget });
if (baseline) report.comparison = compareReports(baseline, report);
report.notValidated = notValidated(environment, { script: !!script, repeats: script ? REPEATS : 0, bytesKind });
const { status, code } = benchStatus(report);
report.status = status;

fs.writeFileSync(path.join(outDir, 'perf-report.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(outDir, 'perf-report.md'), renderBenchMarkdown(report));
if (o['save-baseline']) {
  if (code === 2) console.error(`baseline not saved: ${status}.`);
  else { fs.mkdirSync(path.dirname(path.resolve(o['save-baseline'])), { recursive: true }); fs.writeFileSync(path.resolve(o['save-baseline']), JSON.stringify(report, null, 2)); }
}
if (o.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
else console.log(`${status.toUpperCase()}: ${conditions.length} condition(s), ${RUNS} run(s) each. Report: ${path.join(outDir, 'perf-report.md')}`);
process.exit(code);
