import path from 'node:path';
import { readJson, stateDir } from './util.mjs';
import { loadClusters } from './cluster.mjs';
import { enabledSources, loadConsent } from './consent.mjs';

const row = (cells) => `| ${cells.map((c) => String(c).replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`;
const table = (head, rows) => [row(head), row(head.map(() => '---')), ...rows.map(row)].join('\n');

/**
 * The private historical learning report: what was read, what was found, and what was
 * proposed. Proposals come from `proposals.json`, written by the reviewing agent.
 */
export function learningReport() {
  const dir = stateDir();
  const consent = loadConsent();
  const inv = readJson(path.join(dir, 'inventory.json'), { sessions: [] });
  const processed = readJson(path.join(dir, 'processed.json'), {});
  const cl = loadClusters() || { clusters: [] };
  const proposals = readJson(path.join(dir, 'proposals.json'), null);
  const out = ['# Historical learning report', '', `Generated ${new Date().toISOString()}. Private: keep this file out of public repositories.`, ''];

  out.push('## Consent', '', `- Sources enabled: ${enabledSources(consent).join(', ') || 'none'}`, `- Model review: ${consent.model.allowed ? `allowed, digest budget ${consent.model.maxDigestTokens} tokens` : 'not allowed'}`, '');

  out.push('## Coverage', '');
  const bySource = new Map();
  for (const s of inv.sessions) {
    const v = bySource.get(s.sourceId) || { discovered: 0, eligible: 0, processed: 0 };
    v.discovered++;
    if (s.status === 'ok' && s.origin === 'interactive' && !s.duplicateOf && s.userTurns) v.eligible++;
    if (processed[`${s.source}|${s.id}`]) v.processed++;
    bySource.set(s.sourceId, v);
  }
  out.push(table(['Source', 'Discovered', 'Eligible (human, unique, non-empty)', 'Processed', 'Enabled'], [...bySource].map(([k, v]) => [k, v.discovered, v.eligible, v.processed, enabledSources(consent).includes(k) ? 'yes' : 'no'])), '');
  out.push('Full per-agent, per-project and per-month coverage: `reports/coverage.md`.', '');

  out.push('## Extracted knowledge', '');
  const cats = new Map();
  for (const c of cl.clusters) {
    const v = cats.get(c.category) || { clusters: 0, high: 0, medium: 0, low: 0, insufficient: 0, corrections: 0 };
    v.clusters++;
    v[c.confidence.level]++;
    v.corrections += c.kinds.correction || 0;
    cats.set(c.category, v);
  }
  out.push(table(['Category', 'Clusters', 'High', 'Medium', 'Low', 'Insufficient', 'Correction statements'], [...cats].sort((a, b) => b[1].clusters - a[1].clusters).map(([k, v]) => [k, v.clusters, v.high, v.medium, v.low, v.insufficient, v.corrections])), '');
  const top = cl.clusters.filter((c) => ['high', 'medium'].includes(c.confidence.level)).slice(0, 40);
  if (top.length) out.push('### Strongest signals', '', table(['Cluster', 'Category', 'Confidence', 'Sessions', 'Scope', 'Representative (redacted)'], top.map((c) => [c.id, c.category, `${c.confidence.level} (${c.confidence.basis})`, c.sessions, c.scope, c.representative.slice(0, 180)])), '');
  const repeated = cl.clusters.filter((c) => (c.kinds.correction || 0) + (c.kinds.dissatisfaction || 0) >= 3 && c.sessions >= 3).slice(0, 20);
  if (repeated.length) out.push('### Recurring corrections and dissatisfaction', '', table(['Cluster', 'Category', 'Sessions', 'Representative (redacted)'], repeated.map((c) => [c.id, c.category, c.sessions, c.representative.slice(0, 180)])), '');

  out.push('## Proposals', '');
  if (!proposals) out.push('None yet. A reviewing agent writes `proposals.json` after reading the digest.', '');
  else {
    for (const p of proposals.skills || []) {
      out.push(`### ${p.action} \`${p.skill}\` (${p.scope})`, '', p.summary || '', '', table(['Rule', 'Kind', 'Confidence', 'Evidence clusters'], (p.rules || []).map((r) => [r.text, r.kind, r.confidence, (r.clusters || []).join(', ')])), '');
    }
    if (proposals.rejected?.length) out.push('### Considered and not proposed', '', table(['Cluster(s)', 'Reason'], proposals.rejected.map((r) => [(r.clusters || []).join(', '), r.reason])), '');
    if (proposals.conflicts?.length) out.push('### Conflicts', '', proposals.conflicts.map((c) => `- ${c}`).join('\n'), '');
  }
  return out.join('\n');
}
