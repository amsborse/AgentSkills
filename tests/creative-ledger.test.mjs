import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { entriesFromReport, manualEntry, parseLedger, patterns } from '../skills/audit-design/scripts/lib/ledger.mjs';
import { summarize } from '../skills/audit-design/scripts/lib/audit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'skills', 'audit-design', 'scripts', 'record-findings.mjs');

// A report in the exact shape visual-audit.mjs writes, built with its own summarize().
function report(findings, incomplete = false) {
  return { url: 'http://127.0.0.1:5173/private', date: '2026-11-13', viewports: [], themes: [], summary: summarize(findings), incomplete, findings, notes: [], shots: [] };
}
const FAILING = report([
  { check: 'contrast', severity: 'major', detail: 'text 2.1:1', views: ['desktop-light'] },
  { check: 'offscreen-render', severity: 'major', detail: 'rAF while hidden', views: ['desktop-dark'] },
  { check: 'fonts', severity: 'info', detail: 'loaded' },
]);

test('entriesFromReport: summary line, info skipped, performance classified, URL dropped', () => {
  const out = entriesFromReport(FAILING, { skill: 'revamp-ui', ts: 't' });
  assert.equal(out.length, 3);
  assert.equal(out[0].check, 'summary');
  assert.match(out[0].detail, /^FAIL: blocker 0, major 2, minor 0, info 1$/);
  assert.equal(out[1].kind, 'defect');
  assert.equal(out[2].kind, 'performance');
  assert.ok(!JSON.stringify(out).includes('127.0.0.1'));
});

test('entriesFromReport: pass is accepted, incomplete is not a pass', () => {
  const pass = entriesFromReport(report([]), { skill: 'build-ui' });
  assert.match(pass[0].detail, /^PASS/);
  assert.equal(pass[0].outcome, 'accepted');
  const inc = entriesFromReport(report([], true), { skill: 'build-ui' });
  assert.match(inc[0].detail, /^INCOMPLETE/);
  assert.equal(inc[0].outcome, 'open');
});

test('entriesFromReport and manualEntry reject bad input', () => {
  assert.throws(() => entriesFromReport({}, { skill: 'x' }), /findings array/);
  assert.throws(() => entriesFromReport(FAILING, {}), /--skill/);
  assert.throws(() => manualEntry({ kind: 'nope', skill: 'x', note: 'n' }), /--kind/);
  assert.throws(() => manualEntry({ kind: 'success', skill: 'x', note: 'n', outcome: 'maybe' }), /--outcome/);
  assert.throws(() => manualEntry({ kind: 'success', skill: 'x' }), /--note/);
});

test('parseLedger reports bad lines; patterns groups repeats', () => {
  const lines = [
    ...entriesFromReport(FAILING, { skill: 'revamp-ui' }),
    ...entriesFromReport(FAILING, { skill: 'revamp-ui', outcome: 'fixed' }),
    manualEntry({ kind: 'success', skill: 'add-interactions', note: 'spring press approved' }),
  ].map((e) => JSON.stringify(e));
  const { entries, errors } = parseLedger(`${lines.join('\n')}\n{broken\n`);
  assert.equal(errors.length, 1);
  const found = patterns(entries, 2);
  assert.equal(found.length, 2);
  const contrast = found.find((p) => p.check === 'contrast');
  assert.deepEqual([contrast.count, contrast.open], [2, 1]);
  assert.ok(!found.some((p) => p.check === 'summary'));
  assert.equal(patterns(entries, 1).length, 3);
});

test('record-findings CLI appends from a report, notes and summarizes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'creative-ledger-'));
  const ledger = path.join(dir, 'nested', 'findings.jsonl');
  const reportFile = path.join(dir, 'report.json');
  fs.writeFileSync(reportFile, JSON.stringify(FAILING));
  const run = (...args) => spawnSync(process.execPath, [CLI, '--ledger', ledger, ...args], { encoding: 'utf8' });
  try {
    for (let i = 0; i < 2; i++) assert.equal(run('--report', reportFile, '--skill', 'revamp-ui').status, 0);
    assert.equal(run('--kind', 'feedback', '--skill', 'revamp-ui', '--note', 'too much glow').status, 0);
    const summary = run('--summary', '--json');
    assert.equal(summary.status, 0, summary.stderr);
    const data = JSON.parse(summary.stdout);
    assert.equal(data.entries, 7);
    assert.ok(data.patterns.some((p) => p.check === 'contrast' && p.count === 2));
    const bad = run('--kind', 'nope', '--skill', 'x', '--note', 'y');
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /--kind/);
    fs.appendFileSync(ledger, 'not json\n');
    assert.equal(run('--summary').status, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
