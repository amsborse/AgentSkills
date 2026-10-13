import fs from 'node:fs';
import path from 'node:path';
import { adapterFor } from './adapters/index.mjs';
import { enabledSources, loadConsent } from './consent.mjs';
import { makeRedactor } from './redact.mjs';
import { analyzeTurn } from './signals.mjs';
import { clip, readJson, sha, stateDir, writeJson } from './util.mjs';

const normalize = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

function loadEvidence(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

/**
 * Reads user turns from consented, human-driven sessions that changed since the last run,
 * keeps only signal-bearing statements, redacts them, and stores them privately per source.
 * Raw transcripts are never copied; each record holds one redacted statement and a pointer.
 */
export async function extract({ full = false, limit = Infinity, log = () => {} } = {}) {
  const dir = stateDir();
  const consent = loadConsent();
  const allowed = new Set(enabledSources(consent));
  if (!allowed.size) throw new Error('no sources are enabled; run `hl consent --enable <source,...>` first');
  const inv = readJson(path.join(dir, 'inventory.json'));
  if (!inv) throw new Error('no inventory; run `hl inventory` first');
  const processedFile = path.join(dir, 'processed.json');
  const processed = full ? {} : readJson(processedFile, {});
  const seenFile = path.join(dir, 'turn-keys.json');
  const owner = new Map(Object.entries(full ? {} : readJson(seenFile, {})));
  const redact = makeRedactor({ extraTerms: consent.redactTerms });
  const bySource = new Map();
  const stats = { sessions: 0, skippedUnchanged: 0, turns: 0, duplicateTurns: 0, statements: 0, redactions: {} };

  const primaryEnabled = new Map(inv.sessions.map((s) => [`${s.source}:${s.id}`, allowed.has(s.sourceId)]));
  const todo = inv.sessions.filter((s) => {
    if (!allowed.has(s.sourceId) || s.status !== 'ok' || s.origin !== 'interactive' || !s.userTurns) return false;
    return !s.duplicateOf || !primaryEnabled.get(s.duplicateOf);
  });
  let n = 0;
  for (const s of todo) {
    const key = `${s.source}|${s.id}`;
    if (!full && processed[key]?.mtimeMs === s.mtimeMs) {
      stats.skippedUnchanged++;
      continue;
    }
    if (n++ >= limit) break;
    const adapter = adapterFor(s.source);
    const records = [];
    try {
      for await (const t of adapter.turns(s)) {
        const turnKey = t.key || sha(t.ts ? `${t.ts}|${t.text}` : `${s.dupKey}|${t.text}`);
        stats.turns++;
        if (owner.has(turnKey) && owner.get(turnKey) !== key) {
          stats.duplicateTurns++;
          continue;
        }
        owner.set(turnKey, key);
        const { spec, statements } = analyzeTurn(t.text);
        const prefix = sha(normalize(t.text).slice(0, 120), 12);
        statements.forEach((st, i) => {
          const r = redact(st.text);
          for (const [k, v] of Object.entries(r.hits)) stats.redactions[k] = (stats.redactions[k] || 0) + v;
          const needsContext = st.kinds.some((k) => k !== 'preference');
          const prev = needsContext && t.prev ? redact(clip(t.prev.replace(/\s+/g, ' ').trim().slice(-600), 300)).text : null;
          records.push({ id: sha(`${turnKey}|${i}`, 12), session: key, source: s.sourceId, agent: s.agent, project: s.project, ts: t.ts || s.started, kinds: st.kinds, categories: st.categories, durable: st.durable, temporary: st.temporary, spec, text: clip(r.text, 400), prev, prefix, turnLen: t.text.length });
        });
      }
    } catch (e) {
      log(`  ! ${key}: ${e.message}`);
      continue;
    }
    stats.sessions++;
    stats.statements += records.length;
    processed[key] = { mtimeMs: s.mtimeMs, at: new Date().toISOString(), statements: records.length };
    if (!bySource.has(s.sourceId)) bySource.set(s.sourceId, new Map());
    bySource.get(s.sourceId).set(key, records);
    if (stats.sessions % 50 === 0) log(`  ${stats.sessions} sessions, ${stats.statements} statements`);
  }

  for (const [sourceId, sessions] of bySource) {
    const file = path.join(dir, 'evidence', `${sourceId}.jsonl`);
    const kept = loadEvidence(file).filter((r) => !sessions.has(r.session));
    const all = [...kept, ...[...sessions.values()].flat()];
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, all.map((r) => JSON.stringify(r)).join('\n') + (all.length ? '\n' : ''));
  }
  writeJson(processedFile, processed);
  writeJson(seenFile, Object.fromEntries(owner));
  return stats;
}

export function allEvidence(sources) {
  const dir = path.join(stateDir(), 'evidence');
  return sources.flatMap((s) => loadEvidence(path.join(dir, `${s}.jsonl`)));
}
