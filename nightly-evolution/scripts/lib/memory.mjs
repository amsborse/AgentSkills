import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { appendJsonl, hash, jaccard, nowIso, readJson, readJsonl, tokenize, toPosix, writeJson } from './util.mjs';

export const KINDS = ['experiment', 'research', 'library', 'decision', 'opportunity', 'benchmark', 'failure', 'run'];

export function homeDir() {
  return process.env.NIGHTLY_EVOLUTION_HOME || path.join(os.homedir(), '.config', 'nightly-evolution');
}

export function registerRepo(repo, name) {
  const file = path.join(homeDir(), 'repos.json');
  const reg = readJson(file, { repos: {} });
  const key = toPosix(repo.main);
  if (reg.repos[key]?.name === name) return false;
  reg.repos[key] = { name, registeredAt: reg.repos[key]?.registeredAt ?? nowIso() };
  writeJson(file, reg);
  return true;
}

export function registeredRepos() {
  return Object.entries(readJson(path.join(homeDir(), 'repos.json'), { repos: {} }).repos).map(([main, v]) => ({ main, ...v }));
}

export function historyPath(repo, { dryRun } = {}) {
  return dryRun ? path.join(repo.stateDir, 'dryrun-history.jsonl') : repo.historyFile;
}

export function fingerprint({ dimension = '', title = '', files = [] }) {
  const words = [...tokenize(title)].sort().join(' ');
  return hash(`${dimension}|${words}|${[...files].map(toPosix).sort().join(',')}`);
}

export function record(repo, entry, opts = {}) {
  if (!KINDS.includes(entry.kind)) throw new Error(`Unknown memory kind ${entry.kind} (${KINDS.join(', ')})`);
  const full = { ts: nowIso(), ...entry };
  appendJsonl(historyPath(repo, opts), full);
  return full;
}

export function readHistory(repo, opts = {}) {
  return readJsonl(historyPath(repo, opts));
}

/**
 * Earlier experiments/research that this idea would repeat: identical fingerprint, or the same
 * dimension with a strongly overlapping title (or library name).
 */
export function findSimilar(history, { dimension, title, files = [], library }) {
  const fp = fingerprint({ dimension, title, files });
  const words = tokenize(title || library || '');
  const out = [];
  for (const h of history) {
    if (!['experiment', 'research', 'library', 'failure'].includes(h.kind)) continue;
    if (h.fingerprint === fp) {
      out.push({ ...h, match: 'fingerprint' });
      continue;
    }
    if (library && h.kind === 'library' && String(h.library || h.title).toLowerCase() === String(library).toLowerCase()) {
      out.push({ ...h, match: 'library' });
      continue;
    }
    const sameDim = !dimension || !h.dimension || h.dimension === dimension;
    const sim = jaccard(words, tokenize(h.title || ''));
    if (sameDim && sim >= 0.6) out.push({ ...h, match: `title ${sim.toFixed(2)}` });
  }
  return out;
}

export function search(repo, query, { global = false, limit = 15 } = {}) {
  const words = tokenize(query);
  const sources = global ? registeredRepos().map((r) => ({ name: r.name, file: path.join(r.main, '.evolution', 'history.jsonl') })) : [{ name: null, file: repo.historyFile }];
  const scored = [];
  for (const s of sources) {
    if (!fs.existsSync(s.file)) continue;
    for (const h of readJsonl(s.file)) {
      const text = [h.title, h.reason, h.summary, h.library, h.dimension, h.kind].filter(Boolean).join(' ');
      const score = jaccard(words, tokenize(text)) + [...words].filter((w) => text.toLowerCase().includes(w)).length * 0.1;
      if (score > 0.1) scored.push({ score: Number(score.toFixed(2)), repo: s.name, ...h });
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** A compact, token-cheap summary of what is already known, for triage. */
export function digest(repo, { maxItems = 12 } = {}) {
  const h = readHistory(repo);
  const pick = (pred) => h.filter(pred).slice(-maxItems);
  const short = (x) => ({ night: x.night, dimension: x.dimension, title: x.title, verdict: x.verdict, reason: x.reason?.slice(0, 160) });
  const attempted = new Set(h.filter((x) => x.kind === 'experiment').map((x) => x.fingerprint));
  return {
    totals: h.reduce((acc, x) => {
      const k = `${x.kind}${x.verdict ? `:${x.verdict}` : ''}`;
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {}),
    accepted: pick((x) => x.kind === 'experiment' && x.verdict === 'accepted').map(short),
    rejected: pick((x) => (x.kind === 'experiment' && x.verdict === 'rejected') || x.kind === 'failure').map(short),
    libraries: pick((x) => x.kind === 'library').map((x) => ({ library: x.library || x.title, verdict: x.verdict, reason: x.reason?.slice(0, 120) })),
    decisions: pick((x) => x.kind === 'decision').map((x) => ({ title: x.title, reason: x.reason?.slice(0, 160) })),
    research: pick((x) => x.kind === 'research').map((x) => ({ title: x.title, summary: x.summary?.slice(0, 160), sources: x.sources?.slice(0, 3) })),
    openOpportunities: pick((x) => x.kind === 'opportunity' && !attempted.has(x.fingerprint)).map((x) => ({ dimension: x.dimension, title: x.title, reason: x.reason?.slice(0, 160) })),
  };
}
