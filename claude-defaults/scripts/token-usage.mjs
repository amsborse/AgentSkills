#!/usr/bin/env node
// Claude Code token usage: daily, weekly and monthly totals from local transcripts,
// plus a change log so each instruction change can be compared with the usage around it.
//
//   node token-usage.mjs report [daily|weekly|monthly]   totals per period (default: weekly)
//   node token-usage.mjs mark "<what changed>"           record a change marker now
//   node token-usage.mjs compare                         usage 7 days before vs after each marker
//   node token-usage.mjs snapshot                        append today's totals to the metrics log
//
// Reads ~/.claude/projects/**/*.jsonl (override with CLAUDE_HOME). Writes only to
// ~/.claude/logs/. Counts tokens, not money: prices change, so none are hard-coded.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const claudeHome = () => process.env.CLAUDE_HOME || path.join(os.homedir(), '.claude');
const logsDir = () => path.join(claudeHome(), 'logs');
const FIELDS = ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'];

// Period key: day as YYYY-MM-DD, month as YYYY-MM, week as "week of <Monday>".
export function periodKey(iso, kind) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.toISOString().slice(0, 10);
  if (kind === 'daily') return day;
  if (kind === 'monthly') return day.slice(0, 7);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow));
  return 'week of ' + monday.toISOString().slice(0, 10);
}

// One assistant message carries one usage block. Repeated lines for the same request count once.
export function parseLine(line, seen) {
  let j;
  try { j = JSON.parse(line); } catch { return null; }
  const usage = j?.message?.usage;
  if (!usage || j.type !== 'assistant' || !j.timestamp) return null;
  const id = j.requestId || j.message?.id || j.uuid;
  if (id) { if (seen.has(id)) return null; seen.add(id); }
  const rec = { ts: j.timestamp, model: j.message?.model || 'unknown', session: j.sessionId || j.session_id || 'unknown' };
  for (const f of FIELDS) rec[f] = Number(usage[f]) || 0;
  return rec;
}

export function* transcriptRecords(root = path.join(claudeHome(), 'projects')) {
  const stack = [root];
  const seen = new Set();
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.name.endsWith('.jsonl')) {
        for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
          if (!line) continue;
          const rec = parseLine(line, seen);
          if (rec) yield rec;
        }
      }
    }
  }
}

const totalOf = (r) => r.input_tokens + r.output_tokens + r.cache_read_input_tokens + r.cache_creation_input_tokens;

export function aggregate(records, kind) {
  const out = new Map();
  for (const r of records) {
    const key = periodKey(r.ts, kind);
    if (!key) continue;
    if (!out.has(key)) out.set(key, { period: key, turns: 0, sessions: new Set(), total: 0, ...Object.fromEntries(FIELDS.map((f) => [f, 0])) });
    const row = out.get(key);
    row.turns += 1;
    row.sessions.add(r.session);
    for (const f of FIELDS) row[f] += r[f];
    row.total += totalOf(r);
  }
  return [...out.values()]
    .map(({ sessions, ...row }) => ({ ...row, sessions: sessions.size }))
    .sort((a, b) => (a.period < b.period ? -1 : 1));
}

function sumBetween(records, fromMs, toMs) {
  let total = 0, turns = 0;
  for (const r of records) {
    const t = Date.parse(r.ts);
    if (t < fromMs || t >= toMs) continue;
    turns += 1;
    total += totalOf(r);
  }
  return { total, turns };
}

export function compareMarkers(records, markers, days = 7) {
  const span = days * 86400000;
  return markers.map((m) => {
    const t = Date.parse(m.ts);
    const before = sumBetween(records, t - span, t);
    const after = sumBetween(records, t, t + span);
    const pct = before.total ? Math.round(((after.total - before.total) / before.total) * 100) : null;
    return { ...m, before, after, changePct: pct };
  });
}

function readMarkers() {
  const file = path.join(logsDir(), 'token-changes.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : String(n ?? ''));

function table(rows, cols) {
  const cells = rows.map((r) => cols.map((c) => fmt(r[c.key])));
  const widths = cols.map((c, i) => Math.max(c.label.length, ...cells.map((row) => row[i].length)));
  const line = (vals) => vals.map((v, i) => String(v).padEnd(widths[i])).join('  ');
  return [line(cols.map((c) => c.label)), line(widths.map((w) => '-'.repeat(w))), ...cells.map(line)].join('\n');
}

const COLS = [
  { key: 'period', label: 'period' }, { key: 'turns', label: 'turns' }, { key: 'sessions', label: 'sessions' },
  { key: 'input_tokens', label: 'input' }, { key: 'cache_read_input_tokens', label: 'cache read' },
  { key: 'cache_creation_input_tokens', label: 'cache write' }, { key: 'output_tokens', label: 'output' }, { key: 'total', label: 'total' },
];

export function main(argv, now = new Date(), records = () => transcriptRecords()) {
  const [cmd = 'report', arg] = argv;
  if (cmd === 'report') {
    const kind = ['daily', 'weekly', 'monthly'].includes(arg) ? arg : 'weekly';
    const rows = aggregate(records(), kind);
    return rows.length ? table(rows, COLS) : 'No Claude Code usage found.';
  }
  if (cmd === 'mark') {
    const what = argv.slice(1).join(' ').trim();
    if (!what) throw new Error('usage: token-usage.mjs mark "<what changed>"');
    fs.mkdirSync(logsDir(), { recursive: true });
    const entry = { ts: now.toISOString(), what };
    fs.appendFileSync(path.join(logsDir(), 'token-changes.jsonl'), JSON.stringify(entry) + '\n');
    return `Marked: ${entry.ts} ${what}`;
  }
  if (cmd === 'compare') {
    const markers = readMarkers();
    if (!markers.length) return 'No change markers yet. Run: token-usage.mjs mark "<change>"';
    const rows = compareMarkers([...records()], markers).map((r) => ({
      date: r.ts.slice(0, 10), change: r.what, before: r.before.total, after: r.after.total,
      pct: r.changePct === null ? 'n/a' : `${r.changePct > 0 ? '+' : ''}${r.changePct}%`,
    }));
    return table(rows, [{ key: 'date', label: 'date' }, { key: 'change', label: 'change' }, { key: 'before', label: '7d before' }, { key: 'after', label: '7d after' }, { key: 'pct', label: 'change' }]);
  }
  if (cmd === 'snapshot') {
    const today = now.toISOString().slice(0, 10);
    const row = aggregate(records(), 'daily').find((r) => r.period === today) || { period: today, turns: 0, sessions: 0, total: 0 };
    fs.mkdirSync(logsDir(), { recursive: true });
    fs.appendFileSync(path.join(logsDir(), 'token-usage-daily.jsonl'), JSON.stringify({ ts: now.toISOString(), ...row }) + '\n');
    return `Snapshot ${today}: ${fmt(row.total)} tokens over ${row.turns} turns`;
  }
  throw new Error(`unknown command: ${cmd}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(main(process.argv.slice(2))); }
  catch (err) { console.error('token-usage: ' + err.message); process.exit(1); }
}
