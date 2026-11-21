// Tests for the shared defaults installer and the token usage metrics. Each test uses its own temp folders.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyBlock, run, wrap } from '../install-defaults.mjs';
import { aggregate, compareMarkers, main, parseLine, periodKey } from '../scripts/token-usage.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'claude-defaults-'));
const quiet = () => {};

test('applyBlock adds one marked block, keeps existing text, and is idempotent', () => {
  const once = applyBlock('# My rules\n\nKeep me.\n', 'import X');
  assert.ok(once.startsWith('# My rules\n\nKeep me.\n'));
  assert.ok(once.includes(wrap('import X')));
  assert.equal(applyBlock(once, 'import X'), once);
});

test('applyBlock replaces the block when the rule path changes', () => {
  const first = applyBlock('top\n', 'old');
  const second = applyBlock(first, 'new');
  assert.equal(second.split('claude-defaults:begin').length, 2);
  assert.ok(second.includes('new') && !second.includes('old'));
});

test('applyBlock --uninstall removes only the block', () => {
  const text = applyBlock('keep this\n', 'x');
  assert.equal(applyBlock(text, 'x', { remove: true }), 'keep this\n');
  assert.equal(applyBlock('plain\n', 'x', { remove: true }), 'plain\n');
});

test('run writes both agent files, backs up the old one, and dry-run changes nothing', () => {
  const home = tmp();
  const claude = path.join(home, 'cl');
  const codex = path.join(home, 'cx');
  fs.mkdirSync(claude);
  fs.mkdirSync(codex);
  fs.writeFileSync(path.join(claude, 'CLAUDE.md'), 'mine\n');
  const env = { CLAUDE_HOME: claude, CODEX_HOME: codex };
  const rules = path.join(home, 'RULES.md');
  fs.writeFileSync(rules, 'rules');

  run(['--dry-run'], { env, home, rules, log: quiet });
  assert.equal(fs.readFileSync(path.join(claude, 'CLAUDE.md'), 'utf8'), 'mine\n');
  assert.equal(fs.existsSync(path.join(codex, 'AGENTS.md')), false);

  const res = run([], { env, home, rules, log: quiet });
  assert.deepEqual(res.map((r) => r.status), ['write block', 'write block']);
  assert.ok(fs.readFileSync(path.join(claude, 'CLAUDE.md'), 'utf8').startsWith('mine\n'));
  assert.equal(fs.readFileSync(path.join(claude, 'CLAUDE.md.bak-claude-defaults'), 'utf8'), 'mine\n');

  const again = run([], { env, home, rules, log: quiet });
  assert.deepEqual(again.map((r) => r.status), ['unchanged', 'unchanged']);

  run(['--uninstall'], { env, home, rules, log: quiet });
  assert.equal(fs.readFileSync(path.join(claude, 'CLAUDE.md'), 'utf8'), 'mine\n');
});

test('run skips agents that are not installed on this PC', () => {
  const home = tmp();
  const env = { CLAUDE_HOME: path.join(home, 'missing-claude'), CODEX_HOME: path.join(home, 'missing-codex') };
  const res = run([], { env, home, rules: path.join(home, 'R.md'), log: quiet });
  assert.deepEqual(res.map((r) => r.status), ['skipped (agent not installed)', 'skipped (agent not installed)']);
});

test('periodKey groups by day, month and ISO week (Monday start)', () => {
  assert.equal(periodKey('2026-11-21T04:02:57.299Z', 'daily'), '2026-11-21');
  assert.equal(periodKey('2026-11-21T04:02:57.299Z', 'monthly'), '2026-11');
  assert.equal(periodKey('2026-11-21T04:02:57.299Z', 'weekly'), 'week of 2026-11-16');
  assert.equal(periodKey('2026-11-22T10:00:00Z', 'weekly'), 'week of 2026-11-16');
  assert.equal(periodKey('not a date', 'daily'), null);
});

test('parseLine counts each request once and ignores non-assistant lines', () => {
  const seen = new Set();
  const line = JSON.stringify({ type: 'assistant', timestamp: '2026-11-21T01:00:00Z', requestId: 'r1', sessionId: 's', message: { model: 'm', usage: { input_tokens: 2, output_tokens: 3, cache_read_input_tokens: 4, cache_creation_input_tokens: 5 } } });
  assert.ok(parseLine(line, seen));
  assert.equal(parseLine(line, seen), null);
  assert.equal(parseLine(JSON.stringify({ type: 'user', timestamp: 'x' }), seen), null);
  assert.equal(parseLine('{broken', seen), null);
});

test('aggregate totals tokens per period and counts sessions', () => {
  const recs = [
    { ts: '2026-11-21T01:00:00Z', session: 'a', input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3, cache_creation_input_tokens: 4 },
    { ts: '2026-11-21T09:00:00Z', session: 'a', input_tokens: 1, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    { ts: '2026-11-22T09:00:00Z', session: 'b', input_tokens: 10, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  ];
  const rows = aggregate(recs, 'daily');
  assert.deepEqual(rows.map((r) => [r.period, r.turns, r.sessions, r.total]), [['2026-11-21', 2, 1, 11], ['2026-11-22', 1, 1, 10]]);
});

test('compareMarkers compares the 7 days before and after a change', () => {
  const day = 86400000;
  const t0 = Date.parse('2026-11-10T00:00:00Z');
  const rec = (ms, n) => ({ ts: new Date(ms).toISOString(), session: 's', input_tokens: n, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });
  const recs = [rec(t0 - day, 100), rec(t0 + day, 50)];
  const [r] = compareMarkers(recs, [{ ts: new Date(t0).toISOString(), what: 'trim rules' }]);
  assert.equal(r.before.total, 100);
  assert.equal(r.after.total, 50);
  assert.equal(r.changePct, -50);
});

test('token-usage mark writes to the logs folder and report handles empty history', () => {
  const home = tmp();
  process.env.CLAUDE_HOME = home;
  try {
    assert.equal(main(['report']), 'No Claude Code usage found.');
    main(['mark', 'added ELI5', 'rules'], new Date('2026-11-21T00:00:00Z'));
    const log = fs.readFileSync(path.join(home, 'logs', 'token-changes.jsonl'), 'utf8');
    assert.ok(log.includes('added ELI5 rules'));
    assert.throws(() => main(['mark']), /usage/);
  } finally {
    delete process.env.CLAUDE_HOME;
  }
});
