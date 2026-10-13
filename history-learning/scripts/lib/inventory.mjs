import path from 'node:path';
import { ADAPTERS, sourceIdOf } from './adapters/index.mjs';
import { antigravityRaw } from './adapters/antigravity.mjs';
import { claudeProfiles } from './adapters/claude.mjs';
import { absentAgents, auxiliaryStores } from './adapters/minor.mjs';
import { stateDir, writeJson, writeText } from './util.mjs';

/**
 * Walks every store read-only and records metadata only: ids, project, dates, turn counts
 * and sizes. Message text is parsed in memory to classify turns but never written.
 */
export async function buildInventory({ log = () => {} } = {}) {
  const roots = [];
  const sessions = [];
  for (const a of ADAPTERS) {
    for (const root of a.roots()) {
      const entry = { adapter: a.id, agent: a.agent, path: root.path, exists: root.exists, shadowclone: root.shadowclone, sessions: 0, error: null };
      roots.push(entry);
      if (!root.exists) continue;
      log(`  ${a.id}: ${root.path}`);
      try {
        for await (const s of a.sessions(root)) {
          entry.sessions++;
          sessions.push(s);
        }
      } catch (e) {
        entry.error = `${e.code || e.name}: ${e.message}`.slice(0, 300);
      }
    }
  }
  sessions.push(...antigravityRaw());

  const groups = new Map();
  for (const s of sessions) {
    s.sourceId = sourceIdOf(s.source);
    if (!groups.has(s.dupKey)) groups.set(s.dupKey, []);
    groups.get(s.dupKey).push(s);
  }
  for (const list of groups.values()) {
    const readable = list.filter((s) => s.status === 'ok');
    readable.slice(1).forEach((s) => (s.duplicateOf = `${readable[0].source}:${readable[0].id}`));
  }
  const inv = {
    generatedAt: new Date().toISOString(),
    roots,
    auxiliary: auxiliaryStores(claudeProfiles()),
    absent: absentAgents(),
    sessions: sessions.map(({ ref, ...s }) => ({ ...s, ref: ref.file ? { file: ref.file } : ref })),
  };
  writeJson(path.join(stateDir(), 'inventory.json'), inv);
  writeText(path.join(stateDir(), 'reports', 'coverage.md'), coverageReport(inv));
  return inv;
}

