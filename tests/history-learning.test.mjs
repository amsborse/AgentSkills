import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-test-'));
const home = path.join(tmp, 'home');
const repo = path.join(tmp, 'work', 'Widget');
const state = path.join(tmp, 'state');
let hl;

const jsonl = (file, rows) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
};

before(async () => {
  fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  Object.assign(process.env, { HOME: home, USERPROFILE: home, APPDATA: path.join(home, 'AppData', 'Roaming'), HISTORY_LEARNING_HOME: state, XDG_DATA_HOME: path.join(home, '.local', 'share') });
  delete process.env.CODEX_HOME;
  delete process.env.CLAUDE_CONFIG_DIR;
  delete process.env.OPENCODE_DB;

  const proj = path.join(home, '.claude-work', 'projects', 'widget');
  const u1 = { type: 'user', uuid: 'u1', sessionId: 's1', cwd: repo, entrypoint: 'cli', timestamp: '2026-09-01T10:00:00Z', message: { role: 'user', content: "No, don't add comments everywhere. Always keep diffs minimal." } };
  jsonl(path.join(proj, 's1.jsonl'), [
    { type: 'assistant', timestamp: '2026-09-01T09:59:05Z', message: { content: [{ type: 'text', text: 'I added explanatory comments to every function.' }] } },
    u1,
    { type: 'user', uuid: 'u2', sessionId: 's1', cwd: repo, timestamp: '2026-09-01T10:01:00Z', message: { content: [{ type: 'tool_result', content: 'never leak me' }] } },
    { type: 'user', uuid: 'u3', sessionId: 's1', cwd: repo, isMeta: true, timestamp: '2026-09-01T10:02:00Z', message: { content: 'always injected meta' } },
    { type: 'user', uuid: 'u4', sessionId: 's1', cwd: repo, timestamp: '2026-09-01T10:03:00Z', message: { content: '<command-name>/clear</command-name>' } },
  ]);
  jsonl(path.join(proj, 's2.jsonl'), [
    { ...u1, sessionId: 's2' },
    { type: 'user', uuid: 'u5', sessionId: 's2', cwd: repo, entrypoint: 'cli', timestamp: '2026-09-02T10:00:00Z', message: { content: 'From now on never push to main without asking, use key sk-ant-abcdefghijklmnopqrstuvwx and mail someone@example.com' } },
  ]);
  jsonl(path.join(proj, 's3.jsonl'), [{ type: 'user', uuid: 'u6', sessionId: 's3', cwd: repo, entrypoint: 'sdk-cli', timestamp: '2026-09-03T10:00:00Z', message: { content: 'Never do the automated thing. Always run the job.' } }]);

  const codex = path.join(home, '.codex', 'sessions', '2026', '09', '04');
  jsonl(path.join(codex, 'rollout-a.jsonl'), [
    { type: 'session_meta', timestamp: '2026-09-04T09:00:00Z', payload: { id: 'c1', cwd: path.join(repo, 'src'), source: 'vscode', originator: 'codex_work_desktop' } },
    { type: 'response_item', timestamp: '2026-09-04T09:00:00Z', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '# AGENTS.md instructions for the repo' }] } },
    { type: 'event_msg', timestamp: '2026-09-04T09:00:01Z', payload: { type: 'item_completed', item: { type: 'UserMessage', content: [{ type: 'text', text: 'Stop using generic gradients, the UI looks cheap.' }] } } },
    { type: 'event_msg', timestamp: '2026-09-04T09:00:09Z', payload: { type: 'item_completed', item: { type: 'AgentMessage', content: [{ type: 'text', text: 'Added a purple gradient hero.' }] } } },
  ]);
  jsonl(path.join(codex, 'rollout-b.jsonl'), [
    { type: 'session_meta', timestamp: '2026-09-04T09:05:00Z', payload: { id: 'c2', cwd: repo, source: { subagent: 'other' }, originator: 'codex_work_desktop' } },
    { type: 'event_msg', timestamp: '2026-09-04T09:05:01Z', payload: { type: 'item_completed', item: { type: 'UserMessage', content: [{ type: 'text', text: 'Never approve risky commands.' }] } } },
  ]);

  const slug = repo.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  jsonl(path.join(home, '.cursor', 'projects', slug, 'agent-transcripts', 'k1', 'k1.jsonl'), [
    { role: 'user', message: { content: [{ type: 'text', text: '<system_reminder>ignore</system_reminder><user_query>\nThe UI still looks generic and cheap, stop using gradients.\n</user_query>' }] } },
    { role: 'assistant', message: { content: [{ type: 'text', text: 'Done.' }] } },
  ]);

  const { DatabaseSync } = await import('node:sqlite');
  const dbFile = path.join(home, '.local', 'share', 'opencode', 'opencode.db');
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const db = new DatabaseSync(dbFile);
  db.exec(`CREATE TABLE session_v2 (id TEXT, parent_id TEXT, fork_session_id TEXT, directory TEXT, time_created INTEGER, time_updated INTEGER);
    CREATE TABLE session_message (id TEXT, session_id TEXT, type TEXT, seq INTEGER, time_created INTEGER, data TEXT);
    CREATE TABLE credential (id TEXT, value TEXT);`);
  db.prepare('INSERT INTO credential VALUES (?, ?)').run('x', 'SECRET-CRED-VALUE');
  db.prepare('INSERT INTO session_v2 VALUES (?,?,?,?,?,?)').run('o1', null, null, repo, 1788000000000, 1788000100000);
  db.prepare('INSERT INTO session_v2 VALUES (?,?,?,?,?,?)').run('o2', 'o1', null, repo, 1788000000000, 1788000100000);
  db.prepare('INSERT INTO session_message VALUES (?,?,?,?,?,?)').run('m1', 'o1', 'user', 1, 1788000000000, JSON.stringify({ time: { created: 1788000000000 }, text: 'Stop adding gradients, the design looks cheap and generic.' }));
  db.prepare('INSERT INTO session_message VALUES (?,?,?,?,?,?)').run('m2', 'o2', 'user', 1, 1788000000000, JSON.stringify({ time: { created: 1788000000000 }, text: 'Subagent: never stop.' }));
  db.close();

  hl = {
    inventory: await import('../history-learning/scripts/lib/inventory.mjs'),
    consent: await import('../history-learning/scripts/lib/consent.mjs'),
    extract: await import('../history-learning/scripts/lib/extract.mjs'),
    cluster: await import('../history-learning/scripts/lib/cluster.mjs'),
    digest: await import('../history-learning/scripts/lib/digest.mjs'),
    redact: await import('../history-learning/scripts/lib/redact.mjs'),
    signals: await import('../history-learning/scripts/lib/signals.mjs'),
  };
});

