import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { badRoute, classifyShot, diffRgba, renderReport, validateBackend } from '../skills/review-changes/scripts/lib/review.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = path.join(ROOT, 'skills', 'review-changes', 'scripts');
const EXAMPLE = path.join(SCRIPTS, 'backend.example.json');

const solid = (w, h, rgba) => {
  const a = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < a.length; i += 4) a.set(rgba, i);
  return a;
};

test('diff: identical images have no change', () => {
  const a = solid(4, 3, [10, 20, 30, 255]);
  const d = diffRgba(a, 4, 3, a.slice(), 4, 3);
  assert.equal(d.changed, 0);
  assert.equal(d.ratio, 0);
  assert.equal(d.bbox, null);
});

test('diff: finds the changed pixel, its box, and ignores differences under the threshold', () => {
  const a = solid(4, 4, [100, 100, 100, 255]);
  const b = a.slice();
  b.set([110, 100, 100, 255], 0); // within threshold
  b.set([255, 0, 0, 255], (2 * 4 + 3) * 4); // x=3, y=2
  const d = diffRgba(a, 4, 4, b, 4, 4);
  assert.equal(d.changed, 1);
  assert.deepEqual(d.bbox, { x: 3, y: 2, w: 1, h: 1 });
  // A red dot on a plain grey page is an addition.
  assert.deepEqual([...d.overlay.slice((2 * 4 + 3) * 4, (2 * 4 + 3) * 4 + 4)], [34, 197, 94, 255]);
  assert.equal(d.added, 1);
});

test('diff: content that changes colour in place is amber, not added or removed', () => {
  const a = solid(3, 3, [10, 10, 10, 255]);
  const b = a.slice();
  a.set([40, 120, 255, 255], 4 * 4); // centre: blue button before
  b.set([255, 60, 150, 255], 4 * 4); // centre: pink button after
  const d = diffRgba(a, 3, 3, b, 3, 3);
  assert.equal(d.modified, 1);
  assert.equal(d.added + d.removed, 0);
  assert.deepEqual([...d.overlay.slice(16, 20)], [245, 158, 11, 255]);
});

test('diff: content on the background is added (green), content gone is removed (red)', () => {
  const bg = [10, 10, 10, 255];
  const a = solid(4, 4, bg);
  const b = a.slice();
  a.set([240, 240, 240, 255], 0); // x=0 text before, background after: removed
  b.set([240, 240, 240, 255], 3 * 4); // x=3 background before, text after: added
  const d = diffRgba(a, 4, 4, b, 4, 4);
  assert.equal(d.removed, 1);
  assert.equal(d.added, 1);
  assert.equal(d.modified, 0);
  assert.deepEqual([...d.overlay.slice(0, 4)], [239, 68, 68, 255]);
  assert.deepEqual([...d.overlay.slice(12, 16)], [34, 197, 94, 255]);
});

test('report: a new page is shown as a new feature in purple with a legend', () => {
  const html = renderReport({ ui: { shots: [
    { route: '/n', theme: 'dark', viewport: 'd', status: 'new', reason: 'r', before: { missing: true }, after: { file: 'shots/n.png' } },
    { route: '/c', theme: 'dark', viewport: 'd', status: 'changed', reason: 'r', before: { file: 'shots/a.png' }, after: { file: 'shots/b.png' }, diffFile: 'shots/d.png', added: 5, removed: 2, modified: 1 },
  ] } });
  assert.match(html, /New feature/);
  assert.match(html, /class="newfeat"><img[^>]+src="shots\/n.png"/);
  assert.match(html, /class="legend"/);
  assert.match(html, /Added[\s\S]*Removed[\s\S]*Changed in place[\s\S]*New feature/);
});

test('diff: a taller after-page counts the extra rows as changed', () => {
  const a = solid(2, 2, [0, 0, 0, 255]);
  const b = solid(2, 3, [0, 0, 0, 255]);
  const d = diffRgba(a, 2, 2, b, 2, 3);
  assert.equal(d.height, 3);
  assert.equal(d.changed, 2);
  assert.equal(d.added, 2);
  assert.deepEqual(d.bbox, { x: 0, y: 2, w: 2, h: 1 });
});

test('diff: the function survives toString() so it can run inside the page', () => {
  const fn = new Function(`return (${diffRgba.toString()})`)();
  const a = solid(2, 1, [0, 0, 0, 255]);
  assert.equal(fn(a, 2, 1, solid(2, 1, [255, 255, 255, 255]), 2, 1).changed, 2);
});

