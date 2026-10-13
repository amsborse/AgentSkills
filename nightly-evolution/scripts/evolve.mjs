#!/usr/bin/env node
// Nightly Evolution engine: deterministic, resumable bookkeeping for autonomous improvement runs.
// The agent spends tokens on judgment and implementation; everything measurable happens here.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lockedPaths, overlaps, protectedHits } from './lib/conflicts.mjs';
import { discover } from './lib/discover.mjs';
import { compare, measureAll, relatedTests, requirementsUnmet } from './lib/measure.mjs';
import { digest, findSimilar, fingerprint, readHistory, record, registerRepo, search } from './lib/memory.mjs';
import { DIMENSIONS, generatePolicy, loadPolicy, policyToYaml, validatePolicy, deepMerge, DEFAULTS } from './lib/policy.mjs';
import {
  acquireLock,
  activeNight,
  changedFiles,
  commitsSince,
  ensureExcluded,
  git,
  gitOut,
  headSha,
  isClean,
  isTracked,
  listNights,
  listWorktrees,
  loadNight,
  resolveRepo,
  saveNight,
} from './lib/repo.mjs';
import { renderReport } from './lib/report.mjs';
import { runSurvey, surveyMarkdown } from './lib/survey.mjs';
import { commandExists, expand, formatJson, inWindow, matchesAny, nightDate, nowIso, readJson, run, runSync, toPosix, windowEnd, writeAtomic, writeJson } from './lib/util.mjs';
import { parseYaml } from './lib/yaml.mjs';

const SELF = fileURLToPath(import.meta.url);
const SKILL_DIR = path.resolve(path.dirname(SELF), '..');

// ---- argument parsing ------------------------------------------------------------------

function parseArgs(argv) {
  const pos = [];
  const opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, inline] = a.slice(2).split(/=(.*)/s);
      if (inline !== undefined) opt[k] = inline;
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) opt[k] = argv[++i];
      else opt[k] = true;
    } else pos.push(a);
  }
  return { pos, opt };
}

const list = (v) => (v === undefined || v === true ? [] : String(v).split(',').map((s) => s.trim()).filter(Boolean));
const num = (v, d) => (v === undefined || v === true ? d : Number(v));
const out = (obj) => process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj?.[k] !== undefined).map((k) => [k, obj[k]]));

/** Move state written by earlier versions from .evolution/ into the git dir. */
function migrateState(repo) {
  fs.mkdirSync(repo.stateDir, { recursive: true });
  const old = path.join(repo.evoDir, 'state');
  if (fs.existsSync(old)) {
    for (const f of fs.readdirSync(old)) {
      const dest = path.join(repo.stateDir, f);
      if (!fs.existsSync(dest)) fs.renameSync(path.join(old, f), dest);
    }
    if (!fs.readdirSync(old).length) fs.rmdirSync(old);
  }
  fs.rmSync(path.join(repo.evoDir, 'profile.json'), { force: true });
}

function cli(repo, rest) {
  return `node "${toPosix(SELF)}" ${rest} --repo "${toPosix(repo.main)}"`;
}

// ---- context ---------------------------------------------------------------------------

function nightDir(repo, night) {
  return path.join(repo.stateDir, night.night);
}

function vars(repo, night) {
  return { main: toPosix(repo.main), worktree: toPosix(night?.worktree || repo.main), night: night?.night || '' };
}

function requireNight(repo, opt) {
  const night = opt.night ? loadNight(repo, opt.night) : activeNight(repo, { includeDryRun: Boolean(opt['dry-run']) });
  if (!night) throw new Error('No active night. Run `evolve tick` (inside the window) or `evolve tick --force`.');
  return night;
}

function findCandidate(night, id) {
  const c = night.candidates.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown candidate ${id}. Known: ${night.candidates.map((x) => x.id).join(', ') || 'none'}`);
  return c;
}

function recordCompute(night, what, ms) {
  night.compute.push({ what, ms, at: nowIso() });
}

// ---- night lifecycle -------------------------------------------------------------------

function hhmm(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
}

function startNight(repo, policy, { dryRun = false, agent } = {}) {
  const date = nightDate(policy.schedule.window);
  const id = dryRun ? `dryrun-${date}-${hhmm()}` : date;
  const existing = loadNight(repo, id);
  if (existing) return existing;
  const branch = dryRun ? `nightly/dryrun-evolution-${date}-${hhmm()}` : `nightly/evolution-${date}`;
  const base = policy.pr.base || policy.repo.default_branch;
  const baseSha = gitOut(repo.main, ['rev-parse', base]);
  let worktree;
  let adopted = false;
  const wt = listWorktrees(repo.main).find((w) => w.branch === branch && !w.prunable);
  const branchRef = git(repo.main, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], { allowFail: true }).code === 0;
  if (!dryRun) {
    const rival = branchRef && !ownedBranch(repo, branch, baseSha)
      ? { branch, path: wt?.path }
      : listWorktrees(repo.main).find((w) => !w.prunable && w.branch?.startsWith('nightly/evolution-') && w.branch !== branch && !ownedBranch(repo, w.branch, baseSha));
    if (rival) {
      const err = new Error(`${rival.branch}${rival.path ? ` (worktree ${toPosix(rival.path)})` : ''} was not started by this engine. Another process is running an evolution in this repo; not starting a second one.`);
      err.code = 'FOREIGN_BRANCH';
      throw err;
    }
  }
  if (wt) {
    worktree = wt.path;
    adopted = true;
  } else {
    worktree = path.resolve(repo.main, expand(policy.worktree.dir, { repo: path.basename(repo.main) }), `evolution-${id}`);
    fs.mkdirSync(path.dirname(worktree), { recursive: true });
    git(repo.main, branchRef ? ['worktree', 'add', worktree, branch] : ['worktree', 'add', '-b', branch, worktree, baseSha]);
    adopted = branchRef;
  }
  const mergeBase = gitOut(worktree, ['merge-base', 'HEAD', baseSha]);
  const night = {
    night: id,
    dryRun,
    branch,
    worktree: toPosix(worktree),
    base,
    baseSha: mergeBase,
    adopted,
    agent: agent || null,
    phase: 'setup',
    startedAt: nowIso(),
    windowEndAt: windowEnd(policy.schedule.window).toISOString(),
    ticks: 0,
    candidates: [],
    compute: [],
    usage: [],
    notes: adopted ? [`Adopted existing branch ${branch} at ${toPosix(worktree)}.`] : [],
    baseline: { metrics: {} },
    current: {},
  };
  saveNight(repo, night);
  return night;
}

const POLICY_COMMIT = 'chore(evolution): track the nightly evolution policy';

/** A branch is ours when any night state names it or its history carries the engine's first commit. */
function ownedBranch(repo, branch, baseSha) {
  if (listNights(repo).some((n) => n.branch === branch)) return true;
  const base = git(repo.main, ['merge-base', branch, baseSha], { allowFail: true }).stdout.trim();
  const range = base ? `${base}..${branch}` : branch;
  return git(repo.main, ['log', '--format=%s', '--fixed-strings', `--grep=${POLICY_COMMIT}`, range], { allowFail: true }).stdout.trim().length > 0;
}

function trackPolicy(repo, policy, night) {
  if (policy.pr.track_policy === false) return null;
  const rel = '.evolution/policy.yaml';
  if (isTracked(night.worktree, rel)) return null;
  const dest = path.join(night.worktree, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(repo.policyFile, dest);
  git(night.worktree, ['add', '-f', rel]);
  git(night.worktree, ['commit', '-m', POLICY_COMMIT, '--no-verify']);
  return headSha(night.worktree);
}

async function phaseSetup(repo, policy, night) {
  if (!isClean(night.worktree)) {
    night.phase = 'blocked';
    night.blockedReason = `Worktree ${night.worktree} has uncommitted changes (another session?). Inspect it; run \`evolve tick --retry\` once it is clean.`;
    return;
  }
  const logDir = path.join(nightDir(repo, night), 'logs');
  for (const cmd of policy.worktree.setup || []) {
    const res = await run(expand(cmd, vars(repo, night)), { cwd: night.worktree, timeoutMs: num(policy.worktree.setup_timeout_minutes, 20) * 60_000, logFile: path.join(logDir, `setup-${Date.now()}.log`) });
    recordCompute(night, `setup: ${cmd}`, res.ms);
    if (res.code !== 0) {
      night.phase = 'blocked';
      night.blockedReason = `Setup "${cmd}" failed (exit ${res.code}). Log: ${toPosix(logDir)}. Fix worktree.setup in the policy, then \`evolve tick --retry\`.`;
      return;
    }
  }
  const policySha = night.dryRun ? null : trackPolicy(repo, policy, night);
  if (policySha) night.notes.push(`Committed .evolution/policy.yaml for review (${policySha.slice(0, 8)}).`);
  night.phase = 'baseline';
}

