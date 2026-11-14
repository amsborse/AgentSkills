// Automatic capture: a Claude Code SessionEnd hook queues the closed session and starts a
// detached worker that runs the deterministic pipeline (learn + saved topic passes). A
// SessionStart hook then tells the user what is waiting for review. Nothing here calls a model
// or edits a skill; synthesis stays a human-started step (synthesis.md).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { readJson, stateDir, writeJson, writeText } from './util.mjs';

const MAX_PASSES = 3; // a worker re-runs while sessions keep closing, but never unbounded
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
    queued: readJson(file('queue.json'), []).length,
    running: workerRunning(),
    last: readJson(file('last.json')),
    error: readJson(file('error.json')),
  };
}

function spawnWorker(hlPath) {
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

/** SessionEnd: queue the session and make sure a worker will pick it up. Must return fast. */
export function onSessionEnd(input, { hlPath, start = spawnWorker } = {}) {
  const queue = readJson(file('queue.json'), []);
  queue.push({ session: input?.session_id || null, transcript: input?.transcript_path || null, reason: input?.reason || null, at: new Date().toISOString() });
  writeJson(file('queue.json'), queue);
  if (workerRunning()) return { queued: queue.length, started: false };
  return { queued: queue.length, started: true, log: start(hlPath) };
}

/**
 * SessionStart: resume a queue a previous worker could not finish, and return a notice when
 * something waits for review (at most once per NOTICE_EVERY_MS) or the last run failed (always).
 */
export function onSessionStart(input, { hlPath, start = spawnWorker, now = Date.now() } = {}) {
  if (readJson(file('queue.json'), []).length && !workerRunning(now)) start(hlPath);
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
  const msg = `History learning: ${parts.join(' and ')} captured from recent sessions since ${p.since ? p.since.slice(0, 10) : 'the start'}, waiting to be turned into skill updates. Say "review history learning" to run it.`;
  return {
    systemMessage: msg,
    additionalContext: `${msg} If the user asks for it, use the history-learning skill: run \`hl pending --write\`, then follow synthesis.md on the digest and the topics/*.new.md files. Do not start the review unprompted.`,
  };
}

/** The detached worker: drains the queue with bounded passes, records success or a loud failure. */
export async function runWorker({ learn, refreshTopics, log = () => {} }) {
  if (workerRunning()) { log('another worker is running; exiting'); return { skipped: true }; }
  const startedAt = new Date().toISOString();
  writeJson(file('run.json'), { pid: process.pid, startedAt });
  try {
    let processed = 0;
    let passes = 0;
    // Sessions that close while a pass runs stay queued and get another pass, up to MAX_PASSES.
    while (passes < MAX_PASSES) {
      const taken = readJson(file('queue.json'), []).length;
      await learn();
      await refreshTopics();
      passes++;
      const rest = readJson(file('queue.json'), []).slice(taken);
      writeJson(file('queue.json'), rest);
      processed += taken;
      if (!rest.length) break;
    }
    const result = { startedAt, finishedAt: new Date().toISOString(), ok: true, passes, sessionsQueued: processed, remaining: readJson(file('queue.json'), []).length };
    writeJson(file('last.json'), result);
    fs.rmSync(file('error.json'), { force: true });
    log(`auto-run ok: ${passes} pass(es), ${processed} queued session(s) processed`);
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
