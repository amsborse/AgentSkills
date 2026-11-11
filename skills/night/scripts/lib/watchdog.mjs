// Deterministic watchdog. It never calls a model: it reads state.json and the lock, and restarts
// the supervisor (`night resume --detach`) when the process died or stopped heartbeating. A long
// build is not a stall: the supervisor's heartbeat keeps ticking while agents and checks run
// asynchronously, and a phase with a declared deadline is given until that deadline.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nowIso, killTree, pidAlive } from '../../../../nightly-evolution/scripts/lib/util.mjs';
import { paths, loadConfig, loadState, saveState, event, lockHolder, TERMINAL } from './state.mjs';

const NIGHT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'night.mjs');
export const MAX_RESTARTS = 5;

/**
 * What to do now. Pure: same inputs, same answer.
 * Returns { action: 'exit'|'wait'|'restart'|'kill_restart'|'give_up', reason, delayMs? }.
 */
export function assess(state, { now = Date.now(), alive, heartbeatSeconds = 20, backoffBaseSeconds = 30, stopRequested = false } = {}) {
  if (!state) return { action: 'exit', reason: 'no run' };
  if (TERMINAL.has(state.status) || state.status === 'planned') return { action: 'exit', reason: `run is ${state.status}` };
  const restarts = state.restarts || 0;
  const beat = Date.parse(state.heartbeat_at || state.started_at || 0) || 0;
  const staleMs = Math.max(5 * 60_000, 3 * heartbeatSeconds * 1000);
  const phaseDeadline = state.phase_deadline ? Date.parse(state.phase_deadline) : null;
  let problem = null;
  if (!alive) problem = 'supervisor_dead';
  else if (now - beat > staleMs && (!phaseDeadline || now > phaseDeadline)) problem = 'supervisor_stalled';
  if (!problem) return { action: 'wait', reason: now - beat > staleMs ? `heartbeat old but phase ${state.phase} runs until ${state.phase_deadline}` : 'healthy' };
  if (stopRequested && problem === 'supervisor_dead') return { action: 'give_up', reason: 'stop requested and the supervisor is gone', status: 'stopped' };
  if (restarts >= MAX_RESTARTS) return { action: 'give_up', reason: `${problem} after ${restarts} restarts`, status: 'failed' };
  const delayMs = backoffBaseSeconds * 1000 * 2 ** restarts;
  const last = state.last_restart_at ? Date.parse(state.last_restart_at) : 0;
  if (now - last < delayMs) return { action: 'wait', reason: `backing off ${Math.round((delayMs - (now - last)) / 1000)}s before restart ${restarts + 1}` };
  return { action: problem === 'supervisor_dead' ? 'restart' : 'kill_restart', reason: problem, delayMs };
}

export function spawnResume(root) {
  const p = paths(root);
  fs.mkdirSync(p.logs, { recursive: true });
  const log = fs.openSync(path.join(p.logs, 'supervisor.log'), 'a');
  const child = spawn(process.execPath, [NIGHT, 'resume', '--from-watchdog'], { cwd: root, detached: true, stdio: ['ignore', log, log], windowsHide: true });
  child.unref();
  fs.closeSync(log);
  return child.pid;
}

/** One watchdog check. `spawner` is injectable so tests restart nothing real. */
export function tick(root, { now = Date.now(), spawner = spawnResume } = {}) {
  const p = paths(root);
  const state = loadState(root);
  const config = loadConfig(root);
  const holder = lockHolder(root);
  const alive = Boolean(state?.pid && pidAlive(state.pid)) || Boolean(holder?.alive);
  const verdict = assess(state, { now, alive, heartbeatSeconds: config.timeouts.heartbeat_seconds, backoffBaseSeconds: config.retry.backoff_base_seconds, stopRequested: fs.existsSync(p.stop) });
  if (verdict.action === 'give_up') {
    state.status = verdict.status;
    state.stop_reason = verdict.reason;
    state.ended_at = nowIso();
    saveState(root, state);
    event(root, 'watchdog_gave_up', { run_id: state.run_id, reason: verdict.reason });
  } else if (verdict.action === 'restart' || verdict.action === 'kill_restart') {
    if (verdict.action === 'kill_restart') { killTree(state.pid); if (holder?.pid && holder.pid !== state.pid) killTree(holder.pid); }
    if (holder && !pidAlive(holder.pid)) fs.rmSync(p.lock, { force: true });
    state.restarts = (state.restarts || 0) + 1;
    state.last_restart_at = new Date(now).toISOString();
    saveState(root, state);
    const pid = spawner(root);
    event(root, 'watchdog_restart', { run_id: state.run_id, reason: verdict.reason, restarts: state.restarts, pid });
    verdict.pid = pid;
  }
  return verdict;
}

export async function watch(root, { intervalSeconds = 30, once = false, log = (m) => process.stdout.write(`${m}\n`) } = {}) {
  for (;;) {
    const v = tick(root);
    log(`${nowIso()} watchdog: ${v.action}: ${v.reason}`);
    if (once || v.action === 'exit' || v.action === 'give_up') return v;
    await new Promise((r) => setTimeout(r, intervalSeconds * 1000));
  }
}
