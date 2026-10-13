import path from 'node:path';
import { adapterFor } from './adapters/index.mjs';
import { enabledSources, loadConsent } from './consent.mjs';
import { makeRedactor } from './redact.mjs';
import { CATEGORIES, analyzeTurn, categorize, splitStatements } from './signals.mjs';
import { clip, readJson, sha, stateDir, writeJson, writeText } from './util.mjs';

const estTokens = (s) => Math.ceil(s.length / 4);
const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const ROLE_PREAMBLE = /^\s*[Yy]ou are (?!(?:a|an|the|my|our)\b)[A-Z][\w-]+,? (?:the|a|an)\b/;

/**
 * A topic pass reads every statement the user typed about one subject, not only the ones with
 * a correction or preference cue, because taste is usually described ("calm, editorial, like a
 * printed page") rather than commanded. Same consent, read-only access, redaction and
 * de-duplication as extraction; output is a budgeted per-project digest, nothing else.
 */
export async function topicPass({ name, categories, match, budget, log = () => {} }) {
  const narrow = match ? new RegExp(match, 'i') : null;
  for (const c of categories) if (!CATEGORIES[c]) throw new Error(`unknown category ${c}; known: ${Object.keys(CATEGORIES).join(', ')}`);
  const consent = loadConsent();
  if (!consent.model.allowed) throw new Error('model review is not consented; run `hl consent --model allow --budget <tokens>` first');
  const cap = Math.min(budget || consent.model.maxDigestTokens, consent.model.maxDigestTokens);
  const allowed = new Set(enabledSources(consent));
  const inv = readJson(path.join(stateDir(), 'inventory.json'));
  if (!inv) throw new Error('no inventory; run `hl inventory` first');
  const primaryEnabled = new Map(inv.sessions.map((s) => [`${s.source}:${s.id}`, allowed.has(s.sourceId)]));
  const sessions = inv.sessions.filter((s) => allowed.has(s.sourceId) && s.status === 'ok' && s.origin === 'interactive' && s.userTurns && (!s.duplicateOf || !primaryEnabled.get(s.duplicateOf)));
  const redact = makeRedactor({ extraTerms: consent.redactTerms });
  const inTopic = (cats) => cats.some((c) => categories.includes(c));
  const wanted = (text) => inTopic(categorize(text)) && (!narrow || narrow.test(text));
  const seenTurns = new Set();
  const items = new Map();
  let read = 0;
  for (const s of sessions) {
    let first = true;
    try {
      for await (const t of adapterFor(s.source).turns(s)) {
        if (first && ROLE_PREAMBLE.test(t.text) && t.text.length > 800) break;
        first = false;
        const turnKey = t.key || sha(`${t.ts}|${t.text}`);
        if (seenTurns.has(turnKey)) continue;
        seenTurns.add(turnKey);
        const spec = t.text.length > 1500;
        const add = (text, kind, prev) => {
          const r = redact(text).text;
          const k = normalize(r);
          if (k.length < 12) return;
          const it = items.get(k) || { text: clip(r, 240), kind, spec, project: s.project, sessions: new Set(), first: t.ts || s.started, prev };
          it.sessions.add(`${s.source}|${s.id}`);
          if (!spec) it.spec = false;
          items.set(k, it);
        };
        for (const st of splitStatements(t.text)) if (wanted(st)) add(st, 'said', null);
        if (!spec && t.prev && inTopic(categorize(t.prev))) {
          for (const st of analyzeTurn(t.text).statements) if (st.kinds.includes('praise') || st.kinds.includes('dissatisfaction')) add(st.text, st.kinds.includes('praise') ? 'praise' : 'dislike', redact(clip(t.prev.replace(/\s+/g, ' ').trim().slice(-500), 200)).text);
        }
      }
      read++;
    } catch (e) {
      log(`  ! ${s.source}|${s.id}: ${e.message}`);
    }
  }
  // Repeated and directly typed statements first; long pasted specs last.
  const ranked = [...items.values()].sort((a, b) => Number(a.spec) - Number(b.spec) || b.sessions.size - a.sessions.size || String(a.first).localeCompare(String(b.first)));
  const header = [`# Topic: ${name}`, '', `Every redacted statement about ${categories.join(', ')} the user typed in ${read} consented sessions, deduplicated. "xN" = sessions; (spec) = from a long pasted task spec; praise/dislike lines show the end of the agent reply they answered.`, ''];
  let used = estTokens(header.join('\n'));
  const byProject = new Map();
  let included = 0;
  for (const it of ranked) {
    const line = `- ${it.kind === 'said' ? '' : `[${it.kind}] `}${it.text}${it.sessions.size > 1 ? ` x${it.sessions.size}` : ''}${it.spec ? ' (spec)' : ''}${it.prev ? `\n  prev: ${it.prev}` : ''}`;
    const t = estTokens(line) + 1;
    if (used + t > cap) continue;
    used += t;
    included++;
    if (!byProject.has(it.project)) byProject.set(it.project, []);
    byProject.get(it.project).push(line);
  }
  const body = [...byProject].sort((a, b) => b[1].length - a[1].length).flatMap(([p, lines]) => [`## ${p} (${lines.length})`, ...lines, '']);
  const file = path.join(stateDir(), 'topics', `${name}.md`);
  writeText(file, [...header, ...body].join('\n'));
  const index = { name, categories, match: match || null, generatedAt: new Date().toISOString(), sessions: read, statements: items.size, included, budget: cap, used };
  writeJson(path.join(stateDir(), 'topics', `${name}.json`), index);
  writeJson(path.join(stateDir(), 'topics', `${name}.items.json`), ranked.map((it) => ({ text: it.text, kind: it.kind, spec: it.spec, project: it.project, sessions: [...it.sessions], first: it.first })));
  return { ...index, file };
}