async function phaseBaseline(repo, policy, night, { quick, budgetMs }) {
  const store = readJson(repo.baselinesFile, { version: 1, bySha: {}, series: {} });
  const cached = store.bySha?.[night.baseSha]?.metrics || {};
  const todo = policy.metrics.filter((m) => (!quick || m.quick) && !night.baseline.metrics[m.name] && !night.baseline.metrics[`${m.name}.p50`]);
  for (const m of todo) {
    const hit = cached[m.name] || cached[`${m.name}.p50`];
    if (hit?.ok && !m.no_cache) {
      for (const [k, v] of Object.entries(cached)) if (k === m.name || k.startsWith(`${m.name}.`)) night.baseline.metrics[k] = { ...v, cached: true };
    }
  }
  const remaining = todo.filter((m) => !night.baseline.metrics[m.name] && !night.baseline.metrics[`${m.name}.p50`]);
  const started = Date.now();
  const results = await measureAll(remaining, { cwd: night.worktree, vars: vars(repo, night), logDir: path.join(nightDir(repo, night), 'logs') }, { quick, budgetMs });
  recordCompute(night, 'baseline metrics', Date.now() - started);
  for (const [k, v] of Object.entries(results)) if (!(v.skipped && v.error === 'tick time budget exhausted')) night.baseline.metrics[k] = v;
  const done = policy.metrics.filter((m) => !quick || m.quick).every((m) => night.baseline.metrics[m.name] || night.baseline.metrics[`${m.name}.p50`]);
  if (!done) return false;
  if (!night.dryRun) {
    store.bySha ||= {};
    store.series ||= {};
    const slim = Object.fromEntries(Object.entries(night.baseline.metrics).map(([k, v]) => [k, pick(v, ['ok', 'value', 'unit', 'better', 'at', 'error'])]));
    store.bySha[night.baseSha] = { at: nowIso(), night: night.night, metrics: slim };
    for (const [k, v] of Object.entries(night.baseline.metrics)) {
      if (!v.ok || v.cached) continue;
      (store.series[k] ||= []).push({ sha: night.baseSha, night: night.night, value: v.value, at: v.at });
      store.series[k] = store.series[k].slice(-60);
    }
    const shas = Object.keys(store.bySha);
    for (const s of shas.slice(0, Math.max(0, shas.length - 30))) delete store.bySha[s];
    writeAtomic(repo.baselinesFile, formatJson(store));
  }
  night.phase = 'survey';
  return true;
}

async function phaseSurvey(repo, policy, night, { quick }) {
  const dir = nightDir(repo, night);
  const started = Date.now();
  const s = await runSurvey({ repo, policy: quick ? { ...policy, survey: { ...policy.survey, commands: [] } } : policy, cwd: night.worktree, night, logDir: path.join(dir, 'logs') });
  recordCompute(night, 'survey', Date.now() - started);
  writeJson(path.join(dir, 'survey.json'), s);
  writeAtomic(path.join(dir, 'survey.md'), surveyMarkdown(s));
  night.surveyFile = toPosix(path.join(dir, 'survey.md'));
  night.phase = 'triage';
}

function budgetsExhausted(policy, night) {
  const attempted = night.candidates.filter((c) => ['accepted', 'rejected'].includes(c.status)).length;
  const accepted = night.candidates.filter((c) => c.status === 'accepted').length;
  const tokens = night.usage.reduce((a, u) => a + (u.tokens || 0), 0);
  const usd = night.usage.reduce((a, u) => a + (u.usd || 0), 0);
  if (accepted >= policy.budgets.max_accepted) return `accepted ${accepted}/${policy.budgets.max_accepted}`;
  if (attempted >= policy.budgets.max_experiments) return `attempted ${attempted}/${policy.budgets.max_experiments}`;
  if (tokens >= policy.ai.max_tokens) return `tokens ${tokens}/${policy.ai.max_tokens}`;
  if (usd > (policy.ai.paid_allowed ? policy.ai.max_paid_usd : 0)) return `paid usage $${usd.toFixed(2)} exceeds the allowed $${policy.ai.paid_allowed ? policy.ai.max_paid_usd : 0}`;
  return null;
}

async function refreshLocks(repo, policy, night, force = false) {
  const age = night.locks ? Date.now() - Date.parse(night.locks.at) : Infinity;
  if (!force && age < 30 * 60_000) return night.locks;
  const l = await lockedPaths(repo, policy, { ownWorktree: night.worktree, base: night.baseSha });
  night.locks = { at: nowIso(), ...l };
  return night.locks;
}

function score(policy, c) {
  const w = Number(policy.priorities[c.dimension] ?? 1);
  return Number(((c.impact * c.confidence * Math.max(w, 0.5)) / (c.cost * c.risk)).toFixed(2));
}

