// audit-design visual-audit: pure checks are unit-tested here; the browser runner is tested
// against two fixtures (one with planted defects, one clean) when Playwright is available.
// Set PLAYWRIGHT_PROJECT to a folder whose node_modules has playwright or @playwright/test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  parseColor, contrastRatio, contrastThreshold, textContrast, parseViewports, isLocalUrl,
  findingsForView, findingsForMotion, findingsForInteraction, themeFindings, mergeFindings, summarize, rafRate, renderMarkdown,
} from '../skills/audit-design/scripts/lib/audit.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'skills/audit-design/scripts/visual-audit.mjs');
const fixture = (n) => pathToFileURL(path.join(root, 'tests/fixtures/visual-audit', `${n}.html`)).href;
const desktop = { name: 'desktop', width: 1280, height: 800, mobile: false };
const mobile = { name: 'mobile', width: 390, height: 844, mobile: true };

test('colors parse from computed-style formats and unknown formats stay unknown', () => {
  assert.deepEqual(parseColor('rgb(10, 20, 30)'), { r: 10, g: 20, b: 30, a: 1 });
  assert.deepEqual(parseColor('rgba(10,20,30,0.5)'), { r: 10, g: 20, b: 30, a: 0.5 });
  assert.deepEqual(parseColor('rgb(10 20 30 / 50%)'), { r: 10, g: 20, b: 30, a: 0.5 });
  assert.deepEqual(parseColor('#fff'), { r: 255, g: 255, b: 255, a: 1 });
  assert.equal(parseColor('transparent').a, 0);
  assert.equal(parseColor('oklch(0.7 0.1 200)'), null);
});

test('contrast ratio matches WCAG reference values', () => {
  assert.equal(Math.round(contrastRatio(parseColor('#000'), parseColor('#fff')) * 10) / 10, 21);
  assert.equal(Math.round(contrastRatio(parseColor('#777'), parseColor('#fff')) * 100) / 100, 4.48);
  assert.equal(contrastThreshold(16, 400), 4.5);
  assert.equal(contrastThreshold(24, 400), 3);
  assert.equal(contrastThreshold(19, 700), 3);
});

test('text contrast composites translucent layers and refuses to guess over images', () => {
  const over = (bgs, extra = {}) => textContrast({ color: 'rgb(0,0,0)', backgrounds: bgs, ...extra });
  assert.equal(over([{ color: 'rgba(0,0,0,0)' }, { color: 'rgb(255,255,255)' }]).ratio, 21);
  // 50% black over white is mid grey; black text on it is lower contrast than on white.
  const mid = over([{ color: 'rgba(0,0,0,0.5)' }, { color: 'rgb(255,255,255)' }]).ratio;
  assert.ok(mid > 4 && mid < 6, `got ${mid}`);
  assert.equal(over([{ color: 'rgba(0,0,0,0)', image: true }, { color: '#fff' }]).ratio, null);
  assert.equal(over([{ color: 'rgba(0,0,0,0)' }]).ratio, null, 'no opaque background and no canvas is unknown');
  assert.equal(over([{ color: 'rgba(0,0,0,0)' }], { canvas: { r: 255, g: 255, b: 255, a: 1 } }).ratio, 21);
  // Element opacity fades the ink toward the background.
  assert.ok(over([{ color: '#fff' }], { opacity: 0.3 }).ratio < 4.5);
});

test('viewport specs parse and junk is rejected', () => {
  assert.deepEqual(parseViewports('phone=390x844'), [{ name: 'phone', width: 390, height: 844, mobile: true }]);
  assert.equal(parseViewports('1440x900')[0].name, '1440x900');
  assert.throws(() => parseViewports('desktop=wide'));
  assert.throws(() => parseViewports('tiny=100x100'));
});