/**
 * Support for rules drafted from a topic digest, by keyword pattern over the private topic items:
 * statements, how many the user typed (not pasted specs), sessions and projects. Counts only.
 * Patterns are approximate; typed sessions are the honest signal.
 */
export function topicSupport({ name, patterns }) {
  const items = readJson(path.join(stateDir(), 'topics', `${name}.items.json`));
  if (!items) throw new Error(`no items for topic ${name}; run \`hl topic ${name} ...\` first`);
  const rows = Object.entries(patterns).map(([id, source]) => {
    const re = new RegExp(source, 'i');
    const hit = items.filter((it) => re.test(it.text));
    const typed = hit.filter((it) => !it.spec);
    const ts = hit.map((it) => it.first).filter(Boolean).sort();
    const typedSessions = new Set(typed.flatMap((it) => it.sessions)).size;
    return {
      id,
      statements: hit.length,
      typed: typed.length,
      sessions: new Set(hit.flatMap((it) => it.sessions)).size,
      typedSessions,
      projects: new Set(hit.map((it) => it.project).filter((p) => p && !p.startsWith('('))).size,
      span: ts.length ? `${String(ts[0]).slice(0, 7)} to ${String(ts.at(-1)).slice(0, 7)}` : 'n/a',
      strength: typedSessions >= 5 ? 'high' : typedSessions >= 2 ? 'medium' : 'judgement',
    };
  });
  writeJson(path.join(stateDir(), 'topics', `${name}.support.json`), rows);
  return rows;
}

export function topicSupportMarkdown(name, rows) {
  return [
    `# Evidence: ${name}`,
    '',
    'Generated by `hl topic-support`. Counts only: no quotes, project names or paths. Each rule is',
    'matched by a keyword pattern over the redacted topic statements, so counts are approximate.',
    'Strength comes from typed sessions (statements the owner typed, not pasted specs): high is 5',
    'or more, medium 2 to 4, judgement fewer (the rule rests on reading, not repetition).',
    '',
    '| Rule | Strength | Typed sessions | Sessions | Projects | Statements | Span |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((r) => `| ${r.id} | ${r.strength} | ${r.typedSessions} | ${r.sessions} | ${r.projects} | ${r.statements} | ${r.span} |`),
    '',
  ].join('\n');
}
