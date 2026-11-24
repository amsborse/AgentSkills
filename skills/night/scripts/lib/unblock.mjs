// The unblocking layer of the night supervisor: classify why an attempt was not kept, queue the
// decisions only the owner can take, track dependencies and idempotency keys, watch memory and
// CPU, refuse to run next to another supervisor, and seed a planned queue from a preset.
// It adds no scheduler: the supervisor calls these functions from its one loop.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash, nowIso, readJsonl, appendJsonl, writeAtomic, runSync, IS_WINDOWS } from '../../../../nightly-evolution/scripts/lib/util.mjs';
import { parseYaml } from '../../../../nightly-evolution/scripts/lib/yaml.mjs';
import { paths, ensureLayout, loadState, saveState, lockHolder, TERMINAL } from './state.mjs';
import { newTask, priority } from './plan.mjs';

export const PRESET_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'autonomous-night-loop', 'presets');

const fail = (code, message) => Object.assign(new Error(message), { code });
const text = (v, n = 600) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

// ---------------------------------------------------------------- approvals

/** Every approval, newest line per id winning. The file is append-only: a decision is a new line. */
export function readApprovals(root) {
  const byId = new Map();
  for (const line of readJsonl(paths(root).approvals)) {
    if (line?.id) byId.set(line.id, { ...(byId.get(line.id) || {}), ...line });
  }
  return [...byId.values()];
}

/**
 * Queue a decision for the owner. Asking the same thing twice returns the open entry instead of
 * adding one. An entry without a task (seeded by a preset) is asked once, whatever its status.
 */
export function requestApproval(root, { run_id = null, task_id = null, decision, consequence = '', default: fallback = '' }) {
  const what = text(decision) || 'an agent asked for approval without naming the decision';
  const same = readApprovals(root).filter((a) => a.task_id === task_id && a.decision === what);
  const open = same.find((a) => a.status === 'pending') || (task_id == null ? same[0] : null);
  if (open) return open;
  const entry = {
    id: `ap-${hash(`${task_id || ''}:${what}:${same.length}`, 8)}`, at: nowIso(), run_id, task_id,
    decision: what, consequence: text(consequence), default: text(fallback), status: 'pending',
  };
  appendJsonl(paths(root).approvals, entry);
  return entry;
}

/** Record the owner's answer. Only a person runs this (through `night approvals`); the supervisor never does. */
export function resolveApproval(root, id, status, note = '') {
  const all = readApprovals(root);
  const matches = all.filter((a) => a.id === id || a.id.startsWith(id) || a.id.startsWith(`ap-${id}`));
  if (matches.length !== 1) throw fail('NOAPPROVAL', matches.length ? `"${id}" matches ${matches.length} approvals; give the full id` : `no approval with id "${id}"`);
  const entry = matches[0];
  if (entry.status !== 'pending') throw fail('NOAPPROVAL', `approval ${entry.id} is already ${entry.status}`);
  const resolved = { ...entry, status, resolved_at: nowIso(), note: text(note) || undefined };
  appendJsonl(paths(root).approvals, resolved);
  return resolved;
}

// ---------------------------------------------------------------- blockers

/**
 * Why an attempt was not kept, as one of four kinds:
 *  - authorization: only the owner can decide (the agent said so, or a protected path was changed)
 *  - research: the evidence says the objective cannot be met honestly; the negative result is kept
 *  - agent: the agent or model failed (rate limit, crash, timeout), not the work
 *  - technical: the change was wrong (regression, failed acceptance, conflict); retried, bounded
 */
export function classifyBlocker({ claim = null, failure = null, agentFailure = false } = {}) {
  const b = claim?.blocker && typeof claim.blocker === 'object' ? claim.blocker : null;
  if (b && (b.kind === 'authorization' || b.kind === 'research')) {
    return { kind: b.kind, decision: text(b.decision || b.detail), consequence: text(b.consequence), detail: text(b.detail, 2000) };
  }
  if (failure === 'protected_path') return { kind: 'authorization' };
  if (agentFailure && failure !== 'supervisor_error') return { kind: 'agent', failure };
  return { kind: 'technical', failure };
}