test('redaction removes credentials, contact details and the home path', () => {
  const r = hl.redact.makeRedactor({ home: 'C:\\Users\\alice', user: 'alice' });
  const { text } = r('key sk-proj-ABCDEFGHIJKLMNOPQRSTUV token=hunter22secret mail a.b@corp.io at C:\\Users\\alice\\repo and C:/Users/alice/x ghp_abcdefghijklmnopqrstuvwxyz0123');
  for (const leak of ['sk-proj', 'hunter22', 'a.b@corp.io', 'alice', 'ghp_']) assert.ok(!text.includes(leak), `${leak} leaked: ${text}`);
  assert.match(text, /~[\\/]repo/);
});

test('signal detection separates durable rules, temporary asks and corrections', () => {
  const a = hl.signals.analyzeTurn("No, that's wrong. From now on always run the tests before committing.");
  assert.ok(a.statements[0].kinds.includes('correction'));
  assert.ok(a.statements.some((s) => s.durable && s.categories.includes('testing-verification')));
  const t = hl.signals.analyzeTurn("Don't run the full suite for now, just this once skip it.");
  assert.ok(t.statements.every((s) => s.temporary));
});

test('inventory is metadata-only and classifies origin, duplicates and projects', async () => {
  const inv = await hl.inventory.buildInventory();
  const by = (src) => inv.sessions.filter((s) => s.source === src);
  assert.equal(by('claude-code:.claude-work').length, 3);
  assert.deepEqual(by('claude-code:.claude-work').map((s) => s.origin).sort(), ['automated', 'interactive', 'interactive']);
  assert.equal(by('codex').find((s) => s.id === 'c1').project, 'Widget');
  assert.equal(by('codex').find((s) => s.id === 'c2').origin, 'subagent');
  assert.equal(by('codex').find((s) => s.id === 'c1').userTurns, 1);
  assert.equal(by('opencode').find((s) => s.id === 'o2').origin, 'subagent');
  assert.equal(by('cursor:agent-transcripts')[0].project, 'Widget');
  const written = fs.readFileSync(path.join(state, 'inventory.json'), 'utf8') + fs.readFileSync(path.join(state, 'reports', 'coverage.md'), 'utf8');
  for (const text of ['comments everywhere', 'gradients', 'sk-ant', 'SECRET-CRED']) assert.ok(!written.includes(text), `inventory stored message text: ${text}`);
  assert.match(written, /Pi \(/, 'absent agents are reported');
});

test('extraction requires consent, then reads only human turns, deduplicated and redacted', async () => {
  await assert.rejects(hl.extract.extract(), /no sources are enabled/);
  hl.consent.updateConsent({ enable: ['claude-code', 'codex', 'cursor-transcripts', 'opencode'] });
  const stats = await hl.extract.extract();
  assert.equal(stats.duplicateTurns, 1, 'the resumed copy of u1 is skipped');
  const ev = hl.extract.allEvidence(['claude-code', 'codex', 'cursor-transcripts', 'opencode']);
  const all = ev.map((r) => `${r.text} ${r.prev || ''}`).join('\n');
  for (const text of ['never leak me', 'injected meta', '/clear', 'automated thing', 'risky commands', 'Subagent', 'SECRET-CRED', 'sk-ant-', 'someone@example.com', 'AGENTS.md']) assert.ok(!all.includes(text), `evidence contains ${text}`);
  assert.ok(ev.some((r) => r.text.includes('[API_KEY]')));
  const correction = ev.find((r) => r.text.startsWith("No, don't add comments"));
  assert.ok(correction.prev.includes('explanatory comments'), 'corrections keep the agent reply they answer');
  assert.ok(ev.some((r) => r.agent === 'Codex' && /gradients/.test(r.text)));
  const again = await hl.extract.extract();
  assert.equal(again.sessions, 0);
  assert.equal(again.skippedUnchanged, stats.sessions);
});

test('clustering applies the evidence bar and the digest honours consent and budget', async () => {
  const res = hl.cluster.clusterEvidence(hl.extract.allEvidence(['claude-code', 'codex', 'cursor-transcripts', 'opencode']));
  hl.cluster.saveClusters(res);
  const gradients = res.clusters.find((c) => /gradients/.test(c.representative));
  assert.equal(gradients.sessions, 3);
  assert.equal(gradients.confidence.level, 'medium');
  assert.equal(gradients.confidence.basis, 'inferred');
  const push = res.clusters.find((c) => /push to main/.test(c.representative));
  assert.equal(push.confidence.basis, 'explicit');
  const d = hl.digest.buildDigest({ clusters: res.clusters, evidence: hl.extract.allEvidence(['claude-code', 'codex', 'cursor-transcripts', 'opencode']), budget: 2000 });
  assert.ok(d.used <= 2000 && d.included >= 2);
  const text = d.files.map((f) => fs.readFileSync(f.file, 'utf8')).join('\n');
  assert.ok(!text.includes('sk-ant-') && !text.includes('example.com'));
  hl.digest.markSynthesized(d.includedIds, res.clusters);
  const next = hl.digest.buildDigest({ clusters: res.clusters, evidence: [], budget: 2000 });
  assert.equal(next.included, 0, 'synthesized clusters are not re-sent');
});