test('classify: a failed capture is never a pass', () => {
  assert.equal(classifyShot({ before: { file: 'a' }, after: { error: 'timeout' } }).status, 'not-checked');
  assert.equal(classifyShot({ before: { error: 'HTTP 500' }, after: { file: 'b' } }).status, 'not-checked');
  assert.equal(classifyShot({ before: { file: 'a' }, after: { file: 'b' } }).status, 'not-checked');
});

test('classify: a page missing on both sides is not checked, never new', () => {
  const s = classifyShot({ before: { missing: true }, after: { missing: true } });
  assert.equal(s.status, 'not-checked');
  assert.match(s.reason, /not found on either side/);
});

test('routes: a Git Bash rewritten path is rejected, normal routes pass', () => {
  assert.match(badRoute('/C:/Program Files/Git/components/x'), /MSYS_NO_PATHCONV/);
  assert.equal(badRoute('/components/x'), null);
  assert.equal(badRoute('/'), null);
});

test('classify: new, removed, unchanged, noise and changed', () => {
  assert.equal(classifyShot({ before: { missing: true }, after: { file: 'b' } }).status, 'new');
  assert.equal(classifyShot({ before: { file: 'a' }, after: { missing: true } }).status, 'removed');
  assert.equal(classifyShot({ before: { file: 'a' }, after: { file: 'b' }, ratio: 0 }).status, 'unchanged');
  assert.equal(classifyShot({ before: { file: 'a' }, after: { file: 'b' }, ratio: 0.002, noise: 0.002 }).status, 'noise');
  assert.equal(classifyShot({ before: { file: 'a' }, after: { file: 'b' }, ratio: 0.05, noise: 0.002 }).status, 'changed');
  // Unknown noise is not assumed to be zero-change: any difference is reported.
  assert.equal(classifyShot({ before: { file: 'a' }, after: { file: 'b' }, ratio: 0.0001 }).status, 'changed');
});

test('backend: the example cards pass', () => {
  assert.deepEqual(validateBackend(JSON.parse(fs.readFileSync(EXAMPLE, 'utf8'))), []);
});

test('backend: high confidence without a failing test, run or measurement is rejected', () => {
  const card = JSON.parse(fs.readFileSync(EXAMPLE, 'utf8'))[0];
  card.evidence = [{ kind: 'code-read', detail: 'read it' }];
  assert.match(validateBackend([card]).join('\n'), /high confidence needs/);
});

test('backend: medium on inference alone, a missing risk scenario, or no raise is rejected', () => {
  const problems = validateBackend([
    { title: 't', what: 'w', improves: 'i', risk: { level: 'low' }, confidence: 'medium', evidence: [{ kind: 'inferred', detail: 'guess' }] },
  ]).join('\n');
  assert.match(problems, /medium confidence needs/);
  assert.match(problems, /risk.scenario/);
  assert.match(problems, /raise/);
});

test('backend: suggestions need a confidence and a check', () => {
  const card = JSON.parse(fs.readFileSync(EXAMPLE, 'utf8'))[0];
  card.suggestions = [{ text: 'do x', confidence: 'sure', check: 'trust me' }];
  const problems = validateBackend([card]).join('\n');
  assert.match(problems, /suggestion needs text and a confidence/);
  assert.match(problems, /confirmed, plausible or unverified/);
});

test('report: escapes untrusted page and card text and refuses image paths outside the folder', () => {
  const html = renderReport({
    ui: { shots: [{ route: '/x<script>alert(1)</script>', theme: 'dark', viewport: 'desktop', status: 'changed', reason: 'r',
      before: { file: '../../etc/passwd', consoleErrors: ['<img src=x onerror=alert(1)>'] }, after: { file: 'shots/a.png' }, diffFile: 'javascript:alert(1)' }] },
    backend: [{ title: '"><b>x', what: '<i>', improves: '', risk: { level: 'low', scenario: 's' }, confidence: 'low', evidence: [] }],
  });
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /"><b>x/);
  assert.doesNotMatch(html, /etc\/passwd|javascript:alert/);
  assert.match(html, /src="shots\/a.png"/);
});

test('report: shows not-checked views and says when there was no interface capture', () => {
  const html = renderReport({ ui: { shots: [{ route: '/', theme: 'dark', viewport: 'd', status: 'not-checked', reason: 'after failed: timeout', before: {}, after: {} }] } });
  assert.match(html, /Not checked/);
  assert.match(html, /after failed: timeout/);
  assert.match(renderReport({ backend: [] }), /No interface capture was run/);
});