function beginCandidate(night, c, agent) {
  c.status = 'running';
  c.startSha = headSha(night.worktree);
  c.startedAt = nowIso();
  c.lastActivityAt = nowIso();
  c.agent = agent || null;
}

function revertTo(night, sha) {
  git(night.worktree, ['reset', '--hard', sha]);
  git(night.worktree, ['clean', '-fd']);
}

function rejectCandidate(repo, night, c, reason) {
  revertTo(night, c.startSha);
  c.status = 'rejected';
  c.reason = reason;
  c.finishedAt = nowIso();
  record(repo, { kind: 'experiment', verdict: 'rejected', night: night.night, id: c.id, dimension: c.dimension, title: c.title, fingerprint: c.fingerprint, files: c.files, reason, evidence: c.verification ? { comparisons: c.verification.comparisons, checks: c.verification.checks?.map((k) => ({ name: k.name, ok: k.ok })) } : undefined }, { dryRun: night.dryRun });
}

async function phaseExperiment(repo, policy, night, agent) {
  const running = night.candidates.find((c) => c.status === 'running');
  if (running) {
    const idle = Date.now() - Date.parse(running.lastActivityAt || running.startedAt);
    if (idle > policy.budgets.max_attempt_minutes * 60_000) {
      rejectCandidate(repo, night, running, `Timed out: no progress for ${Math.round(idle / 60_000)} min (budget ${policy.budgets.max_attempt_minutes}).`);
    } else {
      return { action: 'continue', candidate: running };
    }
  }
  const exhausted = budgetsExhausted(policy, night);
  if (exhausted) {
    night.phase = 'finalize';
    night.notes.push(`Budget reached: ${exhausted}.`);
    return null;
  }
  const locks = await refreshLocks(repo, policy, night);
  const pending = night.candidates.filter((c) => c.status === 'pending').sort((a, b) => b.score - a.score);
  for (const c of pending) {
    const hits = overlaps(c.files || [], locks.paths);
    if (hits.length) {
      c.status = 'blocked';
      c.reason = `Overlaps in-flight work: ${hits.slice(0, 3).map((h) => `${h.file} (${h.lockedBy})`).join('; ')}`;
      continue;
    }
    beginCandidate(night, c, agent);
    return { action: 'implement', candidate: c };
  }
  night.phase = 'finalize';
  night.notes.push('No runnable candidates left.');
  return null;
}

async function phaseFinalize(repo, policy, night, { quick, budgetMs, push = true }) {
  night.final ||= { metrics: {} };
  const todo = policy.metrics.filter((m) => (!quick || m.quick) && !night.final.metrics[m.name] && !night.final.metrics[`${m.name}.p50`]);
  const started = Date.now();
  const res = await measureAll(todo, { cwd: night.worktree, vars: vars(repo, night), logDir: path.join(nightDir(repo, night), 'logs') }, { quick, budgetMs });
  recordCompute(night, 'final metrics', Date.now() - started);
  for (const [k, v] of Object.entries(res)) if (!(v.skipped && v.error === 'tick time budget exhausted')) night.final.metrics[k] = v;
  if (!policy.metrics.filter((m) => !quick || m.quick).every((m) => night.final.metrics[m.name] || night.final.metrics[`${m.name}.p50`])) return false;

  const history = readHistory(repo, { dryRun: night.dryRun });
  const report = renderReport({ night, policy, finalMetrics: night.final.metrics, history });
  const reportFile = path.join(nightDir(repo, night), 'report.md');
  writeAtomic(reportFile, report);
  night.reportFile = toPosix(reportFile);
  const accepted = night.candidates.filter((c) => c.status === 'accepted');
  const ahead = commitsSince(night.worktree, night.baseSha).length;

  if (accepted.length && policy.pr.enabled && !night.dryRun && push && policy.pr.push !== false) {
    const remote = policy.repo.remote || 'origin';
    const p = runSync(['git', 'push', '-u', remote, night.branch], { cwd: night.worktree, allowFail: true, timeoutMs: 180_000 });
    if (p.code !== 0) night.notes.push(`Push failed: ${p.stderr.split('\n').slice(-2).join(' ')}`);
    else if (commandExists('gh')) {
      const title = `Nightly evolution ${night.night}: ${accepted.length} improvement${accepted.length === 1 ? '' : 's'}`;
      const existing = runSync(['gh', 'pr', 'list', '--head', night.branch, '--state', 'open', '--json', 'number,url'], { cwd: night.worktree, allowFail: true });
      const pr = existing.code === 0 ? JSON.parse(existing.stdout || '[]')[0] : null;
      const args = pr
        ? ['gh', 'pr', 'edit', String(pr.number), '--title', title, '--body-file', reportFile]
        : ['gh', 'pr', 'create', '--base', night.base, '--head', night.branch, '--title', title, '--body-file', reportFile, ...(policy.pr.draft !== false ? ['--draft'] : []), ...policy.pr.labels.flatMap((l) => ['--label', l])];
      const r = runSync(args, { cwd: night.worktree, allowFail: true, timeoutMs: 120_000 });
      if (r.code === 0) night.pr = pr?.url || r.stdout.trim().split('\n').pop();
      else night.notes.push(`PR ${pr ? 'update' : 'creation'} failed: ${r.stderr.split('\n')[0]}`);
    } else night.notes.push('gh CLI not found; branch pushed without a PR.');
  }

  record(repo, { kind: 'run', night: night.night, verdict: 'finished', title: `Night ${night.night}`, summary: `${accepted.length} accepted, ${night.candidates.filter((c) => c.status === 'rejected').length} rejected, ${night.candidates.filter((c) => c.status === 'blocked').length} blocked`, pr: night.pr || null, branch: night.branch, report: night.reportFile }, { dryRun: night.dryRun });

  // Free the disk: the branch (and PR) keep the work; an empty branch is deleted.
  const keepBranch = ahead > 0 && accepted.length > 0;
  const rm = git(repo.main, ['worktree', 'remove', '--force', night.worktree], { allowFail: true });
  if (rm.code !== 0) night.notes.push(`Worktree removal failed: ${rm.stderr}`);
  else if (!night.adopted) {
    try {
      fs.rmdirSync(path.dirname(night.worktree));
    } catch {
      // Not empty (other worktrees live there) or already gone.
    }
  }
  if (!keepBranch) git(repo.main, ['branch', '-D', night.branch], { allowFail: true });
  night.branchKept = keepBranch;
  night.phase = 'done';
  night.finishedAt = nowIso();
  return true;
}

// ---- tick: one bounded step ------------------------------------------------------------

