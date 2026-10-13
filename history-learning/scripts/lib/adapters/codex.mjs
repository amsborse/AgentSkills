import fs from 'node:fs';
import path from 'node:path';
import { HOME, isDir, jsonl, maxIso, minIso, toIso, walkFiles } from '../util.mjs';
import { projectOf } from '../projects.mjs';

const INJECTED = /^\s*(<environment_context>|<user_instructions>|<permissions instructions>|<turn_aborted>|<subagent_notification>|# AGENTS\.md instructions|<INSTRUCTIONS>)/;

const codexHome = (env = process.env) => (env.CODEX_HOME ? path.resolve(env.CODEX_HOME) : path.join(HOME, '.codex'));

function messageText(payload) {
  if (typeof payload.content === 'string') return payload.content.trim();
  return (payload.content || [])
    .filter((c) => c && /text$/.test(c.type || '') && !INJECTED.test(c.text || ''))
    .map((c) => c.text)
    .join('\n')
    .trim();
}

/**
 * The prompt the human typed. CLI builds emit `event_msg/user_message`; the desktop app emits
 * `event_msg/item_completed` with a `UserMessage` item. Returns null for anything else.
 */
function typedPrompt(l) {
  const p = l.payload || {};
  if (l.type !== 'event_msg') return null;
  if (p.type === 'user_message' && typeof p.message === 'string') return p.message.trim();
  if (p.type === 'item_completed' && p.item?.type === 'UserMessage') return messageText(p.item);
  return null;
}

function agentReply(l) {
  const p = l.payload || {};
  if (l.type !== 'event_msg') return null;
  if (p.type === 'agent_message' && p.message) return String(p.message);
  if (p.type === 'item_completed' && p.item?.type === 'AgentMessage') return messageText(p.item);
  return null;
}

function originOf(meta) {
  const src = meta.source;
  if (src && typeof src === 'object') return 'subagent';
  if (src === 'exec' || /exec/i.test(meta.originator || '')) return 'automated';
  return 'interactive';
}

/**
 * Codex records each prompt twice: as a `response_item` user message (alongside injected
 * AGENTS.md and environment context) and as an event. Prefer the event; fall back to
 * filtered response items for versions that lack it.
 */
async function* userEvents(file) {
  const fromEvents = [];
  const fromItems = [];
  let prev = '';
  for await (const l of jsonl(file)) {
    const p = l.payload || {};
    const typed = typedPrompt(l);
    const reply = typed === null ? agentReply(l) : null;
    if (typed) {
      if (!INJECTED.test(typed)) fromEvents.push({ ts: toIso(l.timestamp), text: typed, prev });
    } else if (reply) prev = reply;
    else if (l.type === 'response_item' && p.type === 'message') {
      const text = messageText(p);
      if (p.role === 'assistant' && text) prev = text;
      else if (p.role === 'user' && text && !INJECTED.test(text)) fromItems.push({ ts: toIso(l.timestamp), text, prev });
    }
  }
  yield* fromEvents.length ? fromEvents : fromItems;
}

export const codex = {
  id: 'codex',
  agent: 'Codex',
  roots() {
    const h = codexHome();
    return ['sessions', 'archived_sessions'].map((d) => ({ path: path.join(h, d), exists: isDir(path.join(h, d)), shadowclone: d === 'sessions' ? 'native (codex)' : 'gap: archived sessions' }));
  },
  async *sessions(root) {
    for (const file of walkFiles(root.path, (p) => p.endsWith('.jsonl'))) {
      const st = fs.statSync(file);
      const s = { meta: {}, userTurns: 0, assistantTurns: 0, started: null, ended: null, cwd: null, stats: {} };
      if (st.size > 0) {
        for await (const l of jsonl(file, s.stats)) {
          const ts = toIso(l.timestamp);
          if (ts) (s.started = minIso(s.started, ts)), (s.ended = maxIso(s.ended, ts));
          const p = l.payload || {};
          if (l.type === 'session_meta') {
            if (!s.meta.id) s.meta = { id: p.id || p.session_id, source: p.source, originator: p.originator, forkedFrom: p.forked_from_id || null };
            s.cwd = s.cwd || p.cwd;
          } else if (l.type === 'turn_context' && p.cwd && !s.cwd) s.cwd = p.cwd;
          else if (typedPrompt(l)) s.userTurns++;
          else if (agentReply(l)) s.assistantTurns++;
        }
      }
      const id = s.meta.id || path.basename(file, '.jsonl');
      yield {
        source: root.path.endsWith('archived_sessions') ? 'codex:archived' : 'codex',
        agent: 'Codex',
        id,
        dupKey: `codex:${id}`,
        forkedFrom: s.meta.forkedFrom,
        project: projectOf(s.cwd).name,
        cwd: s.cwd,
        started: s.started || st.mtime.toISOString(),
        ended: s.ended || st.mtime.toISOString(),
        userTurns: s.userTurns,
        assistantTurns: s.assistantTurns,
        bytes: st.size,
        origin: originOf(s.meta),
        status: st.size === 0 ? 'empty' : 'ok',
        badLines: s.stats.badLines || 0,
        ref: { file },
        mtimeMs: st.mtimeMs,
      };
    }
  },
  async *turns(session) {
    yield* userEvents(session.ref.file);
  },
};
