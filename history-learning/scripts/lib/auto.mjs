// Automatic capture: a daily scheduled task (Windows Task Scheduler or cron) runs the
// deterministic pipeline (learn + saved topic passes) in a detached worker. Sessions still open
// are covered too, because learn re-reads any transcript that changed. A SessionStart hook tells
// the user what is waiting for review and catches up a missed day. Nothing here calls a model or
// edits a skill; synthesis stays a human-started step (synthesis.md).
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { readJson, stateDir, writeJson, writeText } from './util.mjs';

const CATCH_UP_MS = 26 * 60 * 60 * 1000; // a daily run missed (machine off) is caught up at the next session start
const STALE_LOCK_MS = 30 * 60 * 1000;
const NOTICE_EVERY_MS = 20 * 60 * 60 * 1000;
const KEEP_LOGS = 10;

const autoDir = () => path.join(stateDir(), 'auto');
const file = (name) => path.join(autoDir(), name);

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

export function workerRunning(now = Date.now()) {
  const lock = readJson(file('run.json'));
  if (!lock) return false;
  return alive(lock.pid) && now - Date.parse(lock.startedAt) < STALE_LOCK_MS;
}

/** The review date: set by `hl mark --digest`, else the latest cluster marked synthesized. */
export function reviewedAt() {
  const r = readJson(path.join(stateDir(), 'review.json'));
  if (r?.at) return r.at;
  const s = readJson(path.join(stateDir(), 'synthesized.json'), {});
  return Object.values(s).map((x) => x.at).sort().pop() || null;
}

export function stampReview(now = new Date()) {
  writeJson(path.join(stateDir(), 'review.json'), { at: now.toISOString() });
}

/** Saved topic passes (topics/<name>.json), so the worker can refresh them with the same parameters. */
export function savedTopics() {
  const dir = path.join(stateDir(), 'topics');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => /^[\w-]+\.json$/.test(f) && !/\.(items|support|rules|new)\.json$/.test(f))
    .map((f) => readJson(path.join(dir, f)))
    .filter((t) => t?.name && Array.isArray(t.categories));
}

/**
 * What is waiting for a synthesis pass: digest clusters not yet marked, and topic statements
 * first seen after the last review. Writes topics/<name>.new.md with only those statements so
 * the reviewing agent reads the delta, not the whole topic again.
 */
export function pending({ write = false } = {}) {
  const since = reviewedAt();
  const digest = readJson(path.join(stateDir(), 'digest', 'index.json'));
  const topics = savedTopics().map((t) => {
    const items = readJson(path.join(stateDir(), 'topics', `${t.name}.items.json`), []);
    const fresh = items.filter((it) => !since || (it.first && it.first > since));
    let newFile = null;
    if (write && fresh.length) {
      newFile = path.join(stateDir(), 'topics', `${t.name}.new.md`);
      const lines = fresh.map((it) => `- ${it.kind === 'said' ? '' : `[${it.kind}] `}${it.text}${it.sessions.length > 1 ? ` x${it.sessions.length}` : ''}${it.spec ? ' (spec)' : ''}`);
      writeText(newFile, [`# ${t.name}: new since ${since || 'never reviewed'}`, '', `${fresh.length} redacted statements. Draft or strengthen rules from these, then run \`hl mark --digest\`.`, '', ...lines, ''].join('\n'));
    }
    return { name: t.name, fresh: fresh.length, total: items.length, generatedAt: t.generatedAt, newFile };
  });
  return {
    since,
    clusters: digest?.included || 0,
    digestAt: digest?.generatedAt || null,
    topics,
    running: workerRunning(),
    last: readJson(file('last.json')),
    error: readJson(file('error.json')),
  };
}

/** Start `hl auto-run` detached with its own log; returns the log path. */
export function spawnWorker(hlPath) {
  fs.mkdirSync(path.join(autoDir(), 'logs'), { recursive: true });
  const logs = fs.readdirSync(path.join(autoDir(), 'logs')).sort();
  for (const old of logs.slice(0, Math.max(0, logs.length - (KEEP_LOGS - 1)))) fs.rmSync(path.join(autoDir(), 'logs', old), { force: true });
  const log = path.join(autoDir(), 'logs', `run-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
  const fd = fs.openSync(log, 'a');
  const child = spawn(process.execPath, [hlPath, 'auto-run'], { detached: true, stdio: ['ignore', fd, fd], windowsHide: true, env: { ...process.env, HL_AUTO_LOG: log } });
  child.unref();
  fs.closeSync(fd);
  return log;
}

/** True when the last run (ok or failed) is older than a day and a half, or there never was one. */
export function runDue(now = Date.now()) {
  const last = readJson(file('last.json'));
  return !last?.finishedAt || now - Date.parse(last.finishedAt) > CATCH_UP_MS;
}

/**
 * SessionStart: catch up a missed daily run, and return a notice when
 * something waits for review (at most once per NOTICE_EVERY_MS) or the last run failed (always).
 */
export function onSessionStart(input, { hlPath, start = spawnWorker, now = Date.now() } = {}) {
  if (runDue(now) && !workerRunning(now)) start(hlPath);
  const p = pending();
  if (p.error) {
    const msg = `History learning: the last automatic run failed at ${p.error.at}: ${p.error.message}. Log: ${p.error.log || 'none'}. Run \`node ~/agent-skills/history-learning/scripts/hl.mjs auto-run\` to retry.`;
    return { systemMessage: msg, additionalContext: `${msg} Tell the user once; do not retry silently.` };
  }
  if (input?.source && input.source !== 'startup') return null;
  const fresh = p.topics.reduce((n, t) => n + t.fresh, 0);
  if (!p.clusters && !fresh) return null;
  const last = readJson(file('notice.json'));
  if (last?.at && now - Date.parse(last.at) < NOTICE_EVERY_MS) return null;
  writeJson(file('notice.json'), { at: new Date(now).toISOString() });
  const parts = [p.clusters && `${p.clusters} new or grown preference clusters`, fresh && `${fresh} new taste statements (${p.topics.filter((t) => t.fresh).map((t) => `${t.name} ${t.fresh}`).join(', ')})`].filter(Boolean);
  const msg = `History learning: ${parts.join(' and ')} captured from your sessions since ${p.since ? p.since.slice(0, 10) : 'the start'}, waiting to be turned into skill updates. Say "review history learning" to run it.`;
  return {
    systemMessage: msg,
    additionalContext: `${msg} If the user asks for it, use the history-learning skill: run \`hl pending --write\`, then follow synthesis.md on the digest and the topics/*.new.md files. Do not start the review unprompted.`,
  };
}

