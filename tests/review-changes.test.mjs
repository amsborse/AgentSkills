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
  assert.deepEqual([...d.overlay.slice((2 * 4 + 3) * 4, (2 * 4 + 3) * 4 + 4)], [255, 45, 140, 255]);
});

test('diff: a taller after-page counts the extra rows as changed', () => {
  const a = solid(2, 2, [0, 0, 0, 255]);
  const b = solid(2, 3, [0, 0, 0, 255]);
  const d = diffRgba(a, 2, 2, b, 2, 3);
  assert.equal(d.height, 3);
  assert.equal(d.changed, 2);
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
