// Planning: turn a mode or an objective into scored tasks.
// Priority = (Impact x Confidence x RiskReduction) / (Effort x ExecutionCost), each 1-5 with a basis.
import { hash, nowIso, tokenize, jaccard } from '../../../../nightly-evolution/scripts/lib/util.mjs';

export const CONTROL_WORDS = ['status', 'resume', 'stop', 'report'];
export const BUILD_WORDS = ['build'];
// Modes the mission names that map onto more than one loop or onto a day skill.
const MODE_ALIASES = { bugs: ['bugs'], security: ['security'], tests: ['tests'] };

const clamp = (n) => Math.max(1, Math.min(5, Math.round(n)));
export const effortFromMinutes = (m) => (m <= 15 ? 1 : m <= 25 ? 2 : m <= 35 ? 3 : 4);

export function priority(s) {
  return Number(((s.impact * s.confidence * s.risk_reduction) / (s.effort * s.execution_cost)).toFixed(2));
}

const RISK_REDUCING = { tests: 4, bugs: 5, redteam: 4, security: 4, dependencies: 3, qa: 4, accessibility: 3 };

export function scoreLoop(loop, { signals = [], evaluation = [], red = false } = {}) {
  const matched = loop.signals.filter((s) => signals.includes(s) || (s === 'failing-tests' && red));
  const isBug = loop.modes.includes('bugs');
  const report = loop.writes === 'report';
  const impact = isBug && red ? 5 : report ? 2 : clamp(2 + Math.min(3, matched.length));
  const verifiable = evaluation.length > 0;
  const confidence = report ? 3 : verifiable ? 4 : 2;
  const rr = isBug && red ? 5 : Math.max(...loop.modes.map((m) => RISK_REDUCING[m] || 2));
  const effort = effortFromMinutes(loop.minutes);
  const cost = report ? 1 : 2;
  const scores = { impact, confidence, risk_reduction: clamp(rr), effort, execution_cost: cost };
  const basis = {
    impact: isBug && red ? 'baseline is red: fixing failures comes first'
      : report ? 'report loop: informs decisions, changes no code'
        : matched.length ? `repo signals match: ${matched.join(', ')}` : 'no repo signal matches this loop',
    confidence: report ? 'report quality is reviewed by a human, not measured'
      : verifiable ? `${evaluation.length} evaluation command(s) can verify each change` : 'no evaluation commands: changes cannot be verified',
    risk_reduction: isBug && red ? 'restores a passing baseline' : `loop kind ${loop.modes.join('/')}`,
    effort: `about ${loop.minutes} minutes per iteration (night-minutes)`,
    execution_cost: report ? 'one read-only agent run' : 'one agent run plus a full evaluation',
  };
  return { scores, basis, priority: priority(scores) };
}

function newTask(fields) {
  const t = {
    id: `t-${hash(`${fields.loop || fields.skill || 'build'}:${fields.objective || ''}:${fields.iteration || 0}:${Math.random()}`, 8)}`,
    title: fields.title,
    loop: fields.loop || null,
    skill_path: fields.skill_path || null,
    mode: fields.mode,
    writes: fields.writes || 'code',
    keep_rule: fields.keep_rule || 'no-regression',
    objective: fields.objective || '',
    scope: fields.scope?.length ? fields.scope : ['**'],
    acceptance: fields.acceptance || [],
    scores: fields.scores,
    basis: fields.basis,
    priority: fields.priority,
    status: 'pending',
    attempts: 0,
    iteration: fields.iteration || 1,
    estimate_minutes: fields.estimate_minutes,
    not_before: null,
    history: [],
    created_by: fields.created_by || 'plan',
    created_at: nowIso(),
  };
  return t;
}

export function loopTask(loop, ctx, extra = {}) {
  const { scores, basis, priority: p } = scoreLoop(loop, ctx);
  return newTask({
    title: extra.title || `${loop.name}: ${extra.objective || loop.description.split('. ')[0]}`,
    loop: loop.name,
    skill_path: loop.path,
    mode: extra.mode || loop.modes[0],
    writes: loop.writes,
    keep_rule: loop.keep_rule,
    objective: extra.objective || '',
    scope: extra.scope,
    scores: extra.scores || scores,
    basis: extra.basis || basis,
    priority: extra.priority ?? p,
    iteration: extra.iteration,
    estimate_minutes: loop.minutes,
    created_by: extra.created_by,
  });
}

