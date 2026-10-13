import fs from 'node:fs';
import path from 'node:path';
import { HOME, isFile, openDb, toIso } from '../util.mjs';
import { projectOf } from '../projects.mjs';

const dbPath = (env = process.env) => (env.OPENCODE_DB ? path.resolve(env.OPENCODE_DB) : path.join(env.XDG_DATA_HOME || path.join(HOME, '.local', 'share'), 'opencode', 'opencode.db'));

const textOf = (data) => {
  if (typeof data.text === 'string') return data.text;
  return (data.content || [])
    .filter((c) => c?.type === 'text')
    .map((c) => c.text)
    .join('\n');
};

/**
 * Only `session_v2` and `session_message` are queried. The same database holds
 * `credential`, `account` and `control_account`; those tables are never read.
 */
export const opencode = {
  id: 'opencode',
  agent: 'OpenCode',
  roots() {
    const p = dbPath();
    return [{ path: p, exists: isFile(p), shadowclone: 'native (opencode)' }];
  },
  async *sessions(root) {
    const db = await openDb(root.path);
    const st = fs.statSync(root.path);
    const counts = new Map();
    for (const r of db.prepare("SELECT session_id, type, count(*) n FROM session_message WHERE type IN ('user','assistant') GROUP BY session_id, type").all()) {
      const c = counts.get(r.session_id) || { user: 0, assistant: 0 };
      c[r.type] = Number(r.n);
      counts.set(r.session_id, c);
    }
    for (const s of db.prepare('SELECT id, parent_id, fork_session_id, directory, time_created, time_updated FROM session_v2').all()) {
      const c = counts.get(s.id) || { user: 0, assistant: 0 };
      yield {
        source: 'opencode',
        agent: 'OpenCode',
        id: s.id,
        dupKey: `opencode:${s.id}`,
        forkedFrom: s.fork_session_id || null,
        project: projectOf(s.directory).name,
        cwd: s.directory,
        started: toIso(s.time_created),
        ended: toIso(s.time_updated),
        userTurns: c.user,
        assistantTurns: c.assistant,
        bytes: null,
        origin: s.parent_id ? 'subagent' : 'interactive',
        status: c.user + c.assistant ? 'ok' : 'empty',
        ref: { db: root.path, sessionId: s.id },
        mtimeMs: Date.parse(toIso(s.time_updated) || 0) || st.mtimeMs,
      };
    }
    db.close();
  },
  async *turns(session) {
    const db = await openDb(session.ref.db);
    try {
      let prev = '';
      for (const r of db.prepare("SELECT type, data FROM session_message WHERE session_id = ? AND type IN ('user','assistant') ORDER BY seq").iterate(session.ref.sessionId)) {
        let data;
        try {
          data = JSON.parse(r.data);
        } catch {
          continue;
        }
        const text = textOf(data).trim();
        if (r.type === 'assistant') {
          if (text) prev = text;
        } else if (text) yield { ts: toIso(data.time?.created), text, prev };
      }
    } finally {
      db.close();
    }
  },
};