function instructions(repo, policy, night, step) {
  const c = step?.candidate;
  const refs = (d) => toPosix(path.join(SKILL_DIR, DIMENSIONS[d] || 'evaluation.md'));
  switch (night.phase) {
    case 'triage':
      return {
        action: 'triage',
        why: 'Deterministic survey is ready. Turn evidence into scored candidates (no implementation yet).',
        read: [night.surveyFile, toPosix(path.join(SKILL_DIR, 'SKILL.md'))],
        next: [
          `For each idea: ${cli(repo, 'candidate add --dimension <dim> --title "<title>" --hypothesis "<expected measurable effect>" --files <paths> --metrics <metric names> --impact 1-5 --confidence 1-5 --cost 1-5 --risk 1-5')}`,
          `Record research/library verdicts: ${cli(repo, 'memory add --kind library --library <name> --verdict adopt|reject|defer --reason "<why>" --sources <urls>')}`,
          `When done: ${cli(repo, 'triage done')} then ${cli(repo, 'tick')}`,
        ],
        dimensions: Object.keys(DIMENSIONS),
        focus: (policy.focus || []).filter((f) => f.goals?.length).map((f) => ({ area: f.area, goals: f.goals })),
        rules: policy.instructions.length ? policy.instructions : undefined,
      };
    case 'experiment':
      if (!c) return { action: 'tick-again', why: 'Selecting the next experiment.', next: [cli(repo, 'tick')] };
      return {
        action: step.action,
        why: step.action === 'implement' ? `Highest-scoring runnable candidate (score ${c.score}).` : 'This candidate is still in progress.',
        candidate: { id: c.id, dimension: c.dimension, title: c.title, hypothesis: c.hypothesis, files: c.files, metrics: c.metrics, ui: c.ui },
        worktree: night.worktree,
        read: [refs(c.dimension), toPosix(path.join(SKILL_DIR, 'evaluation.md'))],
        rules: [
          `Work only in ${night.worktree}; make small atomic commits there.`,
          'Never edit protected paths, credentials, migrations, billing or production configuration.',
          policy.ai.routing_policy ? `In-product AI changes must go through ${policy.ai.routing_policy}; never add a paid provider.` : 'Never add or call a paid API without explicit policy permission.',
          c.ui ? `UI change: capture evidence with ${cli(repo, `screenshot --candidate ${c.id} --page <name>`)} before accepting.` : null,
          ...policy.instructions,
        ].filter(Boolean),
        next: [`${cli(repo, `verify ${c.id}`)}`, `pass -> ${cli(repo, `experiment accept ${c.id} --evidence "<what the numbers show>"`)}`, `fail -> ${cli(repo, `experiment reject ${c.id} --reason "<why>"`)}`, cli(repo, 'tick')],
      };
    case 'blocked':
      return { action: 'blocked', why: night.blockedReason, next: [cli(repo, 'tick --retry')] };
    case 'done':
      return { action: 'idle', why: 'Tonight is complete.', pr: night.pr || null, report: night.reportFile };
    default:
      return { action: 'tick-again', why: `Phase ${night.phase} continues on the next tick (time budget).`, next: [cli(repo, 'tick')] };
  }
}

async function tick(repo, opt) {
  const { policy, warnings } = loadPolicy(repo);
  const agent = opt.agent || process.env.EVOLVE_AGENT || null;
  const quick = Boolean(opt.quick);
  const budgetMs = num(opt['budget-minutes'], policy.budgets.max_tick_minutes) * 60_000;
  const lock = acquireLock(repo, `tick${agent ? ` (${agent})` : ''}`);
  try {
    let night = activeNight(repo);
    if (!night) {
      if (!opt.force && !inWindow(policy.schedule.window)) return { action: 'idle', why: `Outside the evolution window ${policy.schedule.window}.`, next: [`${cli(repo, 'tick --force')} to start anyway`] };
      const today = loadNight(repo, nightDate(policy.schedule.window));
      if (today?.phase === 'done' && !opt.force) return { action: 'idle', why: `Tonight (${today.night}) is already complete.`, pr: today.pr || null, report: today.reportFile };
      try {
        night = startNight(repo, policy, { agent });
      } catch (err) {
        if (err.code !== 'FOREIGN_BRANCH') throw err;
        return { action: 'idle', why: err.message };
      }
    }
    const running = night.candidates.find((c) => c.status === 'running');
    if (running && agent && running.agent && running.agent !== agent && Date.now() - Date.parse(running.lastActivityAt) < policy.budgets.max_attempt_minutes * 60_000) {
      return { action: 'wait', why: `${running.agent} is mid-experiment on ${running.id}; not taking over a live attempt.`, night: night.night };
    }
    night.ticks++;
    night.lastTickAt = nowIso();
    if (agent) night.agent = agent;
    const deadline = Date.parse(night.windowEndAt) - num(policy.schedule.finalize_before_end_minutes, 45) * 60_000;
    if (['triage', 'experiment'].includes(night.phase) && Date.now() >= deadline) {
      const r = night.candidates.find((c) => c.status === 'running');
      if (r) rejectCandidate(repo, night, r, 'Window closing before the experiment was verified.');
      night.phase = 'finalize';
      night.notes.push('Window closing: finalized.');
    }
    if (night.phase === 'blocked' && opt.retry) night.phase = 'setup';
    if (night.phase === 'blocked' && Date.now() >= deadline) night.phase = 'finalize';

    const started = Date.now();
    let step = null;
    while (Date.now() - started < budgetMs) {
      const remaining = budgetMs - (Date.now() - started);
      const before = night.phase;
      if (night.phase === 'setup') await phaseSetup(repo, policy, night);
      else if (night.phase === 'baseline') {
        if (!(await phaseBaseline(repo, policy, night, { quick, budgetMs: remaining }))) break;
      } else if (night.phase === 'survey') await phaseSurvey(repo, policy, night, { quick });
      else if (night.phase === 'experiment') {
        step = await phaseExperiment(repo, policy, night, agent);
        if (step) break;
      } else if (night.phase === 'finalize') {
        if (!(await phaseFinalize(repo, policy, night, { quick, budgetMs: remaining, push: !opt['no-push'] }))) break;
      } else break;
      saveNight(repo, night);
      if (night.phase === before) break;
    }
    saveNight(repo, night);
    return { repo: policy.repo.name, night: night.night, phase: night.phase, branch: night.branch, ...instructions(repo, policy, night, step), warnings: warnings.length ? warnings : undefined, notes: night.notes.slice(-5) };
  } finally {
    lock.release();
  }
}

// ---- verification ----------------------------------------------------------------------

