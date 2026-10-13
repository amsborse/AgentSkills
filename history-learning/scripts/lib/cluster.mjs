import path from 'node:path';
import { CATEGORIES, jaccard, tokens } from './signals.mjs';
import { readJson, sha, stateDir, writeJson } from './util.mjs';

const ORDER = Object.keys(CATEGORIES);
const THRESHOLD = 0.5;

/**
 * ShadowClone's evidence bar: an explicit standing rule needs one session; an inferred pattern
 * needs three independent sessions. Confidence grows with independent sessions and projects.
 */
export function confidenceOf(c) {
  const explicit = c.durable > 0 && c.temporary < c.size;
  if (c.sessions >= 5 || (explicit && c.sessions >= 3)) return { level: 'high', basis: explicit ? 'explicit, repeated' : 'inferred, repeated' };
  if (explicit) return { level: c.sessions >= 2 ? 'medium' : 'low', basis: 'explicit' };
  if (c.sessions >= 3) return { level: 'medium', basis: 'inferred' };
  return { level: 'insufficient', basis: 'inferred, fewer than 3 sessions' };
}

/**
 * Greedy near-duplicate clustering per primary category using token Jaccard similarity with an
 * inverted index. Fully deterministic: records are processed in id order.
 */
export function clusterEvidence(records) {
  const templateSessions = new Map();
  for (const r of records) {
    if (r.turnLen < 200) continue;
    if (!templateSessions.has(r.prefix)) templateSessions.set(r.prefix, new Set());
    templateSessions.get(r.prefix).add(r.session);
  }
  const templates = new Set([...templateSessions].filter(([, s]) => s.size >= 5).map(([p]) => p));
  const clusters = [];
  const index = new Map();
  let dropped = 0;
  for (const r of [...records].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (templates.has(r.prefix)) {
      dropped++;
      continue;
    }
    const tok = tokens(r.text);
    if (tok.length < 2) continue;
    const category = ORDER.find((c) => r.categories.includes(c)) || 'general';
    const cand = new Map();
    for (const t of tok) for (const ci of index.get(`${category}|${t}`) || []) cand.set(ci, (cand.get(ci) || 0) + 1);
    let best = -1;
    let bestScore = 0;
    for (const [ci, shared] of cand) {
      if (shared < 2) continue;
      const s = jaccard(tok, clusters[ci].tokens);
      if (s > bestScore) (best = ci), (bestScore = s);
    }
    if (best < 0 || bestScore < THRESHOLD) {
      best = clusters.length;
      clusters.push({ category, tokens: tok, members: [] });
      for (const t of tok) {
        const k = `${category}|${t}`;
        if (!index.has(k)) index.set(k, []);
        index.get(k).push(best);
      }
    }
    clusters[best].members.push(r);
  }
  return {
    templates: templates.size,
    droppedTemplateStatements: dropped,
    clusters: clusters.map((c) => summarize(c)).sort((a, b) => b.score - a.score),
  };
}

function summarize(c) {
  const m = c.members;
  const sessions = new Set(m.map((r) => r.session));
  const projects = [...new Set(m.map((r) => r.project))];
  const agents = [...new Set(m.map((r) => r.agent))];
  const kinds = {};
  for (const r of m) for (const k of r.kinds) kinds[k] = (kinds[k] || 0) + 1;
  const durable = m.filter((r) => r.durable).length;
  const temporary = m.filter((r) => r.temporary).length;
  const ts = m.map((r) => r.ts).filter(Boolean).sort();
  const rep = [...m].sort((a, b) => Number(b.durable) - Number(a.durable) || Number(a.spec) - Number(b.spec) || a.text.length - b.text.length)[0];
  const base = { size: m.length, sessions: sessions.size, durable, temporary };
  const confidence = confidenceOf(base);
  const named = projects.filter((p) => !p.startsWith('('));
  const founder = [...m].sort((a, b) => (a.ts || '').localeCompare(b.ts || '') || a.id.localeCompare(b.id))[0];
  return {
    id: sha(`${c.category}|${founder.id}`, 10),
    category: c.category,
    ...base,
    projects,
    agents,
    scope: named.length === 1 && projects.length === 1 ? `project:${named[0]}` : 'global',
    kinds,
    first: ts[0] || null,
    last: ts[ts.length - 1] || null,
    confidence,
    score: sessions.size * 2 + durable * 3 + (kinds.correction || 0) * 1.5 + (kinds.dissatisfaction || 0) + (kinds.preference || 0) * 0.5 - temporary,
    representative: rep.text,
    members: m.map((r) => r.id),
  };
}

export function saveClusters(result) {
  writeJson(path.join(stateDir(), 'clusters.json'), { generatedAt: new Date().toISOString(), ...result });
}

export const loadClusters = () => readJson(path.join(stateDir(), 'clusters.json'));