export function buildTask(objective, ctx, buildSkill) {
  const verifiable = (ctx.evaluation || []).length > 0;
  const scores = { impact: 4, confidence: verifiable ? 3 : 2, risk_reduction: 2, effort: 3, execution_cost: 2 };
  return newTask({
    title: `build: ${objective}`,
    skill_path: buildSkill?.path || null,
    mode: 'build',
    objective,
    acceptance: [`The objective is met: ${objective}`, 'Every evaluation command passes', 'New behavior has a test'],
    keep_rule: 'no-regression',
    scores,
    basis: {
      impact: 'the owner asked for this objective',
      confidence: verifiable ? 'evaluation commands exist, but acceptance needs judgement' : 'no evaluation commands to verify the build',
      risk_reduction: 'new behavior, not a fix',
      effort: 'feature work, about 30-45 minutes per slice',
      execution_cost: 'one agent run plus a full evaluation',
    },
    priority: priority(scores),
    estimate_minutes: 40,
  });
}

/**
 * Plan tasks. `mode` is a /night word or null; `objective` is free text.
 * Natural language without a mode becomes a build task unless it clearly names a loop.
 */
export function plan({ mode, objective = '', loops, skills = [], env, red = false, limit = 8 }) {
  const ctx = { signals: env?.signals || [], evaluation: env?.evaluation || [], red };
  const byMode = (m) => loops.filter((l) => l.modes.includes(m));
  const buildSkill = skills.find((s) => s.name === 'build-feature');
  const warnings = [];
  let tasks = [];

  if (!mode || mode === 'auto') {
    if (objective && !mode) {
      const words = new Set(tokenize(objective));
      const named = loops.find((l) => l.modes.some((m) => words.has(m)) || words.has(l.name));
      tasks = named ? [loopTask(named, ctx, { objective })] : [buildTask(objective, ctx, buildSkill)];
    } else {
      // auto: every loop whose signals match, plus the red-baseline rule; evolve-skills only on request.
      const candidates = loops.filter((l) => !l.modes.includes('evolve-skills'));
      tasks = candidates
        .map((l) => loopTask(l, ctx, { objective }))
        .filter((t) => t.basis.impact !== 'no repo signal matches this loop' || t.loop === 'night-improve');
      if (red) {
        const bug = byMode('bugs')[0];
        if (bug && !tasks.some((t) => t.loop === bug.name)) tasks.push(loopTask(bug, ctx, { objective }));
      }
    }
  } else if (BUILD_WORDS.includes(mode)) {
    if (!objective) warnings.push('build needs an objective, e.g. /night build add CSV export to the reports page');
    else tasks = [buildTask(objective, ctx, buildSkill)];
  } else {
    const matches = byMode(mode);
    if (!matches.length) warnings.push(`no loop serves mode "${mode}" (night loops lists the modes)`);
    tasks = matches.map((l) => loopTask(l, ctx, { objective, mode }));
  }
  if (red && !tasks.some((t) => t.mode === 'bugs' || t.loop === byMode('bugs')[0]?.name)) {
    warnings.push('the baseline is red: kept changes must not add failures, but existing failures stay until a bugs task fixes them');
  }
  tasks.sort((a, b) => b.priority - a.priority);
  return { tasks: tasks.slice(0, limit), warnings };
}

/** A kept loop task comes back for its next iteration at a lower priority unless the loop said it is done. */
export function requeue(task, loopsByName, ctx, result) {
  if (!task.loop || result?.done) return null;
  const loop = loopsByName.get(task.loop);
  if (!loop) return null;
  const next = loopTask(loop, ctx, {
    objective: task.objective,
    mode: task.mode,
    scope: task.scope,
    iteration: task.iteration + 1,
    title: task.title,
    scores: task.scores,
    basis: { ...task.basis, requeue: `iteration ${task.iteration + 1}: priority x0.8 after a kept change` },
    priority: Number((task.priority * 0.8).toFixed(2)),
    created_by: `requeue:${task.id}`,
  });
  if (result?.next_hypothesis) next.objective = [task.objective, `Next hypothesis from the last iteration: ${result.next_hypothesis}`].filter(Boolean).join('\n');
  return next;
}

/** Agent-proposed follow-ups become tasks only for known loops, at most 3, and not near-duplicates. */
export function followUpTasks(followUps, tasks, loopsByName, ctx, parentId) {
  const out = [];
  for (const f of (Array.isArray(followUps) ? followUps : []).slice(0, 3)) {
    const loop = f && loopsByName.get(String(f.loop || ''));
    if (!loop || !f.title) continue;
    // Skill evolution runs only when the owner asks for it, never on an agent's suggestion.
    if (loop.modes.includes('evolve-skills')) continue;
    const words = tokenize(String(f.title));
    if ([...tasks, ...out].some((t) => t.status !== 'skipped' && jaccard(tokenize(t.title), words) >= 0.6)) continue;
    const t = loopTask(loop, ctx, { objective: `${f.title}${f.why ? ` (why: ${f.why})` : ''}`, title: `${loop.name}: ${f.title}`, created_by: `follow-up:${parentId}` });
    t.priority = Number((t.priority * 0.9).toFixed(2));
    t.basis.follow_up = 'proposed by an agent; priority x0.9 because the claim is unverified';
    out.push(t);
  }
  return out;
}