async function runChecks(repo, policy, night, files) {
  const results = [];
  for (const c of policy.checks) {
    if (c.when?.length && !files.some((f) => matchesAny(f, c.when))) continue;
    const unmet = await requirementsUnmet(c);
    if (unmet) {
      results.push({ name: c.name, ok: !c.required, skipped: true, reason: unmet });
      continue;
    }
    const v = vars(repo, night);
    if (c.run.includes('{related_tests}')) {
      const tests = relatedTests(night.worktree, files, c.cwd || '');
      if (!tests.length) {
        results.push({ name: c.name, ok: !c.required, skipped: true, reason: 'no tests relate to the changed files' });
        continue;
      }
      v.related_tests = tests.slice(0, 60).map((t) => `"${t}"`).join(' ');
    }
    if (c.run.includes('{changed_files}')) {
      const prefix = c.cwd ? `${toPosix(c.cwd).replace(/\/+$/, '')}/` : '';
      const changed = files
        .filter((f) => f.startsWith(prefix) && (!c.when?.length || matchesAny(f, c.when)) && fs.existsSync(path.join(night.worktree, f)))
        .map((f) => f.slice(prefix.length));
      if (!changed.length) {
        results.push({ name: c.name, ok: !c.required, skipped: true, reason: 'no matching changed files' });
        continue;
      }
      v.changed_files = changed.slice(0, 200).map((f) => `"${f}"`).join(' ');
    }
    const res = await run(expand(c.run, v), {
      cwd: c.cwd ? path.join(night.worktree, c.cwd) : night.worktree,
      timeoutMs: num(c.timeout_minutes, 20) * 60_000,
      env: c.env,
      logFile: path.join(nightDir(repo, night), 'logs', `check-${c.name}-${Date.now()}.log`),
    });
    recordCompute(night, `check ${c.name}`, res.ms);
    results.push({ name: c.name, ok: res.code === 0, exit: res.code, ms: res.ms, timedOut: res.timedOut, tail: res.code === 0 ? undefined : `${res.stdout}\n${res.stderr}`.trim().slice(-1500) });
  }
  return results;
}

async function verify(repo, opt, id) {
  const { policy } = loadPolicy(repo);
  const lock = acquireLock(repo, `verify ${id}`);
  try {
    const night = requireNight(repo, opt);
    const c = findCandidate(night, id);
    if (c.status !== 'running') throw new Error(`${id} is ${c.status}, not running`);
    c.lastActivityAt = nowIso();
    const failures = [];
    if (!isClean(night.worktree)) failures.push('Worktree has uncommitted changes: commit (atomically) or discard them first.');
    const commits = commitsSince(night.worktree, c.startSha);
    if (!commits.length) failures.push('No commits since the experiment began.');
    const files = changedFiles(night.worktree, c.startSha);
    const prot = protectedHits(files, policy);
    if (prot.length) failures.push(`Touches protected paths: ${prot.join(', ')}`);
    const locks = await refreshLocks(repo, policy, night, true);
    const lockHits = overlaps(files, locks.paths);
    if (lockHits.length) failures.push(`Overlaps in-flight work: ${lockHits.slice(0, 5).map((h) => `${h.file} (${h.lockedBy})`).join('; ')}`);
    const outsideDeclared = c.files?.length ? files.filter((f) => !c.files.some((d) => matchesAny(f, [d]) || toPosix(f).startsWith(`${toPosix(d).replace(/\/$/, '')}/`) || f === d)) : [];

    let checks = [];
    let comparisons = {};
    if (!failures.length) {
      checks = await runChecks(repo, policy, night, files);
      for (const k of checks) if (!k.ok) failures.push(`Check ${k.name} failed${k.timedOut ? ' (timeout)' : ''}.`);
      const metricNames = new Set([...(c.metrics || []), ...policy.metrics.filter((m) => m.always || (m.when?.length && files.some((f) => matchesAny(f, m.when)))).map((m) => m.name)]);
      const defs = policy.metrics.filter((m) => metricNames.has(m.name));
      const started = Date.now();
      const after = await measureAll(defs, { cwd: night.worktree, vars: vars(repo, night), logDir: path.join(nightDir(repo, night), 'logs') });
      recordCompute(night, `verify metrics ${id}`, Date.now() - started);
      for (const [k, v] of Object.entries(after)) {
        const def = policy.metrics.find((m) => m.name === k || k.startsWith(`${m.name}.`)) || {};
        const before = night.current[k] || night.baseline.metrics[k];
        comparisons[k] = { ...compare(def, before, v), afterResult: v.ok ? undefined : v.error };
        if (comparisons[k].verdict === 'regressed' && comparisons[k].gate) failures.push(`Gating metric ${k} regressed ${comparisons[k].pct}% (tolerance ${def.tolerance_pct ?? 5}%).`);
      }
      night.pendingAfter = { ...(night.pendingAfter || {}), [id]: after };
      const targets = (c.metrics || []).flatMap((m) => Object.keys(comparisons).filter((k) => k === m || k.startsWith(`${m}.`)));
      if (targets.length && !targets.some((k) => comparisons[k].verdict === 'improved')) failures.push(`No measured improvement on the target metric(s): ${targets.map((k) => `${k} ${comparisons[k].verdict}${comparisons[k].pct != null ? ` ${comparisons[k].pct}%` : ''}`).join(', ')}.`);
    }
    c.commits = commits.reverse();
    c.verification = { sha: headSha(night.worktree), at: nowIso(), ok: failures.length === 0, failures, checks, comparisons, files, outsideDeclared };
    saveNight(repo, night);
    return { id, ok: c.verification.ok, failures, checks: checks.map(({ tail, ...k }) => ({ ...k, tail: k.ok ? undefined : tail?.slice(-600) })), comparisons, outsideDeclared: outsideDeclared.length ? outsideDeclared : undefined, next: c.verification.ok ? cli(repo, `experiment accept ${id} --evidence "<summary>"`) : cli(repo, `experiment reject ${id} --reason "<why>"`) };
  } finally {
    lock.release();
  }
}

// ---- commands --------------------------------------------------------------------------

