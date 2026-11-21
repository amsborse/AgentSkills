import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRIDGE = path.join(ROOT, 'tools', 'codex-bridge', 'codex-bridge.mjs');
const FAKE_AGY = path.join(ROOT, 'tests', 'fixtures', 'fake-agy.mjs');

// Runs the bridge against the fake agy, with run logs in a throwaway LOCALAPPDATA.
function bridge(args, { mode = 'ok', extraEnv = {} } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-test-'));
  const work = path.join(tmp, 'work');
  fs.mkdirSync(work);
  const log = path.join(tmp, 'agy-args.json');
  const env = { ...process.env, LOCALAPPDATA: path.join(tmp, 'state'), AGY_EXE: FAKE_AGY, FAKE_AGY_MODE: mode, FAKE_AGY_LOG: log, ...extraEnv };
  delete env.CODEX_BRIDGE_ACTIVE;
  const r = spawnSync(process.execPath, [BRIDGE, ...args.map(a => a === '$WORK' ? work : a)], { encoding: 'utf8', env, timeout: 30000 });
  let summary = null;
  try { summary = JSON.parse(r.stdout); } catch {}
  const seen = fs.existsSync(log) ? JSON.parse(fs.readFileSync(log, 'utf8')) : null;
  return { code: r.status, out: r.stdout + r.stderr, summary, seen };
}

test('antigravity run: parses the stream into an ok summary', () => {
  const r = bridge(['run', '--agent', 'antigravity', '--cd', '$WORK', '--prompt', 'say alpha']);
  assert.equal(r.code, 0, r.out);
  assert.equal(r.summary.agent, 'antigravity');
  assert.equal(r.summary.status, 'ok');
  assert.equal(r.summary.threadId, 'conv-123');
  assert.equal(r.summary.lastMessage, 'Done: alpha');
  assert.equal(r.summary.usage.total_tokens, 12);
  assert.equal(r.summary.quotaExhausted, undefined);
});

test('antigravity read-only: always sandboxed and denies the file-write tool', () => {
  const r = bridge(['run', '--agent', 'antigravity', '--cd', '$WORK', '--prompt', 'look']);
  const argv = r.seen.argv;
  assert.ok(argv.includes('--sandbox'));
  const settings = JSON.parse(argv[argv.indexOf('--settings') + 1]);
  assert.deepEqual(settings.permissions.deny, ['write_file(*)']);
  assert.equal(argv[argv.indexOf('--output-format') + 1], 'stream-json');
  assert.match(argv[argv.indexOf('-p') + 1], /You are Antigravity[\s\S]*TASK:\nlook$/);
});

test('antigravity workspace-write: sandboxed but may write files', () => {
  const r = bridge(['run', '--agent', 'antigravity', '--sandbox', 'workspace-write', '--cd', '$WORK', '--prompt', 'edit']);
  const argv = r.seen.argv;
  assert.ok(argv.includes('--sandbox'));
  assert.deepEqual(JSON.parse(argv[argv.indexOf('--settings') + 1]).permissions.deny, []);
});

test('antigravity: API keys and service-account credentials never reach the child', () => {
  const r = bridge(['run', '--agent', 'antigravity', '--cd', '$WORK', '--prompt', 'x'], {
    extraEnv: { GEMINI_API_KEY: 'k', GOOGLE_API_KEY: 'k', OPENAI_API_KEY: 'k', GOOGLE_APPLICATION_CREDENTIALS: 'c.json' },
  });
  assert.deepEqual(r.seen.keys, []);
  assert.equal(r.seen.depth, '1');
});

test('antigravity: an empty answer with denied actions is a failure, not ok', () => {
  const r = bridge(['run', '--agent', 'antigravity', '--cd', '$WORK', '--prompt', 'write a.txt'], { mode: 'denied' });
  assert.equal(r.code, 1);
  assert.equal(r.summary.status, 'failed');
  assert.match(r.summary.errors.join('\n'), /Denied by sandbox rules: write_file/);
  assert.equal(r.summary.quotaExhausted, false);
});

test('antigravity: exit 0 without a result event is a failure', () => {
  const r = bridge(['run', '--agent', 'antigravity', '--cd', '$WORK', '--prompt', 'x'], { mode: 'no-result' });
  assert.equal(r.summary.status, 'failed');
  assert.match(r.summary.errors.join('\n'), /no result event/);
  assert.match(r.summary.stderrTail, /no output produced/);
});

test('quota errors are flagged so the caller can fall back to the next agent', () => {
  const r = bridge(['run', '--agent', 'antigravity', '--cd', '$WORK', '--prompt', 'x'], { mode: 'quota' });
  assert.equal(r.summary.status, 'failed');
  assert.equal(r.summary.quotaExhausted, true);
});

test('antigravity review: runs read-only with the review target in the prompt', () => {
  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-repo-'));
  spawnSync('git', ['init', '-q', tmpRepo]);
  const r = bridge(['review', '--agent', 'antigravity', '--cd', tmpRepo, '--base', 'main']);
  assert.equal(r.summary.kind, 'review');
  const argv = r.seen.argv;
  assert.deepEqual(JSON.parse(argv[argv.indexOf('--settings') + 1]).permissions.deny, ['write_file(*)']);
  assert.match(argv[argv.indexOf('-p') + 1], /git diff main\.\.\.HEAD[\s\S]*do not modify any file/);
});

test('antigravity rejects Codex-only flags and images', () => {
  for (const extra of [['--worktree'], ['--assets-dir', 'x'], ['--image', FAKE_AGY]]) {
    const r = bridge(['run', '--agent', 'antigravity', '--cd', '$WORK', '--prompt', 'x', ...extra]);
    assert.equal(r.code, 2, `${extra[0]} should be refused: ${r.out}`);
    assert.equal(r.seen, null, 'agy must not be started');
  }
});

test('unknown agents are refused', () => {
  const r = bridge(['run', '--agent', 'gemini', '--cd', '$WORK', '--prompt', 'x']);
  assert.equal(r.code, 2);
  assert.match(r.out, /codex, opencode, antigravity/);
});

// Codex runs use the fake codex; its session rollouts go to a throwaway CODEX_HOME.
function codexBridge(mode) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-codex-home-'));
  const FAKE_CODEX = path.join(ROOT, 'tests', 'fixtures', 'fake-codex.mjs');
  return bridge(['run', '--cd', '$WORK', '--prompt', 'read note.txt'],
    { extraEnv: { CODEX_EXE: FAKE_CODEX, CODEX_HOME: home, FAKE_CODEX_MODE: mode } });
}

test('codex run: a clean run is ok', () => {
  const r = codexBridge('ok');
  assert.equal(r.code, 0, r.out);
  assert.equal(r.summary.agent, 'codex');
  assert.equal(r.summary.status, 'ok');
  assert.deepEqual(r.summary.errors, []);
});

test('codex: a sandbox that fails to start is a failure, not ok', () => {
  // Codex exits 0 and only says so in prose; the bwrap error sits in the session rollout.
  const r = codexBridge('sandbox-fail');
  assert.equal(r.code, 1, r.out);
  assert.equal(r.summary.status, 'failed');
  assert.match(r.summary.errors.join('\n'), /sandbox failed to start: bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted/);
});
