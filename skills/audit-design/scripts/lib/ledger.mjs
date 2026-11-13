// Creative findings ledger: one JSON object per line. Pure helpers, unit-tested.
import os from 'node:os';
import path from 'node:path';

export const KINDS = ['defect', 'failure', 'performance', 'review', 'success', 'browser-test', 'feedback'];
export const OUTCOMES = ['open', 'fixed', 'accepted', 'wontfix'];

export function defaultLedger() {
  return process.env.CREATIVE_LEDGER || path.join(os.homedir(), '.agent-skills', 'creative', 'findings.jsonl');
}

const PERF = new Set(['offscreen-render', 'idle-render', 'long-frames', 'layout-shift']);

// Turn a visual-audit report into ledger entries. Keeps the check, severity and detail; drops
// the URL so remote or private addresses never land in a long-lived file.
export function entriesFromReport(report, { skill, technique = null, outcome = 'open', ts = new Date().toISOString() } = {}) {
  if (!report || !Array.isArray(report.findings)) throw new Error('not a visual-audit report (no findings array)');
  if (!skill) throw new Error('--skill is required so findings can be traced to the skill that produced the UI');
  const c = report.summary?.counts || {};
  const result = report.incomplete ? 'INCOMPLETE' : report.summary?.pass ? 'PASS' : 'FAIL';
  const detail = `${result}: blocker ${c.blocker ?? '?'}, major ${c.major ?? '?'}, minor ${c.minor ?? '?'}, info ${c.info ?? '?'}`;
  const passed = result === 'PASS';
  const out = [{ ts, kind: 'browser-test', skill, technique, check: 'summary', severity: passed ? 'info' : 'major', detail, outcome: passed ? 'accepted' : outcome, source: 'audit' }];
  for (const f of report.findings) {
    if (f.severity === 'info') continue;
    out.push({ ts, kind: PERF.has(f.check) ? 'performance' : 'defect', skill, technique, check: f.check, severity: f.severity, detail: f.detail, views: f.views || [], outcome, source: 'audit' });
  }
  return out;
}

export function manualEntry({ kind, skill, note, technique = null, outcome = 'open', ts = new Date().toISOString() }) {
  if (!KINDS.includes(kind)) throw new Error(`--kind must be one of ${KINDS.join(', ')}`);
  if (!OUTCOMES.includes(outcome)) throw new Error(`--outcome must be one of ${OUTCOMES.join(', ')}`);
  if (!skill || !note) throw new Error('--skill and --note are required');
  return { ts, kind, skill, technique, check: 'note', severity: kind === 'success' ? 'info' : 'minor', detail: note, outcome, source: 'manual' };
}

export function parseLedger(text) {
  const entries = [];
  const errors = [];
  String(text).split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    try { entries.push(JSON.parse(line)); } catch { errors.push(`line ${i + 1}: not JSON`); }
  });
  return { entries, errors };
}

// Repeated patterns are the evidence night-evolve-skills needs: the same check failing for the
// same skill at least `min` times, or a technique that keeps succeeding.
export function patterns(entries, min = 2) {
  const groups = new Map();
  for (const e of entries) {
    if (e.check === 'summary') continue;
    const key = e.kind === 'success' || e.kind === 'feedback' ? `${e.skill}|${e.kind}|${e.detail}` : `${e.skill}|${e.kind}|${e.check}`;
    const g = groups.get(key) || { skill: e.skill, kind: e.kind, check: e.check, count: 0, open: 0, examples: [] };
    g.count++;
    if (e.outcome === 'open') g.open++;
    if (g.examples.length < 3 && !g.examples.includes(e.detail)) g.examples.push(e.detail);
    groups.set(key, g);
  }
  return [...groups.values()].filter((g) => g.count >= min).sort((a, b) => b.count - a.count || b.open - a.open);
}
