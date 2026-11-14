// improve-visuals blind pairing: the judge must not be able to tell before from after, and a
// missing verdict must never count as a win.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planPairs, tally } from '../skills/improve-visuals/scripts/lib/pairs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'skills/improve-visuals/scripts/blind-pairs.mjs');

test('pairs only files present on both sides and reports the rest', () => {
  const plan = planPairs(['home/d.png', 'home/m.png', 'old.png'], ['home/m.png', 'home/d.png', 'new.png'], 7);
  assert.deepEqual(plan.pairs.map((p) => p.rel), ['home/d.png', 'home/m.png']);
  assert.deepEqual(plan.beforeOnly, ['old.png']);
  assert.deepEqual(plan.afterOnly, ['new.png']);
});

test('the same seed gives the same order and both sides land on A across many pairs', () => {
  const files = Array.from({ length: 40 }, (_, i) => `s${i}.png`);
  const a = planPairs(files, files, 42);
  assert.deepEqual(a, planPairs(files, files, 42));
  const sides = new Set(a.pairs.map((p) => p.a));
  assert.deepEqual([...sides].sort(), ['after', 'before']);
});

test('tally maps letters back to sides; missing verdicts are unknown and regressions surface', () => {
  const key = { pairs: [{ id: '001', rel: 'x.png', a: 'after' }, { id: '002', rel: 'y.png', a: 'before' }, { id: '003', rel: 'z.png', a: 'before' }] };
  const r = tally(key, [
    { id: '001', winner: 'A', dimension: 'depth', reason: 'layered' },
    { id: '002', winner: 'A', regression: 'B', reason: 'clipped title' },
  ]);
  assert.deepEqual(r.counts, { after: 1, before: 1, same: 0, unknown: 1 });
  assert.deepEqual(r.regressions.map((x) => [x.id, x.side]), [['002', 'after']]);
});

test('tally rejects duplicate and stray verdicts', () => {
  const key = { pairs: [{ id: '001', rel: 'x.png', a: 'after' }] };
  assert.throws(() => tally(key, [{ id: '001', winner: 'A' }, { id: '001', winner: 'B' }]), /duplicate/);
  assert.throws(() => tally(key, [{ id: '009', winner: 'A' }]), /unknown pairs/);
});

test('CLI copies blind pairs, keeps the key outside the judge folder and tallies', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iv-'));
  const mk = (side, rel, body) => {
    const p = path.join(tmp, side, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  };
  mk('before', 'home/desktop.png', 'B0');
  mk('after', 'home/desktop.png', 'A1');
  const out = path.join(tmp, 'judge');
  execFileSync(process.execPath, [cli, 'pair', '--before', path.join(tmp, 'before'), '--after', path.join(tmp, 'after'), '--out', out, '--seed', '3']);
  const key = JSON.parse(fs.readFileSync(`${out}.key.json`, 'utf8'));
  assert.deepEqual(fs.readdirSync(out).sort(), ['001-A.png', '001-B.png', 'pairs.md']);
  const aBody = fs.readFileSync(path.join(out, '001-A.png'), 'utf8');
  assert.equal(aBody, key.pairs[0].a === 'after' ? 'A1' : 'B0');
  const list = fs.readFileSync(path.join(out, 'pairs.md'), 'utf8');
  assert.doesNotMatch(list, /before|after/);
  const afterLetter = key.pairs[0].a === 'after' ? 'A' : 'B';
  fs.writeFileSync(path.join(out, 'verdicts.json'), JSON.stringify([{ id: '001', winner: afterLetter }]));
  const tallied = JSON.parse(execFileSync(process.execPath, [cli, 'tally', '--pairs', out, '--verdicts', path.join(out, 'verdicts.json')], { encoding: 'utf8' }));
  assert.equal(tallied.counts.after, 1);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('CLI exits 2 when nothing can be compared', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iv-'));
  fs.mkdirSync(path.join(tmp, 'b'));
  fs.mkdirSync(path.join(tmp, 'a'));
  const r = spawnSync(process.execPath, [cli, 'pair', '--before', path.join(tmp, 'b'), '--after', path.join(tmp, 'a'), '--out', path.join(tmp, 'o')]);
  assert.equal(r.status, 2);
  fs.rmSync(tmp, { recursive: true, force: true });
});