test('remote URLs are told apart from local ones', () => {
  for (const u of ['http://localhost:3000', 'http://127.0.0.1:5173/x', 'file:///C:/a.html', 'http://app.localhost']) assert.ok(isLocalUrl(u), u);
  for (const u of ['https://example.com', 'http://10.0.0.5']) assert.ok(!isLocalUrl(u), u);
});

test('view findings: overflow is major on phones, contrast fails below AA, load errors block', () => {
  const probe = {
    overflow: { px: 120, offenders: [{ sel: 'div.wide', right: 510 }] },
    contrast: { samples: [{ sel: 'p', text: 'faint', color: 'rgb(200,200,200)', fontSize: 16, fontWeight: '400', backgrounds: [{ color: 'rgb(255,255,255)' }] }], unknown: 2 },
    images: { broken: ['x.png'], noAlt: [] },
  };
  const m = findingsForView({ viewport: mobile, theme: 'light' }, probe);
  assert.equal(m.find((x) => x.check === 'overflow').severity, 'major');
  assert.equal(m.find((x) => x.check === 'contrast' && x.severity !== 'info').severity, 'major');
  assert.ok(m.some((x) => x.check === 'contrast' && x.severity === 'info'), 'unmeasured text is reported, not passed');
  assert.ok(m.some((x) => x.check === 'image'));
  assert.equal(findingsForView({ viewport: desktop, theme: 'light' }, probe).find((x) => x.check === 'overflow').severity, 'minor');
  assert.equal(findingsForView({ viewport: desktop, theme: 'dark' }, { navigationError: 'ERR' })[0].severity, 'blocker');
});

test('motion findings: offscreen loops and reduced-motion violations are major; unknown stays info', () => {
  const v = { viewport: desktop, theme: 'light' };
  assert.equal(rafRate(120, 2000), 60);
  assert.equal(rafRate(5, 0), null);
  const bad = findingsForMotion(v, { idle: 60, offscreen: 60, reduced: { raf: 60, infinite: ['div.pulse (pulse)'] } });
  assert.deepEqual(bad.map((x) => [x.check, x.severity]), [['offscreen-render', 'major'], ['reduced-motion', 'major'], ['reduced-motion', 'major']]);
  assert.deepEqual(findingsForMotion(v, { idle: 0, offscreen: 0, reduced: { raf: 0, infinite: [] } }), []);
  assert.equal(findingsForMotion(v, { idle: 0, offscreen: 'unknown', offscreenReason: 'fixed canvas', reduced: null })[0].severity, 'info');
});

test('interaction findings: hover layout shifts, invisible focus and no focusable elements', () => {
  const v = { viewport: desktop, theme: 'light' };
  const f = findingsForInteraction(v, { hover: [{ sel: 'button', kind: 'button', layoutMoved: 'size 10x10 to 20x20' }, { sel: 'a', kind: 'link', unchanged: true }], focus: [{ sel: 'a', invisible: true }], focusCount: 1 });
  assert.deepEqual(f.map((x) => x.check), ['hover', 'keyboard']);
  assert.equal(findingsForInteraction(v, { hover: [], focus: [], focusCount: 0 })[0].detail, 'Tab reaches no focusable element');
});

test('theme check, merging and pass/fail summary', () => {
  assert.equal(themeFindings({ desktop: { light: 'a', dark: 'a' } }).length, 1);
  assert.equal(themeFindings({ desktop: { light: 'a', dark: 'b' } }).length, 0);
  const merged = mergeFindings([
    { severity: 'minor', check: 'x', detail: 'same', viewport: 'desktop', theme: 'light' },
    { severity: 'minor', check: 'x', detail: 'same', viewport: 'mobile', theme: 'dark' },
    { severity: 'major', check: 'y', detail: 'other', viewport: 'desktop', theme: 'light' },
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].severity, 'major');
  assert.deepEqual(merged[1].views, ['desktop/light', 'mobile/dark']);
  assert.equal(summarize(merged).pass, false);
  assert.equal(summarize([{ severity: 'minor' }, { severity: 'info' }]).pass, true);
});

