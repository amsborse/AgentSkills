import fs from 'node:fs';
import path from 'node:path';
import { clip, readJson, stateDir, writeJson, writeText } from './util.mjs';

const estTokens = (s) => Math.ceil(s.length / 4);

/**
 * Builds the only material a model ever sees: ranked clusters with a few redacted examples,
 * one file per category, capped by the consented token budget. Clusters already synthesized
 * at the same size are left out so incremental runs only surface what changed.
 */
export function buildDigest({ clusters, evidence, budget, includeKnown = false, minSessions = 2 }) {
  const dir = stateDir();
  const synthesized = readJson(path.join(dir, 'synthesized.json'), {});
  const byId = new Map(evidence.map((r) => [r.id, r]));
  const eligible = clusters.filter((c) => {
    if (c.temporary === c.size) return false;
    if (!includeKnown && synthesized[c.id] && synthesized[c.id].size >= c.size) return false;
    return c.sessions >= minSessions || c.durable > 0;
  });
  const out = path.join(dir, 'digest');
  fs.rmSync(out, { recursive: true, force: true });
  const perCategory = new Map();
  for (const c of eligible) {
    if (!perCategory.has(c.category)) perCategory.set(c.category, []);
    perCategory.get(c.category).push(c);
  }
  let used = 0;
  const files = [];
  const included = [];
  const share = Math.floor(budget / Math.max(perCategory.size, 1));
  for (const [cat, list] of perCategory) {
    const lines = [`# ${cat}`, '', 'Each block is one cluster of near-identical statements you typed, redacted. `prev` is the end of the agent reply you were responding to.', ''];
    let catTokens = estTokens(lines.join('\n'));
    for (const c of list) {
      const ex = c.members
        .map((id) => byId.get(id))
        .filter(Boolean)
        .sort((a, b) => Number(b.durable) - Number(a.durable) || (a.ts < b.ts ? 1 : -1))
        .slice(0, 3);
      const block = [
        `## ${c.id} · ${c.confidence.level} (${c.confidence.basis}) · ${c.sessions} sessions · ${c.size} statements · ${c.scope}`,
        `kinds ${Object.entries(c.kinds).map(([k, v]) => `${k}:${v}`).join(' ')} · durable ${c.durable} · temporary ${c.temporary} · agents ${c.agents.join(', ')} · projects ${c.projects.slice(0, 6).join(', ')} · ${c.first?.slice(0, 10)}..${c.last?.slice(0, 10)}`,
        ...ex.map((r) => `- "${clip(r.text, 300)}"${r.spec ? ' (from a long task spec)' : ''}${r.prev ? `\n  prev: "${clip(r.prev, 200)}"` : ''}`),
        '',
      ].join('\n');
      const t = estTokens(block);
      if (catTokens + t > share || used + t > budget) break;
      lines.push(block);
      catTokens += t;
      used += t;
      included.push(c.id);
    }
    if (lines.length > 4) {
      const file = path.join(out, `${cat}.md`);
      writeText(file, lines.join('\n'));
      files.push({ category: cat, file, tokens: catTokens, clusters: lines.length - 4 });
    }
  }
  const index = { generatedAt: new Date().toISOString(), budget, used, eligible: eligible.length, included: included.length, files };
  writeJson(path.join(out, 'index.json'), index);
  writeJson(path.join(out, 'included.json'), included);
  return { ...index, includedIds: included };
}

/** Records that clusters were reviewed by a synthesis pass, so the next digest skips them. */
export function markSynthesized(ids, clusters) {
  const file = path.join(stateDir(), 'synthesized.json');
  const s = readJson(file, {});
  const byId = new Map(clusters.map((c) => [c.id, c]));
  for (const id of ids) if (byId.has(id)) s[id] = { size: byId.get(id).size, at: new Date().toISOString() };
  writeJson(file, s);
}
