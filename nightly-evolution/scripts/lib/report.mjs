import { compare } from './measure.mjs';
import { fmtMs } from './util.mjs';

const fmt = (v, unit) => (v == null ? 'n/a' : `${Number.isInteger(v) ? v : Number(v).toFixed(2)}${unit ? ` ${unit}` : ''}`);

export function metricTable(policy, before = {}, after = {}) {
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  if (!names.length) return '_No metrics recorded._\n';
  const defs = Object.fromEntries((policy.metrics || []).map((m) => [m.name, m]));
  const rows = ['| Metric | Before | After | Change | Verdict |', '| --- | --- | --- | --- | --- |'];
  for (const n of names) {
    const def = defs[n] || defs[n.replace(/\.p\d+$/, '')] || {};
    const b = before[n];
    const a = after[n];
    const c = compare(def, b, a);
    const unit = (b || a)?.unit;
    rows.push(`| ${n} | ${b?.ok ? fmt(b.value, unit) : `n/a${b?.error ? ` (${b.error.slice(0, 60).replace(/\|/g, '/')})` : ''}`} | ${a?.ok ? fmt(a.value, unit) : 'n/a'} | ${c.pct == null ? '' : `${c.pct > 0 ? '+' : ''}${c.pct}%`} | ${c.verdict} |`);
  }
  return `${rows.join('\n')}\n`;
}

/** The morning PR body: everything a reviewer needs, nothing claimed without recorded evidence. */
export function renderReport({ night, policy, finalMetrics, history = [] }) {
  const cands = night.candidates || [];
  const accepted = cands.filter((c) => c.status === 'accepted');
  const rejected = cands.filter((c) => c.status === 'rejected');
  const blocked = cands.filter((c) => c.status === 'blocked');
  const pending = cands.filter((c) => c.status === 'pending');
  const usage = night.usage || [];
  const tokens = usage.reduce((a, u) => a + (u.tokens || 0), 0);
  const usd = usage.reduce((a, u) => a + (u.usd || 0), 0);
  const computeMs = (night.compute || []).reduce((a, c) => a + (c.ms || 0), 0);
  const capability = (c) => ['creative', 'product_intelligence'].includes(c.dimension);
  const out = [];

  out.push(`## Nightly Evolution: ${policy.repo.name} (${night.night})`, '');
  out.push(`Branch \`${night.branch}\` from \`${night.baseSha?.slice(0, 10)}\` (${policy.repo.default_branch}). Draft for human review; **never auto-merged**.`, '');
  out.push(`**Summary:** ${accepted.length} accepted, ${rejected.length} rejected and reverted, ${blocked.length} blocked by conflicts or guards, ${pending.length} not attempted.`, '');

  out.push('### Improvements', '');
  if (!accepted.length) out.push('_None accepted tonight._', '');
  for (const c of accepted) {
    out.push(`- **[${c.dimension}] ${c.title}**: ${c.hypothesis || ''}`);
    out.push(`  - Commits: ${(c.commits || []).map((x) => `\`${x.sha.slice(0, 8)}\` ${x.subject}`).join('; ') || 'n/a'}`);
    const ev = c.verification?.comparisons || {};
    const moved = Object.entries(ev).filter(([, v]) => v.verdict !== 'unknown');
    if (moved.length) out.push(`  - Evidence: ${moved.map(([k, v]) => `${k} ${v.before} -> ${v.after} (${v.pct > 0 ? '+' : ''}${v.pct}%, ${v.verdict})`).join('; ')}`);
    if (c.verification?.checks?.length) out.push(`  - Checks: ${c.verification.checks.map((k) => `${k.name} ${k.ok ? 'passed' : k.skipped ? 'skipped' : 'FAILED'}`).join(', ')}`);
    if (c.evidence) out.push(`  - Notes: ${c.evidence}`);
    for (const s of c.screenshots || []) out.push(`  - Screenshot ${s.name}: diff ${s.diffRatio == null ? 'n/a' : `${(s.diffRatio * 100).toFixed(2)}%`} vs reference (${s.file})`);
  }
  out.push('');

  out.push('### Before / after evidence', '', metricTable(policy, night.baseline?.metrics, finalMetrics));

  out.push('### New capabilities', '');
  const caps = accepted.filter(capability);
  out.push(...(caps.length ? caps.map((c) => `- ${c.title}: ${c.hypothesis || ''}`) : ['_None._']), '');

  out.push('### Failed experiments', '');
  out.push(...(rejected.length ? rejected.map((c) => `- [${c.dimension}] ${c.title}: ${c.reason || 'no reason recorded'} (reverted to \`${c.startSha?.slice(0, 8)}\`)`) : ['_None._']), '');
  if (blocked.length) out.push('Blocked (not attempted):', ...blocked.map((c) => `- ${c.title}: ${c.reason}`), '');

  out.push('### Risks and tradeoffs', '');
  const risks = accepted.filter((c) => c.risk >= 3 || c.tradeoffs).map((c) => `- ${c.title}: risk ${c.risk}/5${c.tradeoffs ? `; ${c.tradeoffs}` : ''}`);
  const regressions = Object.entries(accepted.reduce((acc, c) => ({ ...acc, ...(c.verification?.comparisons || {}) }), {})).filter(([, v]) => v.verdict === 'regressed' && !v.gate);
  out.push(...risks, ...regressions.map(([k, v]) => `- Non-gating metric ${k} moved ${v.pct}% the wrong way.`));
  if (!risks.length && !regressions.length) out.push('_No accepted change carries a recorded risk above 2/5._');
  out.push('');

  out.push('### Remaining opportunities', '');
  const opps = [...pending.map((c) => `- [${c.dimension}] ${c.title} (score ${c.score})`), ...history.filter((h) => h.kind === 'opportunity' && h.night === night.night).map((h) => `- [${h.dimension}] ${h.title}`)];
  out.push(...(opps.length ? opps : ['_None recorded._']), '');

  out.push('### Token and compute consumption', '');
  out.push(`- Engine compute (deterministic commands): ${fmtMs(computeMs)} across ${(night.compute || []).length} runs`);
  out.push(`- Agent-reported model usage: ${tokens.toLocaleString('en-US')} tokens, $${usd.toFixed(2)} paid${usage.length ? '' : ' (no usage reported)'}`);
  for (const [model, t] of Object.entries(usage.reduce((acc, u) => ({ ...acc, [u.model || 'unknown']: (acc[u.model || 'unknown'] || 0) + (u.tokens || 0) }), {}))) out.push(`  - ${model}: ${t.toLocaleString('en-US')} tokens`);
  out.push('');
  out.push('<sub>Generated by the shared `nightly-evolution` skill. Evidence is recorded in `.evolution/` and `.git/evolution/` on the host machine.</sub>');
  return `${out.join('\n')}\n`;
}