async function main() {
  const { pos, opt } = parseArgs(process.argv.slice(2));
  const cmd = pos[0];
  if (!cmd || opt.help || cmd === 'help') return usage();
  const repo = resolveRepo(opt.repo ? path.resolve(String(opt.repo)) : process.cwd());

  switch (cmd) {
    case 'discover':
      return out(discover(repo));

    case 'init': {
      const profile = discover(repo);
      fs.mkdirSync(repo.evoDir, { recursive: true });
      const created = [];
      if (!fs.existsSync(repo.policyFile) || opt.force) {
        writeAtomic(repo.policyFile, policyToYaml(generatePolicy(profile), [`Generated ${nowIso()} from discovery; review priorities and focus.`]));
        created.push('policy.yaml');
      }
      if (!fs.existsSync(repo.baselinesFile)) {
        writeAtomic(repo.baselinesFile, formatJson({ version: 1, bySha: {}, series: {} }));
        created.push('baselines.json');
      }
      if (!fs.existsSync(repo.historyFile)) {
        fs.writeFileSync(repo.historyFile, '');
        created.push('history.jsonl');
      }
      migrateState(repo);
      writeJson(path.join(repo.stateDir, 'profile.json'), profile);
      const excluded = ensureExcluded(repo, ['.evolution/']);
      const { policy } = loadPolicy(repo);
      registerRepo(repo, policy.repo.name);
      return out({ repo: toPosix(repo.main), created, kept: ['policy.yaml', 'baselines.json', 'history.jsonl'].filter((f) => !created.includes(f)), excluded, loops: profile.loops, next: cli(repo, 'validate') });
    }

    case 'validate': {
      const raw = parseYaml(fs.readFileSync(repo.policyFile, 'utf8'));
      const res = validatePolicy(deepMerge(DEFAULTS, raw));
      out({ policy: toPosix(repo.policyFile), ok: !res.errors.length, ...res });
      process.exitCode = res.errors.length ? 1 : 0;
      return;
    }

    case 'tick':
      return out(await tick(repo, opt));

    case 'status': {
      const nights = listNights(repo).slice(-5);
      const n = opt.night ? loadNight(repo, opt.night) : activeNight(repo, { includeDryRun: true }) || nights[nights.length - 1];
      return out({
        repo: toPosix(repo.main),
        night: n && { id: n.night, phase: n.phase, branch: n.branch, worktree: n.worktree, ticks: n.ticks, lastTickAt: n.lastTickAt, windowEndAt: n.windowEndAt, pr: n.pr, report: n.reportFile, blockedReason: n.blockedReason, notes: n.notes },
        candidates: n?.candidates.map((c) => ({ id: c.id, status: c.status, score: c.score, dimension: c.dimension, title: c.title, reason: c.reason })),
        recent: nights.map((x) => ({ night: x.night, phase: x.phase, pr: x.pr || null, accepted: x.candidates.filter((c) => c.status === 'accepted').length })),
      });
    }

    case 'measure': {
      const { policy } = loadPolicy(repo);
      const night = opt.night || activeNight(repo, { includeDryRun: true }) ? requireNight(repo, { ...opt, 'dry-run': true }) : null;
      const cwd = night?.worktree || repo.top;
      const res = await measureAll(policy.metrics, { cwd, vars: vars(repo, night), logDir: night ? path.join(nightDir(repo, night), 'logs') : path.join(repo.stateDir, 'adhoc-logs') }, { quick: Boolean(opt.quick), only: opt.only ? list(opt.only) : undefined });
      return out({ cwd: toPosix(cwd), metrics: res });
    }

    case 'candidate': {
      const sub = pos[1];
      const { policy } = loadPolicy(repo);
      if (sub === 'list') {
        const night = requireNight(repo, opt);
        return out(night.candidates.map(({ verification, ...c }) => ({ ...c, verified: verification?.ok })));
      }
      if (sub !== 'add') throw new Error('Usage: candidate add|list');
      const lock = acquireLock(repo, 'candidate add');
      try {
        const night = requireNight(repo, opt);
        const dimension = String(opt.dimension || '');
        if (!(dimension in DIMENSIONS)) throw new Error(`--dimension must be one of ${Object.keys(DIMENSIONS).join(', ')}`);
        if (!opt.title || opt.title === true) throw new Error('--title is required');
        const metricNames = list(opt.metrics);
        const known = new Set(policy.metrics.map((m) => m.name));
        const unknown = metricNames.filter((m) => !known.has(m));
        if (unknown.length) throw new Error(`Unknown metric(s) ${unknown.join(', ')}; define them in the policy or omit --metrics.`);
        const c = {
          id: `c${night.candidates.length + 1}`,
          dimension,
          title: String(opt.title),
          hypothesis: opt.hypothesis === true ? '' : opt.hypothesis || '',
          files: list(opt.files),
          metrics: metricNames,
          ui: Boolean(opt.ui) || list(opt.files).some((f) => /\.(tsx|jsx|css|scss|vue|svelte|html)$/.test(f)),
          impact: num(opt.impact, 3),
          confidence: num(opt.confidence, 3),
          cost: Math.max(1, num(opt.cost, 3)),
          risk: Math.max(1, num(opt.risk, 2)),
          tradeoffs: opt.tradeoffs === true ? undefined : opt.tradeoffs,
          status: 'pending',
          addedAt: nowIso(),
        };
        c.fingerprint = fingerprint(c);
        c.score = score(policy, c);
        const similar = [...findSimilar(readHistory(repo), c), ...night.candidates.filter((x) => x.fingerprint === c.fingerprint).map((x) => ({ ...x, match: 'tonight' }))];
        if (similar.length && !opt['retry-reason']) {
          process.exitCode = 3;
          return out({ added: false, why: 'Already tried or researched; pass --retry-reason "<new evidence>" to try again.', similar: similar.slice(0, 5).map((s) => ({ night: s.night, kind: s.kind, verdict: s.verdict, title: s.title, reason: s.reason, match: s.match })) });
        }
        if (opt['retry-reason']) c.retryReason = String(opt['retry-reason']);
        if (protectedHits(c.files, policy).length) {
          process.exitCode = 3;
          return out({ added: false, why: `Targets protected paths: ${protectedHits(c.files, policy).join(', ')}` });
        }
        night.candidates.push(c);
        saveNight(repo, night);
        return out({ added: true, id: c.id, score: c.score, ui: c.ui });
      } finally {
        lock.release();
      }
    }

    case 'triage': {
      if (pos[1] !== 'done') throw new Error('Usage: triage done [--none "<reason>"]');
      const lock = acquireLock(repo, 'triage done');
      try {
        const night = requireNight(repo, opt);
        if (night.phase !== 'triage') throw new Error(`Night is in phase ${night.phase}, not triage`);
        if (!night.candidates.length && !opt.none) throw new Error('No candidates added. Add some, or pass --none "<reason>".');
        night.phase = night.candidates.length ? 'experiment' : 'finalize';
        if (opt.none) night.notes.push(`Triage found nothing worth trying: ${opt.none}`);
        saveNight(repo, night);
        return out({ phase: night.phase, candidates: night.candidates.length, next: cli(repo, 'tick') });
      } finally {
        lock.release();
      }
    }

    case 'verify':
      return out(await verify(repo, opt, pos[1]));

    case 'experiment': {
      const [, sub, id] = pos;
      const lock = acquireLock(repo, `experiment ${sub} ${id}`);
      try {
        const night = requireNight(repo, opt);
        const c = findCandidate(night, id);
        if (sub === 'begin') {
          if (night.candidates.some((x) => x.status === 'running' && x.id !== id)) throw new Error('Another experiment is running; finish it first.');
          if (!isClean(night.worktree)) throw new Error('Worktree is not clean.');
          beginCandidate(night, c, opt.agent || process.env.EVOLVE_AGENT);
        } else if (sub === 'accept') {
          if (c.status !== 'running') throw new Error(`${id} is ${c.status}`);
          if (!c.verification?.ok) throw new Error(`${id} has no passing verification. Run verify first.`);
          if (c.verification.sha !== headSha(night.worktree)) throw new Error('HEAD moved since verification; verify again.');
          if (c.ui && !(c.screenshots || []).length && !opt['no-ui-evidence']) throw new Error('UI change without screenshots. Capture with `evolve screenshot --candidate`, or pass --no-ui-evidence "<why>".');
          if (!c.metrics?.length && (!opt.evidence || opt.evidence === true)) throw new Error('No target metric: --evidence "<tests added / behaviour proven>" is required.');
          c.status = 'accepted';
          c.evidence = opt.evidence === true ? undefined : opt.evidence;
          if (opt.tradeoffs && opt.tradeoffs !== true) c.tradeoffs = opt.tradeoffs;
          if (opt['no-ui-evidence']) c.uiEvidenceWaiver = String(opt['no-ui-evidence']);
          c.finishedAt = nowIso();
          Object.assign(night.current, night.pendingAfter?.[id] || {});
          record(repo, { kind: 'experiment', verdict: 'accepted', night: night.night, id, dimension: c.dimension, title: c.title, fingerprint: c.fingerprint, files: c.verification.files, commits: c.commits.map((x) => x.sha), evidence: { notes: c.evidence, comparisons: c.verification.comparisons } }, { dryRun: night.dryRun });
        } else if (sub === 'reject') {
          if (c.status !== 'running') throw new Error(`${id} is ${c.status}`);
          if (!opt.reason || opt.reason === true) throw new Error('--reason is required');
          rejectCandidate(repo, night, c, String(opt.reason));
        } else throw new Error('Usage: experiment begin|accept|reject <id>');
        saveNight(repo, night);
        return out({ id, status: c.status, head: headSha(night.worktree), next: cli(repo, 'tick') });
      } finally {
        lock.release();
      }
    }

    case 'memory': {
      const sub = pos[1];
      if (sub === 'search') return out(search(repo, pos.slice(2).join(' ') || String(opt.query || ''), { global: Boolean(opt.global) }));
      if (sub === 'digest') return out(digest(repo));
      if (sub === 'add') {
        const night = activeNight(repo);
        const entry = {
          kind: String(opt.kind || ''),
          night: night?.night,
          dimension: opt.dimension === true ? undefined : opt.dimension,
          title: opt.title === true ? undefined : opt.title || opt.library,
          library: opt.library === true ? undefined : opt.library,
          verdict: opt.verdict === true ? undefined : opt.verdict,
          reason: opt.reason === true ? undefined : opt.reason,
          summary: opt.summary === true ? undefined : opt.summary,
          sources: list(opt.sources),
        };
        if (!entry.title) throw new Error('--title (or --library) is required');
        entry.fingerprint = fingerprint({ dimension: entry.dimension, title: entry.title, files: [] });
        const dup = findSimilar(readHistory(repo), { dimension: entry.dimension, title: entry.title, library: entry.library }).filter((s) => s.kind === entry.kind);
        if (dup.length && !opt.force) return out({ added: false, why: 'Already recorded', similar: dup.slice(0, 3) });
        return out({ added: true, entry: record(repo, entry) });
      }
      throw new Error('Usage: memory add|search|digest');
    }

    case 'usage': {
      const lock = acquireLock(repo, 'usage');
      try {
        const { policy } = loadPolicy(repo);
        const night = requireNight(repo, opt);
        const u = { at: nowIso(), tokens: num(opt.tokens, 0), usd: num(opt.usd, 0), model: opt.model === true ? undefined : opt.model, note: opt.note === true ? undefined : opt.note };
        night.usage.push(u);
        saveNight(repo, night);
        const over = budgetsExhausted(policy, night);
        const paidViolation = u.usd > 0 && !policy.ai.paid_allowed;
        if (paidViolation) night.notes.push(`Paid usage $${u.usd} recorded although ai.paid_allowed is false.`);
        saveNight(repo, night);
        return out({ recorded: u, budget: over || 'ok', paidViolation });
      } finally {
        lock.release();
      }
    }

    case 'screenshot': {
      const { policy } = loadPolicy(repo);
      const { loadPlaywright, capture, compareImages, withServer } = await import('./lib/screenshot.mjs');
      const night = activeNight(repo, { includeDryRun: true });
      const cwd = night?.worktree || repo.main;
      const page = opt.page ? (policy.ui.pages || []).find((p) => p.name === opt.page) : null;
      if (opt.page && !page) throw new Error(`No ui.pages entry named ${opt.page}`);
      const base = policy.ui.serve?.url?.replace(/\/$/, '') || '';
      const url = opt.url && opt.url !== true ? String(opt.url) : page ? (/^https?:/.test(page.path) ? page.path : `${base}${page.path}`) : null;
      if (!url) throw new Error('--url or --page is required');
      const name = String(opt.name || page?.name || 'page');
      const dir = night ? path.join(nightDir(repo, night), 'screens') : path.join(repo.stateDir, 'screens');
      const pw = await loadPlaywright([path.join(cwd, policy.ui.playwright_from || '.'), path.join(repo.main, policy.ui.playwright_from || '.'), cwd, repo.main]);
      const label = opt.candidate ? `${opt.candidate}-${name}` : name;
      const shot = await withServer(opt.serve ? policy.ui.serve : null, cwd, vars(repo, night), () =>
        capture(pw, { url, file: path.join(dir, `${label}.png`), viewport: policy.ui.viewport, colorScheme: page?.color_scheme }),
      );
      const refRel = opt.reference && opt.reference !== true ? String(opt.reference) : page?.reference;
      if (refRel) {
        const ref = path.isAbsolute(refRel) ? refRel : path.join(repo.main, refRel);
        Object.assign(shot, await compareImages(pw, shot.file, ref, path.join(dir, `${label}.diff.png`)), { reference: toPosix(refRel) });
        shot.withinBudget = shot.diffRatio <= num(page?.max_diff_ratio, policy.ui.max_diff_ratio);
      }
      if (night && opt.candidate) {
        const lock = acquireLock(repo, 'screenshot');
        try {
          const fresh = loadNight(repo, night.night);
          const c = findCandidate(fresh, String(opt.candidate));
          (c.screenshots ||= []).push({ name, file: toPosix(shot.file), diffRatio: shot.diffRatio ?? null, reference: shot.reference, at: nowIso() });
          c.lastActivityAt = nowIso();
          saveNight(repo, fresh);
        } finally {
          lock.release();
        }
      }
      return out({ ...shot, file: toPosix(shot.file) });
    }

    case 'report': {
      const { policy } = loadPolicy(repo);
      const night = requireNight(repo, { ...opt, 'dry-run': true });
      const text = renderReport({ night, policy, finalMetrics: night.final?.metrics || night.current, history: readHistory(repo, { dryRun: night.dryRun }) });
      const file = path.join(nightDir(repo, night), 'report.md');
      writeAtomic(file, text);
      return opt.print ? process.stdout.write(text) : out({ report: toPosix(file) });
    }

    case 'finish': {
      const { policy } = loadPolicy(repo);
      const lock = acquireLock(repo, 'finish');
      try {
        const night = requireNight(repo, opt);
        const r = night.candidates.find((c) => c.status === 'running');
        if (r) rejectCandidate(repo, night, r, 'Finished before the experiment was verified.');
        night.phase = 'finalize';
        const done = await phaseFinalize(repo, policy, night, { quick: Boolean(opt.quick), push: !opt['no-push'] });
        saveNight(repo, night);
        return out({ done, phase: night.phase, pr: night.pr || null, report: night.reportFile, branchKept: night.branchKept, notes: night.notes.slice(-5) });
      } finally {
        lock.release();
      }
    }

    case 'dry-run':
      return out(await dryRun(repo, opt));

    default:
      throw new Error(`Unknown command ${cmd}`);
  }
}