/** The one mapping from the engine's task status to the state names used in reports and queue.json. */
export function reportState(task) {
  switch (task.status) {
    case 'pending': return 'READY';
    case 'running': return 'RUNNING';
    case 'waiting_approval': return 'WAITING_FOR_APPROVAL';
    case 'blocked': return task.blocker?.kind === 'technical' && task.blocker.exhausted ? 'FAILED' : 'BLOCKED';
    case 'kept':
    case 'done': return 'VERIFIED';
    case 'skipped': return 'SKIPPED';
    default: return 'BLOCKED';
  }
}

// ---------------------------------------------------------------- durable queue

export function queueRows(state) {
  return (state?.tasks || []).map((t) => ({
    id: t.id, key: t.key || null, title: t.title, objective: t.objective || '', state: reportState(t), status: t.status,
    dependencies: t.dependencies || [], priority: t.priority, acceptance: t.acceptance || [],
    verify: (t.verify || []).map((v) => v.run), agent: t.last_agent || null, attempts: t.attempts || 0,
    runtime_ms: t.runtime_ms || 0, usage: t.usage || null, last_error: t.last_error || null,
    blocker: t.blocker || null, evidence: t.evidence || [], commit: (t.commits || []).at(-1) || null, commits: t.commits || [],
  }));
}

/** Write .night/queue.json: the task queue as data, next to the human-readable backlog. */
export function writeQueue(root, state) {
  const tasks = queueRows(state);
  const counts = {};
  for (const t of tasks) counts[t.state] = (counts[t.state] || 0) + 1;
  writeAtomic(paths(root).queue, `${JSON.stringify({ run_id: state.run_id || null, status: state.status, updated_at: nowIso(), counts, tasks }, null, 2)}\n`);
}

// ---------------------------------------------------------------- idempotency

/** key -> its last ledger entry. A key that is kept or done is never seeded or run again. */
export function ledgerKeys(root) {
  const out = new Map();
  for (const line of readJsonl(paths(root).idempotency)) if (line?.key) out.set(line.key, line);
  return out;
}

export function recordKey(root, { key, status, task_id = null, run_id = null, commit = null }) {
  if (!key) return;
  appendJsonl(paths(root).idempotency, { at: nowIso(), key, status, task_id, run_id, commit });
}

export const keyFinished = (entry) => Boolean(entry) && (entry.status === 'kept' || entry.status === 'done');

/** The status a dependency (a task key or id) has right now: a task status, 'done' from the ledger, or 'missing'. */
export function dependencyStatus(dep, tasks, ledger) {
  const owners = tasks.filter((t) => t.key === dep || t.id === dep);
  if (owners.length) return owners.at(-1).status;
  return keyFinished(ledger?.get(dep)) ? 'done' : 'missing';
}

// ---------------------------------------------------------------- resources

export function cpuSample() {
  let idle = 0;
  let total = 0;
  for (const c of os.cpus()) {
    idle += c.times.idle;
    total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq;
  }
  return { idle, total, at: Date.now() };
}

export function cpuPercent(a, b) {
  const dt = b.total - a.total;
  return dt > 0 ? Math.round(100 * (1 - (b.idle - a.idle) / dt)) : null;
}

/** A sentence describing memory or CPU pressure, or null. `monitor` carries the CPU sample between calls. */
export function resourcePressure(config, monitor = {}) {
  const r = config.resources || {};
  const out = [];
  const freeMb = Math.round(os.freemem() / 1048576);
  monitor.free_mb = freeMb;
  if (r.min_free_memory_mb && freeMb < r.min_free_memory_mb) out.push(`free memory ${freeMb} MB is below ${r.min_free_memory_mb} MB`);
  if (r.max_cpu_percent) {
    const now = cpuSample();
    if (!monitor.prev) monitor.prev = now;
    else if (now.at - monitor.prev.at >= 5000) { monitor.cpu = cpuPercent(monitor.prev, now); monitor.prev = now; }
    if (monitor.cpu != null && monitor.cpu > r.max_cpu_percent) out.push(`CPU ${monitor.cpu}% is above ${r.max_cpu_percent}%`);
  }
  return out.length ? out.join('; ') : null;
}

