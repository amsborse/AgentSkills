import fs from 'node:fs';
import path from 'node:path';
import { HOME, isFile, jsonl, openDb, toIso, walkFiles } from '../util.mjs';
import { dominantProject, projectFromSlug, projectOf } from '../projects.mjs';

/** Cursor wraps the typed prompt in `<user_query>` next to injected reminders and attachments. */
export function cursorUserText(raw) {
  const text = String(raw || '');
  const q = [...text.matchAll(/<user_query>([\s\S]*?)<\/user_query>/g)].map((m) => m[1].trim());
  if (q.length) return q.join('\n').trim() || null;
  const stripped = text.replace(/<(system_reminder|system-reminder|attached_files|agent_transcripts|timestamp|image_files|open_and_recently_viewed_files|user_info|git_status|rules|agent_skills|manually_attached_skills)>[\s\S]*?<\/\1>/g, '').trim();
  return stripped || null;
}

const partsText = (content) =>
  (Array.isArray(content) ? content : [content])
    .map((c) => (typeof c === 'string' ? c : c?.type === 'text' ? c.text : ''))
    .join('\n');

const globalDb = () => path.join(process.env.APPDATA || path.join(HOME, '.config'), 'Cursor', 'User', 'globalStorage', 'state.vscdb');

export const cursorTranscripts = {
  id: 'cursor-transcripts',
  agent: 'Cursor',
  roots() {
    const p = path.join(HOME, '.cursor', 'projects');
    return [{ path: p, exists: fs.existsSync(p), shadowclone: 'gap: ShadowClone reads only cursor-agent CLI chats (~/.cursor/chats)' }];
  },
  async *sessions(root) {
    let slugs = [];
    try {
      slugs = fs.readdirSync(root.path);
    } catch {}
    for (const slug of slugs) {
      const dir = path.join(root.path, slug, 'agent-transcripts');
      for (const file of walkFiles(dir, (p) => p.endsWith('.jsonl'))) {
        const st = fs.statSync(file);
        let userTurns = 0;
        let assistantTurns = 0;
        const stats = {};
        for await (const l of jsonl(file, stats)) {
          if (l.role === 'user' && cursorUserText(partsText(l.message?.content))) userTurns++;
          else if (l.role === 'assistant') assistantTurns++;
        }
        const id = path.basename(file, '.jsonl');
        yield {
          source: 'cursor:agent-transcripts',
          agent: 'Cursor',
          id,
          dupKey: `cursor:${id}`,
          project: projectFromSlug(slug).name,
          cwd: null,
          started: st.birthtime.toISOString(),
          ended: st.mtime.toISOString(),
          userTurns,
          assistantTurns,
          bytes: st.size,
          origin: /[\\/]subagents[\\/]/.test(file) ? 'subagent' : 'interactive',
          status: st.size === 0 ? 'empty' : 'ok',
          badLines: stats.badLines || 0,
          ref: { file },
          mtimeMs: st.mtimeMs,
          timestamps: 'file times only',
        };
      }
    }
  },
  async *turns(session) {
    let prev = '';
    for await (const l of jsonl(session.ref.file)) {
      const raw = partsText(l.message?.content);
      if (l.role === 'assistant') {
        if (raw.trim()) prev = raw;
      } else if (l.role === 'user') {
        const text = cursorUserText(raw);
        if (text) yield { ts: null, text, prev };
      }
    }
  },
};