/**
 * Exercise the whole lifecycle on a throwaway branch: setup, baseline, survey, a probe
 * experiment that must be rejected and reverted, final metrics and the report. Nothing is pushed.
 */
async function dryRun(repo, opt) {
  const { policy: loaded } = loadPolicy(repo);
  const quick = opt.full ? false : true;
  const policy = quick ? { ...loaded, worktree: { ...loaded.worktree, setup: [] } } : loaded;
  const steps = [];
  const lock = acquireLock(repo, 'dry-run');
  let night;
  try {
    night = startNight(repo, policy, { dryRun: true, agent: 'dry-run' });
    steps.push(`worktree ${night.worktree} on ${night.branch}`);
    await phaseSetup(repo, policy, night);
    if (night.phase === 'blocked') throw new Error(night.blockedReason);
    while (!(await phaseBaseline(repo, policy, night, { quick }))) {
      /* bounded by metric timeouts */
    }
    steps.push(`baseline: ${Object.entries(night.baseline.metrics).map(([k, v]) => `${k}=${v.ok ? v.value : 'n/a'}`).join(', ')}`);
    await phaseSurvey(repo, policy, night, { quick });
    steps.push(`survey: ${night.surveyFile}`);
    const probeMetric = policy.metrics.find((m) => m.quick)?.name;
    const c = { id: 'c1', dimension: 'developer_experience', title: 'Dry-run probe experiment', hypothesis: 'An empty commit changes nothing, so verification must reject it.', files: [], metrics: probeMetric ? [probeMetric] : [], impact: 1, confidence: 1, cost: 1, risk: 1, status: 'pending', addedAt: nowIso() };
    c.fingerprint = fingerprint(c);
    c.score = score(policy, c);
    night.candidates.push(c);
    night.phase = 'experiment';
    const locks = await refreshLocks(repo, policy, night, true);
    steps.push(`conflict scan: ${Object.keys(locks.paths).length} locked paths${locks.notes.length ? ` (${locks.notes.join('; ')})` : ''}`);
    beginCandidate(night, c, 'dry-run');
    git(night.worktree, ['commit', '--allow-empty', '-m', 'chore(evolution): dry-run probe', '--no-verify']);
    saveNight(repo, night);
  } finally {
    lock.release();
  }
  const v = await verify(repo, { night: night.night }, 'c1');
  steps.push(`verify: ok=${v.ok}; ${v.failures.join(' ')}`);
  const lock2 = acquireLock(repo, 'dry-run finish');
  try {
    night = loadNight(repo, night.night);
    const c = findCandidate(night, 'c1');
    const before = headSha(night.worktree);
    rejectCandidate(repo, night, c, `Dry run: ${v.failures.join(' ') || 'probe'}`);
    const after = headSha(night.worktree);
    steps.push(`revert: ${before.slice(0, 8)} -> ${after.slice(0, 8)} (start ${c.startSha.slice(0, 8)}) ${after === c.startSha ? 'OK' : 'MISMATCH'}`);
    night.phase = 'finalize';
    const keep = Boolean(opt.keep);
    if (keep) {
      const report = renderReport({ night, policy, finalMetrics: night.baseline.metrics, history: readHistory(repo, { dryRun: true }) });
      writeAtomic(path.join(nightDir(repo, night), 'report.md'), report);
      night.reportFile = toPosix(path.join(nightDir(repo, night), 'report.md'));
    } else {
      await phaseFinalize(repo, policy, night, { quick, push: false });
    }
    saveNight(repo, night);
    steps.push(`report: ${night.reportFile}`);
    steps.push(keep ? `kept worktree ${night.worktree}` : `cleaned up worktree and branch (exists now: ${fs.existsSync(night.worktree)})`);
    const wouldRun = `gh pr create --draft --base ${night.base} --head ${night.branch} --body-file ${night.reportFile}`;
    return { ok: after === findCandidate(night, 'c1').startSha && !v.ok, night: night.night, steps, wouldRun, compute: night.compute.map((x) => `${x.what}: ${x.ms}ms`) };
  } finally {
    lock2.release();
  }
}

