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
  const blockOf = (c) => {
    const ex = c.members
      .map((id) => byId.get(id))
      .filter(Boolean)
      .sort((a, b) => Number(b.durable) - Number(a.durable) || (a.ts < b.ts ? 1 : -1))
      .slice(0, 3);
    return [
      `## ${c.id} · ${c.confidence.level} (${c.confidence.basis}) · ${c.sessions} sessions · ${c.size} statements · ${c.scope}`,
      `kinds ${Object.entries(c.kinds).map(([k, v]) => `${k}:${v}`).join(' ')} · durable ${c.durable} · temporary ${c.temporary} · agents ${c.agents.join(', ')} · projects ${c.projects.slice(0, 6).join(', ')} · ${c.first?.slice(0, 10)}..${c.last?.slice(0, 10)}`,
      ...ex.map((r) => `- "${clip(r.text, 300)}"${r.spec ? ' (from a long task spec)' : ''}${r.prev ? `\n  prev: "${clip(r.prev, 200)}"` : ''}`),
      '',
    ].join('\n');
  };
  const header = (cat) => [`# ${cat}`, '', 'Each block is one cluster of near-identical statements you typed, redacted. `prev` is the end of the agent reply you were responding to.', ''];
  const chosen = new Map([...perCategory.keys()].map((k) => [k, header(k)]));
  let used = [...chosen.values()].reduce((n, l) => n + estTokens(l.join('\n')), 0);
  const included = [];
  // Round-robin by rank so every category gets its strongest clusters before any gets its weakest.
  const cursors = new Map([...perCategory.keys()].map((k) => [k, 0]));
  for (let progress = true; progress; ) {
    progress = false;
    for (const [cat, list] of perCategory) {
      const i = cursors.get(cat);
      if (i >= list.length) continue;
      const block = blockOf(list[i]);
      const t = estTokens(block);
      if (used + t > budget) {
        cursors.set(cat, list.length);
        continue;
      }
      chosen.get(cat).push(block);
      used += t;
      included.push(list[i].id);
      cursors.set(cat, i + 1);
      progress = true;
    }
  }
  const files = [];
  for (const [cat, lines] of chosen) {
    if (lines.length <= 4) continue;
    const file = path.join(out, `${cat}.md`);
    writeText(file, lines.join('\n'));
    files.push({ category: cat, file, tokens: estTokens(lines.join('\n')), clusters: lines.length - 4 });
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