test('report.mjs: builds the page from cards and rejects an overclaiming card', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-changes-'));
  const ok = spawnSync(process.execPath, [path.join(SCRIPTS, 'report.mjs'), '--out', dir, '--backend', EXAMPLE], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(fs.readFileSync(path.join(dir, 'report.html'), 'utf8'), /Retries stop hammering/);

  const bad = path.join(dir, 'bad.json');
  fs.writeFileSync(bad, JSON.stringify([{ title: 't', what: 'w', improves: 'i', risk: { level: 'low', scenario: 's' }, confidence: 'high', evidence: [{ kind: 'inferred', detail: 'x' }] }]));
  const no = spawnSync(process.execPath, [path.join(SCRIPTS, 'report.mjs'), '--out', dir, '--backend', bad], { encoding: 'utf8' });
  assert.equal(no.status, 1);
  assert.match(no.stderr, /high confidence needs/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('diff: distant changes stay separate, nearby changes merge, and regions are capped without loss', () => {
  const a = solid(400, 1200, [0, 0, 0, 255]);
  const b = a.slice();
  const dot = (x, y) => b.set([255, 255, 255, 255], (y * 400 + x) * 4);
  dot(20, 20); dot(45, 30); dot(300, 1000);
  const fn = new Function(`return (${diffRgba.toString()})`)();
  assert.deepEqual(fn(a, 400, 1200, b, 400, 1200).regions, [
    { x: 20, y: 20, w: 26, h: 11 }, { x: 300, y: 1000, w: 1, h: 1 },
  ]);
  for (let y = 150; y < 1000; y += 120) dot(150, y);
  const regions = diffRgba(a, 400, 1200, b, 400, 1200).regions;
  assert.equal(regions.length, 6);
  for (let y = 150; y < 1000; y += 120) assert.ok(regions.some(r => 150 >= r.x && 150 < r.x + r.w && y >= r.y && y < r.y + r.h));
  assert.deepEqual(diffRgba(a, 400, 1200, a, 400, 1200).regions, []);
});

test('diff: thousands of scattered changes are capped quickly and none is lost', () => {
  // About 1,700 isolated changes; an all-pairs merge per step took many seconds here.
  const W = 1440, H = 6000, a = solid(W, H, [0, 0, 0, 255]), b = a.slice(), dots = [];
  for (let y = 10; y < H; y += 72) for (let x = 10; x < W; x += 72) { dots.push([x, y]); b.set([255, 255, 255, 255], (y * W + x) * 4); }
  const t = performance.now();
  const { regions } = diffRgba(a, W, H, b, W, H);
  assert.ok(performance.now() - t < 3000, `took ${Math.round(performance.now() - t)}ms`);
  assert.ok(regions.length >= 1 && regions.length <= 6);
  for (const [x, y] of dots) assert.ok(regions.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h), `dot ${x},${y} not covered`);
});

test('report: numbered close-ups and overview markers, legacy bbox fallback, and safe geometry', () => {
  const shot = { status: 'changed', route: '/x', before: { file: 'shots/a.png' }, after: { file: 'shots/b.png' }, diffFile: 'shots/d.png',
    regions: [{ x: 100, y: 200, w: 120, h: 30 }, { x: 500, y: 900, w: 80, h: 60 }] };
  const render = s => renderReport({ ui: { shots: [s] } });
  const html = render(shot);
  assert.match(html, /Changes up close/);
  assert.equal((html.match(/class="change-region"/g) || []).length, 2);
  assert.equal((html.match(/class="region-mark"/g) || []).length, 2);
  assert.match(html, /data-box="100,200,120,30"/);
  assert.match(html, /left:-76px;top:-176px/);
  // Each crop carries its change point so a shorter capture can say "not in this capture".
  assert.match(html, /data-at="500,900"[^]*?Not in this capture/);
  assert.match(html, /\.views,\.crop-grid\{grid-template-columns:1fr\}/);
  assert.match(render({ ...shot, regions: undefined, bbox: shot.regions[0] }), /Changes up close/);
  assert.doesNotMatch(render({ ...shot, regions: undefined }), /class="closeups"/);
  assert.doesNotMatch(render({ ...shot, regions: [{ x: '0;bad', y: 0, w: Infinity, h: 10 }] }), /class="closeups"/);
  assert.doesNotMatch(render({ ...shot, before: { file: '../outside.png' } }), /src="\.\.\//);
  assert.doesNotMatch(render({ ...shot, status: 'unchanged' }), /class="closeups"/);
});