const month = (iso) => (iso ? iso.slice(0, 7) : 'unknown');
const fmtBytes = (n) => (n == null ? '' : n > 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`);
const row = (cells) => `| ${cells.join(' | ')} |`;
const table = (head, rows) => [row(head), row(head.map(() => '---')), ...rows.map(row)].join('\n');

export function coverageReport(inv, processed = null) {
  const S = inv.sessions;
  const unique = S.filter((s) => !s.duplicateOf && s.status === 'ok');
  const out = [`# Historical conversation coverage`, '', `Generated ${inv.generatedAt}. Metadata only; no message text is stored in this report.`, ''];
  const eligible = unique.filter((s) => s.origin === 'interactive');
  out.push(
    `**${S.length}** session records, **${unique.length}** unique readable conversations, **${unique.reduce((n, s) => n + (s.userTurns || 0), 0)}** user turns.`,
    `Evidence-eligible (unique, human-driven, not automated or subagent): **${eligible.length}** conversations, **${eligible.reduce((n, s) => n + (s.userTurns || 0), 0)}** user turns.`,
    'Automated sessions (headless `claude -p` / `codex exec` runs from loops) and subagent sessions carry prompts written by tools, not by you, and are excluded from preference evidence.',
    '',
  );

  out.push('## Sources', '');
  const bySource = new Map();
  for (const s of S) {
    const k = s.source;
    const v = bySource.get(k) || { agent: s.agent, n: 0, interactive: 0, automated: 0, subagent: 0, dup: 0, bad: 0, turns: 0, bytes: 0, first: null, last: null, done: 0 };
    v.n++;
    v[s.origin] = (v[s.origin] || 0) + 1;
    if (s.duplicateOf || s.status === 'duplicate') v.dup++;
    if (['empty', 'unreadable', 'unsupported'].includes(s.status)) v.bad++;
    v.turns += s.userTurns || 0;
    v.bytes += s.bytes || 0;
    if (s.started && (!v.first || s.started < v.first)) v.first = s.started;
    if (s.ended && (!v.last || s.ended > v.last)) v.last = s.ended;
    if (processed?.has(`${s.source}|${s.id}`)) v.done++;
    bySource.set(k, v);
  }
  const shadow = new Map(inv.roots.map((r) => [r.adapter, r.shadowclone]));
  out.push(
    table(
      ['Agent', 'Source', 'Sessions', 'Interactive', 'Automated', 'Subagent', 'Duplicate', 'Empty/unsupported', 'User turns', 'Size', 'First', 'Last', ...(processed ? ['Processed'] : [])],
      [...bySource].map(([k, v]) => [v.agent, `\`${k}\``, v.n, v.interactive, v.automated, v.subagent, v.dup, v.bad, v.turns, fmtBytes(v.bytes), v.first?.slice(0, 10) || '', v.last?.slice(0, 10) || '', ...(processed ? [v.done] : [])]),
    ),
    '',
  );

  out.push('## Store locations and ShadowClone support', '');
  out.push(table(['Adapter', 'Path', 'Present', 'Sessions', 'ShadowClone', 'Error'], inv.roots.map((r) => [r.adapter, `\`${r.path}\``, r.exists ? 'yes' : 'no', r.sessions, r.shadowclone, r.error || ''])), '');

  out.push('## Detected but not read', '');
  out.push(table(['Agent', 'Store', 'Status', 'Note', 'ShadowClone'], inv.auxiliary.map((a) => [a.agent, `\`${a.store}\``, a.status, a.note, a.shadowclone])), '');
  const raw = S.filter((s) => s.source === 'antigravity:conversations');
  if (raw.length) out.push(`Antigravity raw conversation blobs: ${raw.map((s) => `${s.id.slice(0, 8)} (${s.status}: ${s.note})`).join('; ')}.`, '');

  out.push('## Agents checked and not installed', '');
  const absent = inv.absent.filter((a) => !a.present);
  const presentNoAdapter = inv.absent.filter((a) => a.present);
  out.push(absent.map((a) => `- ${a.agent} (\`${a.path}\`)`).join('\n') || '- none', '');
  if (presentNoAdapter.length) out.push('Present without an adapter (unsupported, not skipped silently):', '', presentNoAdapter.map((a) => `- ${a.agent} (\`${a.path}\`)`).join('\n'), '');

  out.push('## By project (unique interactive conversations)', '');
  const proj = new Map();
  for (const s of unique.filter((x) => x.origin === 'interactive')) {
    const v = proj.get(s.project) || { agents: new Map(), turns: 0, first: null, last: null };
    v.agents.set(s.agent, (v.agents.get(s.agent) || 0) + 1);
    v.turns += s.userTurns || 0;
    if (s.started && (!v.first || s.started < v.first)) v.first = s.started;
    if (s.ended && (!v.last || s.ended > v.last)) v.last = s.ended;
    proj.set(s.project, v);
  }
  out.push(
    table(
      ['Project', 'Conversations by agent', 'User turns', 'First', 'Last'],
      [...proj]
        .sort((a, b) => b[1].turns - a[1].turns)
        .map(([p, v]) => [p, [...v.agents].map(([a, n]) => `${a} ${n}`).join(', '), v.turns, v.first?.slice(0, 10) || '', v.last?.slice(0, 10) || '']),
    ),
    '',
  );

  out.push('## By month (unique conversations)', '');
  const agents = [...new Set(unique.map((s) => s.agent))].sort();
  const months = new Map();
  for (const s of unique) {
    const m = month(s.started);
    const v = months.get(m) || {};
    v[s.agent] = (v[s.agent] || 0) + 1;
    months.set(m, v);
  }
  out.push(table(['Month', ...agents], [...months].sort().map(([m, v]) => [m, ...agents.map((a) => v[a] || 0)])), '');

  out.push('## Duplicates and overlaps', '');
  const dups = S.filter((s) => s.duplicateOf);
  const pairs = new Map();
  for (const s of dups) {
    const k = `${s.source} → ${s.duplicateOf.split(':').slice(0, -1).join(':')}`;
    pairs.set(k, (pairs.get(k) || 0) + 1);
  }
  out.push([...pairs].map(([k, n]) => `- ${n} × \`${k}\``).join('\n') || '- none detected by id', '');
  const forks = S.filter((s) => s.forkedFrom).length;
  if (forks) out.push(`- ${forks} forked sessions repeat their parent's history; turns are deduplicated by content during extraction.`, '');
  out.push('- Turns are also deduplicated by content hash within a conversation and across resumed sessions.', '');
  const bad = S.filter((s) => s.badLines);
  if (bad.length) out.push(`- ${bad.length} files contain malformed lines (${bad.reduce((n, s) => n + s.badLines, 0)} lines skipped).`, '');
  return out.join('\n');
}