/** The detached worker: one refresh, recording success or a loud failure for the next notice. */
export async function runWorker({ learn, refreshTopics, log = () => {} }) {
  if (workerRunning()) { log('another worker is running; exiting'); return { skipped: true }; }
  const startedAt = new Date().toISOString();
  writeJson(file('run.json'), { pid: process.pid, startedAt });
  try {
    await learn();
    await refreshTopics();
    const result = { startedAt, finishedAt: new Date().toISOString(), ok: true };
    writeJson(file('last.json'), result);
    fs.rmSync(file('error.json'), { force: true });
    log('auto-run ok');
    return result;
  } catch (e) {
    const error = { at: new Date().toISOString(), message: e.message, log: process.env.HL_AUTO_LOG || null };
    writeJson(file('error.json'), error);
    writeJson(file('last.json'), { startedAt, finishedAt: error.at, ok: false, error: e.message });
    throw e;
  } finally {
    fs.rmSync(file('run.json'), { force: true });
  }
}

// Daily schedule. Windows: a Task Scheduler task; elsewhere: a marked crontab line. The scheduled
// command is `auto-run --background`, which returns at once and leaves a hidden worker with a log.
export const TASK_NAME = 'AgentSkills History Learning';
const CRON_MARK = '# agent-skills:history-learning';

function scheduler(cmd, argv, input) {
  // Test seam: HL_SCHEDULER_LOG records the calls instead of touching the real scheduler.
  if (process.env.HL_SCHEDULER_LOG) {
    fs.appendFileSync(process.env.HL_SCHEDULER_LOG, `${JSON.stringify({ cmd, argv, input: input ?? null })}\n`);
    const fake = process.env.HL_SCHEDULER_FAKE_OUTPUT;
    const query = argv.includes('/Query') || argv[0] === '-l'; // the "is it there" calls
    if (!query) return { status: 0, stdout: '', stderr: '' };
    return { status: fake === 'missing' ? 1 : 0, stdout: fake && fake !== 'missing' ? fake : '', stderr: '' };
  }
  const r = spawnSync(cmd, argv, { input, encoding: 'utf8', windowsHide: true });
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  return r;
}

/** Install (`on`), remove (`off`) or inspect (`status`) the daily run. Returns a one-line result. */
export function setSchedule(mode, { hlPath, at = '03:30', platform = process.platform, node = process.execPath } = {}) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(at);
  if (!m) throw new Error(`--at expects HH:MM, got ${at}`);
  if (platform === 'win32') {
    const exists = scheduler('schtasks', ['/Query', '/TN', TASK_NAME]).status === 0;
    if (mode === 'status') return exists ? `scheduled: task "${TASK_NAME}"` : 'not scheduled';
    if (mode === 'off') {
      if (!exists) return 'not scheduled';
      const r = scheduler('schtasks', ['/Delete', '/F', '/TN', TASK_NAME]);
      if (r.status !== 0) throw new Error(`schtasks /Delete failed: ${(r.stderr || r.stdout).trim()}`);
      return `removed task "${TASK_NAME}"`;
    }
    const r = scheduler('schtasks', ['/Create', '/F', '/SC', 'DAILY', '/ST', at, '/TN', TASK_NAME, '/TR', `"${node}" "${hlPath}" auto-run --background`]);
    if (r.status !== 0) throw new Error(`schtasks /Create failed: ${(r.stderr || r.stdout).trim()}`);
    return `${exists ? 'updated' : 'created'} task "${TASK_NAME}" daily at ${at}`;
  }
  const listed = scheduler('crontab', ['-l']);
  const lines = (listed.status === 0 ? listed.stdout : '').split('\n').filter((l) => l.trim());
  const ours = lines.filter((l) => l.includes(CRON_MARK));
  if (mode === 'status') return ours.length ? `scheduled: ${ours[0]}` : 'not scheduled';
  const rest = lines.filter((l) => !l.includes(CRON_MARK));
  if (mode === 'off' && !ours.length) return 'not scheduled';
  const next = mode === 'on' ? [...rest, `${Number(m[2])} ${Number(m[1])} * * * "${node}" "${hlPath}" auto-run --background ${CRON_MARK}`] : rest;
  const r = scheduler('crontab', ['-'], next.length ? `${next.join('\n')}\n` : '');
  if (r.status !== 0) throw new Error(`crontab update failed: ${(r.stderr || r.stdout).trim()}`);
  return mode === 'on' ? `cron daily at ${at}` : 'removed cron entry';
}