function usage() {
  process.stdout.write(`Nightly Evolution engine

  evolve <command> [--repo PATH]

  discover                     Read-only repository profile
  init [--force]               Create .evolution/{policy.yaml,baselines.json,history.jsonl}
  validate                     Check the policy
  tick [--force] [--retry] [--agent NAME] [--no-push] [--budget-minutes N]
                               Advance tonight's run one bounded step; prints the next action
  status                       Current night, candidates, recent nights
  candidate add --dimension D --title T [--hypothesis H] [--files a,b] [--metrics m]
                [--impact --confidence --cost --risk 1-5] [--ui] [--retry-reason R]
  candidate list
  triage done [--none REASON]
  verify <id>                  Checks + metrics vs baseline for the running experiment
  experiment begin|accept|reject <id> [--evidence T] [--reason T] [--tradeoffs T]
  memory add --kind K --title T [--library L --verdict V --reason R --sources a,b]
  memory search <query> [--global] | memory digest
  usage --tokens N [--usd X] [--model M]
  screenshot (--page NAME | --url URL) [--reference FILE] [--candidate ID] [--serve]
  measure [--quick] [--only a,b]
  report [--print] | finish [--no-push]
  dry-run [--full] [--keep]    Whole lifecycle on a throwaway branch; never pushes
`);
}

main().catch((error) => {
  if (error.code === 'LOCKED') {
    out({ action: 'wait', why: error.message });
    process.exitCode = 75;
    return;
  }
  process.stderr.write(`evolve: ${error.message}\n`);
  process.exitCode = 1;
});