// ---------------------------------------------------------------- ownership

const normPath = (p) => {
  let full = path.resolve(p);
  try { full = fs.realpathSync.native(full); } catch { /* not on disk: compare as written */ }
  full = full.replace(/\\/g, '/').replace(/\/+$/, '');
  return IS_WINDOWS ? full.toLowerCase() : full;
};

/**
 * A sentence when this repository is already owned by another run, or null: another worktree of
 * the same repository holds a live supervisor lock, or the run branch is checked out somewhere
 * other than this run's own directory.
 */
export function ownershipConflict(root, { branch = null, runDir = null } = {}) {
  const r = runSync(['git', 'worktree', 'list', '--porcelain'], { cwd: root, allowFail: true });
  if (r.code !== 0) return null;
  const trees = [];
  for (const line of r.stdout.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) trees.push({ path: line.slice(9).trim(), branch: null });
    else if (line.startsWith('branch ') && trees.length) trees.at(-1).branch = line.slice(7).trim().replace(/^refs\/heads\//, '');
  }
  const me = normPath(root);
  for (const w of trees) {
    if (normPath(w.path) === me) continue;
    const held = lockHolder(w.path);
    // A lock from another host cannot be checked, so it counts as live.
    if (held && held.alive !== false) return `another night supervisor (pid ${held.pid} on ${held.host}) is running in worktree ${w.path} of this repository`;
    if (branch && w.branch === branch && (!runDir || normPath(w.path) !== normPath(runDir))) return `the run branch ${branch} is checked out in ${w.path}`;
  }
  return null;
}

// ---------------------------------------------------------------- presets

export function listPresets() {
  if (!fs.existsSync(PRESET_DIR)) return [];
  return fs.readdirSync(PRESET_DIR).filter((f) => f.endsWith('.yaml')).map((f) => f.slice(0, -5)).sort();
}

/** Read and validate a preset by name (from the presets folder) or from a file. */
export function loadPreset(name, file = null) {
  const source = file ? path.resolve(file) : path.join(PRESET_DIR, `${name}.yaml`);
  if (!fs.existsSync(source)) throw fail('NOPRESET', file ? `preset file not found: ${source}` : `no preset "${name}" (available: ${listPresets().join(', ') || 'none'})`);
  const raw = fs.readFileSync(source, 'utf8');
  let y;
  try { y = parseYaml(raw) || {}; } catch (error) { throw fail('NOPRESET', `preset ${source} is not valid YAML: ${error.message}`); }
  const tasks = Array.isArray(y.tasks) ? y.tasks : [];
  const problems = [];
  const keys = new Set();
  for (const [i, t] of tasks.entries()) {
    if (!t?.key || !t?.title) { problems.push(`task ${i + 1} needs key and title`); continue; }
    if (keys.has(t.key)) problems.push(`duplicate task key ${t.key}`);
    keys.add(t.key);
    for (const v of t.verify || []) if (!v?.name || !v?.run) problems.push(`task ${t.key}: each verify entry needs name and run`);
  }
  for (const a of y.approvals || []) if (!a?.decision) problems.push('each approvals entry needs a decision');
  // A cycle would leave its tasks waiting for each other until the deadline.
  const deps = new Map(tasks.filter((t) => t?.key).map((t) => [t.key, t.depends_on || []]));
  const seen = new Map();
  const cyclic = (k) => {
    if (seen.get(k) === 1) return true;
    if (seen.get(k) === 2 || !deps.has(k)) return false;
    seen.set(k, 1);
    const hit = deps.get(k).some(cyclic);
    seen.set(k, 2);
    return hit;
  };
  for (const k of deps.keys()) if (cyclic(k)) { problems.push(`dependency cycle through ${k}`); break; }
  if (!tasks.length) problems.push('a preset needs at least one task');
  if (problems.length) throw fail('NOPRESET', `invalid preset ${source}: ${problems.join('; ')}`);
  return { name: y.name || name || path.basename(source, '.yaml'), mission: y.mission || '', config: y.config || null, tasks, approvals: y.approvals || [], source, raw };
}

