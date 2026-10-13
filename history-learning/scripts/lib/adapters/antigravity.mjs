import fs from 'node:fs';
import path from 'node:path';
import { HOME, isDir, jsonl, maxIso, minIso, toIso } from '../util.mjs';
import { dominantProject } from '../projects.mjs';

const PATH_RE = /(?<![\w])([A-Za-z]:(?:\\\\|\/)[^"'<>|*?:\r\n]+)/g;

const base = (cli) => path.join(HOME, '.gemini', cli ? 'antigravity-cli' : 'antigravity');

function transcriptOf(dir) {
  for (const f of ['transcript_full.jsonl', 'transcript.jsonl']) {
    const p = path.join(dir, '.system_generated', 'logs', f);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Antigravity brain transcripts: one step per line, typed prompts are `USER_INPUT` steps.
 * The IDE's `conversations/*.pb` and `conversations/*.db` hold the same conversations as
 * undocumented protobuf blobs; they are reported, not decoded.
 */
export const antigravity = {
  id: 'antigravity',
  agent: 'Antigravity',
  roots() {
    return [
      { path: path.join(base(false), 'brain'), exists: isDir(path.join(base(false), 'brain')), shadowclone: 'gap: ShadowClone reads only the Antigravity CLI (~/.gemini/antigravity-cli)', kind: 'ide' },
      { path: path.join(base(true), 'brain'), exists: isDir(path.join(base(true), 'brain')), shadowclone: 'native (antigravity)', kind: 'cli' },
    ];
  },
  async *sessions(root) {
    for (const id of fs.readdirSync(root.path)) {
      const file = transcriptOf(path.join(root.path, id));
      if (!file) continue;
      const st = fs.statSync(file);
      const s = { userTurns: 0, assistantTurns: 0, started: null, ended: null, paths: [], stats: {} };
      for await (const step of jsonl(file, s.stats)) {
        const ts = toIso(step.created_at);
        if (ts) (s.started = minIso(s.started, ts)), (s.ended = maxIso(s.ended, ts));
        if (step.type === 'USER_INPUT') s.userTurns++;
        else if (step.type === 'PLANNER_RESPONSE') s.assistantTurns++;
        if (step.type !== 'USER_INPUT' && s.paths.length < 300) for (const m of JSON.stringify(step).matchAll(PATH_RE)) s.paths.push(m[1].replace(/\\\\/g, '\\'));
      }
      const project = dominantProject(s.paths);
      yield {
        source: `antigravity:${root.kind}`,
        agent: 'Antigravity',
        id,
        dupKey: `antigravity:${id}`,
        project,
        cwd: null,
        started: s.started || st.mtime.toISOString(),
        ended: s.ended || st.mtime.toISOString(),
        userTurns: s.userTurns,
        assistantTurns: s.assistantTurns,
        bytes: st.size,
        origin: 'interactive',
        status: st.size ? 'ok' : 'empty',
        badLines: s.stats.badLines || 0,
        ref: { file },
        mtimeMs: st.mtimeMs,
      };
    }
  },
  async *turns(session) {
    let prev = '';
    for await (const step of jsonl(session.ref.file)) {
      const content = typeof step.content === 'string' ? step.content : '';
      if (step.type === 'PLANNER_RESPONSE' && content.trim()) prev = content;
      else if (step.type === 'USER_INPUT' && content.trim()) yield { ts: toIso(step.created_at), text: content.trim(), prev };
    }
  },
};

/** Raw IDE conversation stores, listed so coverage shows what is and is not decoded. */
export function antigravityRaw() {
  const dir = path.join(base(false), 'conversations');
  if (!isDir(dir)) return [];
  const brain = path.join(base(false), 'brain');
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(pb|db)$/.test(f))
    .map((f) => {
      const id = f.replace(/\.(pb|db)$/, '');
      const covered = !!transcriptOf(path.join(brain, id));
      return {
        source: 'antigravity:conversations',
        agent: 'Antigravity',
        id,
        dupKey: `antigravity:${id}`,
        project: '(unknown)',
        userTurns: 0,
        assistantTurns: 0,
        bytes: fs.statSync(path.join(dir, f)).size,
        origin: 'interactive',
        status: covered ? 'duplicate' : 'unsupported',
        note: covered ? `${path.extname(f)} blob duplicates the brain transcript` : `${path.extname(f)} protobuf blob has no transcript and no public schema`,
        ref: {},
      };
    });
}