const uriPath = (uri) => {
  try {
    return decodeURIComponent(String(uri).replace(/^file:\/\/\/?/, '').replace(/^\/([a-z]:)/i, '$1')).replace(/\//g, '\\');
  } catch {
    return String(uri);
  }
};

/** The workspace folder when Cursor recorded one, otherwise the project most edited files belong to. */
function projectOfComposer(b, composer) {
  const ws = (b?.workspaceUris || [])[0];
  if (ws) return projectOf(uriPath(ws)).name;
  const files = [...Object.keys(composer.originalFileStates || {}), ...Object.keys(composer.codeBlockData || {}), ...(composer.newlyCreatedFiles || []).map((f) => f?.uri?.external || f?.uri?.path || '')];
  return dominantProject(files.filter(Boolean).map(uriPath));
}

function headersOf(c) {
  if (Array.isArray(c.fullConversationHeadersOnly)) return c.fullConversationHeadersOnly.map((h) => ({ id: h.bubbleId, type: h.type }));
  if (Array.isArray(c.conversation)) return c.conversation.map((b) => ({ id: b.bubbleId, type: b.type, inline: b }));
  return [];
}

/**
 * Cursor IDE (Composer / Agent) chats in the global `state.vscdb`: `composerData:<id>` holds
 * headers, `bubbleId:<composer>:<bubble>` each message. Only exact keys and key-prefix range
 * scans are issued, read-only, against the `cursorDiskKV` table.
 */
export const cursorIde = {
  id: 'cursor-ide',
  agent: 'Cursor',
  roots() {
    const p = globalDb();
    return [{ path: p, exists: isFile(p), shadowclone: 'gap: Cursor IDE database not supported by ShadowClone' }];
  },
  async *sessions(root) {
    const db = await openDb(root.path);
    const st = fs.statSync(root.path);
    const bubble = db.prepare('SELECT value FROM cursorDiskKV WHERE key = ?');
    const rows = db.prepare("SELECT key, value FROM cursorDiskKV WHERE key >= 'composerData:' AND key < 'composerData;'").iterate();
    for (const row of rows) {
      let c;
      try {
        c = JSON.parse(row.value);
      } catch {
        yield { source: 'cursor:ide', agent: 'Cursor', id: row.key.slice(13), dupKey: `cursor:${row.key.slice(13)}`, status: 'unreadable', userTurns: 0, assistantTurns: 0, project: '(unknown)', ref: {} };
        continue;
      }
      if (!c) continue;
      const id = c.composerId || row.key.slice(13);
      const headers = headersOf(c);
      const users = headers.filter((h) => h.type === 1);
      let first = users[0]?.inline || null;
      if (!first && users[0]) {
        const r = bubble.get(`bubbleId:${id}:${users[0].id}`);
        try {
          first = r ? JSON.parse(r.value) : null;
        } catch {}
      }
      yield {
        source: 'cursor:ide',
        agent: 'Cursor',
        id,
        dupKey: `cursor:${id}`,
        project: projectOfComposer(first, c),
        cwd: null,
        started: toIso(c.createdAt),
        ended: toIso(c.lastUpdatedAt || c.createdAt),
        userTurns: users.length,
        assistantTurns: headers.length - users.length,
        bytes: row.value.length,
        origin: first?.subagentSpawnTaskToolCallId ? 'subagent' : 'interactive',
        status: headers.length ? 'ok' : 'empty',
        ref: { db: root.path, composerId: id },
        mtimeMs: Date.parse(toIso(c.lastUpdatedAt || c.createdAt) || 0) || st.mtimeMs,
      };
    }
    db.close();
  },
  async *turns(session) {
    const db = await openDb(session.ref.db);
    try {
      const row = db.prepare('SELECT value FROM cursorDiskKV WHERE key = ?').get(`composerData:${session.ref.composerId}`);
      const c = row ? JSON.parse(row.value) : null;
      if (!c) return;
      const get = db.prepare('SELECT value FROM cursorDiskKV WHERE key = ?');
      let prev = '';
      for (const h of headersOf(c)) {
        let b = h.inline;
        if (!b) {
          const r = get.get(`bubbleId:${session.ref.composerId}:${h.id}`);
          try {
            b = r ? JSON.parse(r.value) : null;
          } catch {
            b = null;
          }
        }
        if (!b) continue;
        if (h.type === 2) {
          if (b.text?.trim()) prev = b.text;
        } else if (h.type === 1) {
          const text = cursorUserText(b.text);
          if (text) yield { key: `cursor:${h.id}`, ts: toIso(b.createdAt), text, prev };
        }
      }
    } finally {
      db.close();
    }
  },
};