function presetTask(t, order) {
  const scores = t.scores && ['impact', 'confidence', 'risk_reduction', 'effort', 'execution_cost'].every((k) => Number(t.scores[k]) > 0) ? t.scores : null;
  return newTask({
    key: t.key, title: t.title, objective: t.objective || '', mode: 'preset', loop: t.loop || null,
    writes: t.writes === 'report' ? 'report' : 'code', keep_rule: t.keep_rule || 'no-regression',
    scope: t.scope, acceptance: [].concat(t.acceptance || []), verify: t.verify || [], dependencies: t.depends_on || [],
    side_effect: t.side_effect, once: true, estimate_minutes: Number(t.estimate_minutes) || 30,
    scores, basis: { order: `preset order ${order + 1}${scores ? `; scored priority ${priority(scores)}` : ''}` },
    // A preset is an ordered plan: earlier tasks run first whenever their dependencies allow.
    priority: Number(t.priority) || 1000 - order, created_by: 'preset',
  });
}

/**
 * Seed a planned queue from a preset. Idempotent: a key already queued, or already kept or done
 * in the ledger, is skipped, so running the same preset twice adds nothing.
 */
export function seedPreset(root, preset) {
  const p = ensureLayout(root);
  const previous = loadState(root);
  if (previous && previous.status !== 'planned' && !TERMINAL.has(previous.status)) {
    throw fail('LOCKED', `a run is ${previous.status}: finish or stop it before seeding a preset`);
  }
  const planned = previous?.status === 'planned' && previous.preset ? previous : null;
  const ledger = ledgerKeys(root);
  const tasks = planned ? [...planned.tasks] : [];
  const added = [];
  const skipped = [];
  const approvals = [];
  for (const t of preset.tasks) {
    if (tasks.some((x) => x.key === t.key)) { skipped.push({ key: t.key, why: 'already queued' }); continue; }
    const entry = ledger.get(t.key);
    if (keyFinished(entry)) { skipped.push({ key: t.key, why: `already ${entry.status} in the ledger` }); continue; }
    const task = presetTask(t, tasks.length);
    if (entry?.status === 'started' && task.side_effect) {
      // It started once and nothing recorded how it ended: repeating it blindly could do it twice.
      const a = requestApproval(root, {
        task_id: task.id, decision: `Run "${task.title}" again? An earlier attempt started and its outcome was never recorded; it has side effects, so check its state first.`,
        consequence: 'the task and everything that depends on it wait', default: 'deny: the side effect is not repeated',
      });
      task.status = 'waiting_approval';
      task.blocker = { kind: 'authorization', approval: a.id, decision: a.decision };
      task.blocked_reason = `waiting for approval ${a.id}: ${a.decision}`;
      approvals.push(a.id);
    }
    tasks.push(task);
    added.push(t.key);
  }
  for (const a of preset.approvals) approvals.push(requestApproval(root, { decision: a.decision, consequence: a.consequence, default: a.default }).id);
  if (preset.mission.trim()) writeAtomic(p.mission, /^#\s/.test(preset.mission.trim()) ? `${preset.mission.trim()}\n` : `# Mission\n\n${preset.mission.trim()}\n`);
  if (normPath(preset.source) !== normPath(p.preset)) writeAtomic(p.preset, preset.raw);
  const title = preset.mission.trim().split(/\r?\n/).find((l) => l.trim())?.replace(/^#+\s*/, '').trim() || `preset ${preset.name}`;
  const state = {
    ...(planned || {}),
    run_id: planned?.run_id || `planned-${preset.name}`, status: 'planned', mode: 'preset', preset: preset.name,
    objective: planned?.objective || title.slice(0, 200), repo: root, tasks,
    iterations: 0, stagnant: 0, restarts: 0, usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0, cost_known: true },
    agents_down: {}, warnings: planned?.warnings || [], started_at: planned?.started_at || nowIso(), deadline: null, ended_at: null, stop_reason: null,
  };
  saveState(root, state);
  writeQueue(root, state);
  return { state, added, skipped, approvals: [...new Set(approvals)] };
}