function findPlaywright() {
  const dir = process.env.PLAYWRIGHT_PROJECT;
  if (!dir) return null;
  const req = createRequire(path.resolve(dir, 'package.json'));
  for (const m of ['@playwright/test', 'playwright']) { try { req.resolve(m); return dir; } catch {} }
  return null;
}
const pw = findPlaywright();
const skip = pw ? false : 'set PLAYWRIGHT_PROJECT to a folder with playwright installed to run the browser audit';

function audit(name) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), `va-${name}-`));
  return new Promise((resolve) => {
    execFile(process.execPath, [script, '--url', fixture(name), '--project', pw, '--out', out, '--viewports', 'desktop=1280x800,mobile=390x844', '--json'], { maxBuffer: 1 << 24, timeout: 240000 }, (err, stdout, stderr) => {
      let report = null;
      try { report = JSON.parse(stdout); } catch {}
      resolve({ code: err ? err.code : 0, report, stderr, out });
    });
  });
}

test('browser audit flags every planted defect and passes the clean page', { skip, timeout: 300000 }, async () => {
  const [bad, good] = await Promise.all([audit('defective'), audit('clean')]);
  assert.ok(bad.report, `no report: ${bad.stderr}`);
  assert.equal(bad.code, 3, 'defective page must fail');
  const checks = new Set(bad.report.findings.filter((x) => ['blocker', 'major'].includes(x.severity)).map((x) => x.check));
  for (const c of ['console', 'contrast', 'hover', 'image', 'keyboard', 'offscreen-render', 'overflow', 'reduced-motion']) assert.ok(checks.has(c), `missed ${c}: ${[...checks]}`);
  assert.ok(bad.report.findings.some((x) => x.check === 'theme'), 'single-theme page is noted');
  for (const s of bad.report.shots) assert.ok(fs.statSync(s.path).size > 1000, `screenshot missing: ${s.path}`);

  assert.ok(good.report, `no report: ${good.stderr}`);
  assert.equal(good.code, 0, `clean page must pass: ${JSON.stringify(good.report.findings, null, 1)}`);
  assert.deepEqual(good.report.findings.filter((x) => x.severity !== 'info'), []);
  for (const d of [bad.out, good.out]) fs.rmSync(d, { recursive: true, force: true });
});

test('remote URLs are refused without --allow-remote', async () => {
  const r = await new Promise((resolve) => execFile(process.execPath, [script, '--url', 'https://example.com'], (err, _o, stderr) => resolve({ code: err ? err.code : 0, stderr })));
  assert.equal(r.code, 1);
  assert.match(r.stderr, /allow-remote/);
});

test('markdown verdict says incomplete when the audit stopped early, never pass', () => {
  const report = { url: 'http://localhost', summary: summarize([]), incomplete: true, findings: [], notes: ['tablet/dark: page did not load'], shots: [] };
  const md = renderMarkdown(report);
  assert.match(md, /Result: \*\*incomplete\*\*/);
  assert.doesNotMatch(md, /\*\*pass\*\*/);
  assert.match(renderMarkdown({ ...report, incomplete: false }), /Result: \*\*pass\*\*/);
});

test('text with an unparseable color counts as unmeasured contrast, not silently skipped', () => {
  const desktop = { name: 'desktop', width: 1440, height: 900, mobile: false };
  const probe = { contrast: { unknown: 0, samples: [{ sel: 'p', text: 'modern color', color: 'oklch(0.7 0.1 200)', backgrounds: [{ color: 'rgb(255, 255, 255)' }], fontSize: 16, fontWeight: 400 }] } };
  const info = findingsForView({ viewport: desktop, theme: 'light' }, probe).find((x) => x.check === 'contrast');
  assert.ok(info, 'unparseable sample must surface');
  assert.equal(info.severity, 'info');
  assert.match(info.detail, /^1 text element/);
});
