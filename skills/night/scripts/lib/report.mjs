// The morning report. Every line comes from .night/ evidence (state, baseline, experiments,
// failures); nothing is estimated. Unknowns are printed as unknown.
import fs from 'node:fs';
import path from 'node:path';
import { readJson, readJsonl, writeAtomic, fmtMs } from '../../../../nightly-evolution/scripts/lib/util.mjs';
import { paths, loadState } from './state.mjs';

const short = (sha) => (sha ? String(sha).slice(0, 8) : 'none');
const checkLine = (c) => `${c.name}: ${c.skipped ? 'skipped' : c.missing_tool ? 'could not run (tool missing)' : c.ok ? 'pass' : `fail (exit ${c.code})`}${c.counts ? ` [${c.counts.passed ?? '?'} passed, ${c.counts.failed ?? '?'} failed${c.counts.skipped ? `, ${c.counts.skipped} skipped` : ''}]` : ''}${c.flaky ? ' (flaky)' : ''}`;
const why = (e) => [...(e.regressions || []), ...(e.notes || [])].slice(0, 3).join('; ') || 'no detail recorded';

export function renderReport(root) {
  const p = paths(root);
  const s = loadState(root);
  if (!s) return '# Night report\n\nNo run has been recorded in this repository yet.\n';
  const exps = readJsonl(p.experiments).filter((e) => e.run_id === s.run_id);
  const fails = readJsonl(p.failures).filter((f) => f.run_id === s.run_id);
  const baseline = readJson(p.baseline, null);
  const kept = exps.filter((e) => e.verdict === 'keep');
  const keptCode = kept.filter((e) => e.commit);
  const keptReports = kept.filter((e) => e.artifact);
  const finished = exps.filter((e) => e.finished);
  const notKept = exps.filter((e) => e.verdict !== 'keep' && !e.finished);
  const blocked = s.tasks.filter((t) => t.status === 'blocked');
  const pending = s.tasks.filter((t) => t.status === 'pending').sort((a, b) => b.priority - a.priority);
  const elapsed = (Date.parse(s.ended_at || new Date().toISOString()) - Date.parse(s.started_at)) || 0;
  const u = s.usage || {};
  const cost = u.cost_known === false ? `unknown (some agents do not report cost; ${u.cost_usd ? `at least $${u.cost_usd}` : 'no reported cost'})` : `$${u.cost_usd ?? 0}`;
  const tokens = (u.input_tokens || 0) + (u.output_tokens || 0);

  const out = [
    `# Night report: ${s.run_id}`, '',
    `**${s.status}** (${s.stop_reason || 'running'}) after ${fmtMs(elapsed)} and ${s.iterations} iteration(s): ${keptCode.length} change(s) kept as commits, ${keptReports.length} report(s), ${notKept.length} attempt(s) not kept, ${blocked.length} task(s) blocked.`,
    '',
    `Mode \`${s.mode}\`${s.objective ? `, objective: ${s.objective}` : ''}. Base ${short(s.base_sha)}${s.base_branch ? ` on ${s.base_branch}` : ''}; run branch \`${s.branch || 'none'}\` at ${short(s.head_sha)}. Usage: ${tokens ? `${tokens} tokens reported` : 'no tokens reported'}, cost ${cost}.`,
    '',
  ];

  out.push('## Kept', '');
  if (!kept.length) out.push('Nothing was kept.', '');
  for (const e of keptCode) out.push(`- ${short(e.commit)} ${e.title} (confidence ${e.confidence}, ${e.agent})`, `  evidence: ${(e.improvements || []).join('; ') || 'checks passed with no regression'}${e.changes?.stat ? `; ${e.changes.stat}` : ''}`);
  for (const e of keptReports) out.push(`- report: ${e.title}: \`${path.relative(root, e.artifact).replace(/\\/g, '/')}\``);
  if (kept.length) out.push('');
  if (finished.length) out.push(`Finished (the agent found nothing left to do): ${[...new Set(finished.map((e) => e.title))].join('; ')}.`, '');

  out.push('## Not kept', '');
  if (!notKept.length) out.push('None.', '');
  for (const e of notKept) out.push(`- ${e.verdict.toUpperCase()}${e.failure ? ` (${e.failure})` : ''} ${e.title}, attempt ${e.attempt}: ${why(e)}${e.patch ? `\n  patch: \`${path.relative(root, e.patch).replace(/\\/g, '/')}\`` : ''}`);
  if (notKept.length) out.push('');

  const decisions = [...blocked.map((t) => `- ${t.title}: ${t.blocked_reason}`), ...(s.warnings || []).filter((w) => /dirty|uncommitted|no evaluation|flaky|tool missing|no agent/i.test(w)).map((w) => `- ${w}`)];
  out.push('## Needs you', '', ...(decisions.length ? decisions : ['Nothing.']), '');

  if (fails.length) {
    const byClass = new Map();
    for (const f of fails) byClass.set(f.class, (byClass.get(f.class) || 0) + 1);
    out.push('## Failures by kind', '', ...[...byClass].map(([k, n]) => `- ${k}: ${n}`), '');
  }

  out.push('## Checks', '');
  if (baseline?.checks?.length) {
    out.push('Baseline:', ...baseline.checks.map((c) => `- ${checkLine(c)}`), '');
    out.push('Run branch head:', ...(s.head_checks || []).map((c) => `- ${checkLine(c)}`), '');
  } else out.push('No baseline was recorded (no evaluation command, or the run stopped before it).', '');

  out.push('## Next', '');
  out.push(...(pending.length ? pending.slice(0, 8).map((t) => `- ${t.title} (priority ${t.priority})`) : ['The queue is empty.']), '');

  out.push('## How to review', '');
  if (s.branch && keptCode.length) {
    out.push(`- \`git log --oneline ${short(s.base_sha)}..${s.branch}\` lists the kept commits; each has Night-Run and Night-Task trailers.`);
    out.push(`- \`git diff ${short(s.base_sha)}...${s.branch}\` shows the whole night. Merge or cherry-pick what you want; nothing was pushed.`);
  } else out.push('- No commits to review.');
  if (s.run_dir) out.push(`- The run worktree is \`${s.run_dir}\`; remove it with \`git worktree remove\` when done.`);
  out.push('- Experiments: `.night/experiments.jsonl`; failures: `.night/failures.jsonl`; logs: `.night/logs/`.', '');

  const unknown = [];
  if (u.cost_known === false) unknown.push('total cost (an agent did not report it)');
  if (!s.head_checks?.length) unknown.push('whether the code works: no check ran');
  if (exps.some((e) => e.verdict === 'inconclusive' && e.failure === 'unverified')) unknown.push('the effect of unverified attempts');
  if (unknown.length) out.push('## Unknown', '', ...unknown.map((x) => `- ${x}`), '');
  return out.join('\n');
}

export function writeReport(root) {
  const p = paths(root);
  const s = loadState(root);
  const text = renderReport(root);
  fs.mkdirSync(p.reports, { recursive: true });
  const file = path.join(p.reports, `${s?.run_id || 'none'}.md`);
  writeAtomic(file, text);
  writeAtomic(path.join(p.reports, 'latest.md'), text);
  return { file, text };
}
