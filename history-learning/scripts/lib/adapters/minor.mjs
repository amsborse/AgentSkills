import fs from 'node:fs';
import path from 'node:path';
import { HOME, isDir, jsonl, maxIso, minIso, readJson, toIso, walkFiles } from '../util.mjs';
import { projectOf } from '../projects.mjs';

const kiroText = (content, kind = 'text') =>
  (content || [])
    .filter((c) => c?.kind?.toLowerCase() === kind)
    .map((c) => (typeof c.data === 'string' ? c.data : c.data?.text || ''))
    .join('\n')
    .trim();

export const kiro = {
  id: 'kiro',
  agent: 'Kiro',
  roots() {
    const p = path.join(HOME, '.kiro', 'sessions', 'cli');
    return [{ path: p, exists: isDir(p), shadowclone: 'gap: Kiro is not supported by ShadowClone' }];
  },
  async *sessions(root) {
    for (const file of walkFiles(root.path, (p) => p.endsWith('.jsonl'))) {
      const meta = readJson(file.replace(/\.jsonl$/, '.json'), {});
      const st = fs.statSync(file);
      let userTurns = 0;
      let assistantTurns = 0;
      for await (const l of jsonl(file)) {
        if (l.kind === 'Prompt' && kiroText(l.data?.content)) userTurns++;
        else if (l.kind === 'AssistantMessage') assistantTurns++;
      }
      const id = meta.session_id || path.basename(file, '.jsonl');
      yield { source: 'kiro', agent: 'Kiro', id, dupKey: `kiro:${id}`, project: projectOf(meta.cwd).name, cwd: meta.cwd || null, started: toIso(meta.created_at) || st.birthtime.toISOString(), ended: toIso(meta.updated_at) || st.mtime.toISOString(), userTurns, assistantTurns, bytes: st.size, origin: 'interactive', status: 'ok', ref: { file }, mtimeMs: st.mtimeMs };
    }
  },
  async *turns(session) {
    let prev = '';
    for await (const l of jsonl(session.ref.file)) {
      if (l.kind === 'AssistantMessage') prev = kiroText(l.data?.content) || prev;
      else if (l.kind === 'Prompt') {
        const text = kiroText(l.data?.content);
        if (text) yield { key: l.data?.message_id, ts: toIso(l.data?.meta?.timestamp), text, prev };
      }
    }
  },
};

const qwenText = (m) =>
  (m?.parts || [])
    .map((p) => p?.text || '')
    .join('\n')
    .trim();

export const qwen = {
  id: 'qwen',
  agent: 'Qwen Code',
  roots() {
    const p = path.join(HOME, '.qwen', 'projects');
    return [{ path: p, exists: isDir(p), shadowclone: 'gap: Qwen Code is not supported by ShadowClone' }];
  },
  async *sessions(root) {
    for (const file of walkFiles(root.path, (p) => p.endsWith('.jsonl'))) {
      const st = fs.statSync(file);
      const s = { userTurns: 0, assistantTurns: 0, started: null, ended: null, cwd: null, id: null };
      for await (const l of jsonl(file)) {
        const ts = toIso(l.timestamp);
        if (ts) (s.started = minIso(s.started, ts)), (s.ended = maxIso(s.ended, ts));
        s.cwd = s.cwd || l.cwd;
        s.id = s.id || l.sessionId;
        if (l.type === 'user' && qwenText(l.message)) s.userTurns++;
        else if (l.type === 'assistant' || l.message?.role === 'model') s.assistantTurns++;
      }
      const id = s.id || path.basename(file, '.jsonl');
      yield { source: 'qwen', agent: 'Qwen Code', id, dupKey: `qwen:${id}`, project: projectOf(s.cwd).name, cwd: s.cwd, started: s.started, ended: s.ended, userTurns: s.userTurns, assistantTurns: s.assistantTurns, bytes: st.size, origin: 'interactive', status: 'ok', ref: { file }, mtimeMs: st.mtimeMs };
    }
  },
  async *turns(session) {
    let prev = '';
    for await (const l of jsonl(session.ref.file)) {
      const text = qwenText(l.message);
      if (l.type === 'user' && text) yield { key: l.uuid, ts: toIso(l.timestamp), text, prev };
      else if (text) prev = text;
    }
  },
};

/**
 * Stores that are detected and reported but deliberately not read for evidence: either they
 * duplicate a richer source, or there is nothing in them, or their format is undocumented.
 */
export function auxiliaryStores(claudeDirs) {
  const out = [];
  for (const d of claudeDirs) {
    const h = path.join(d, 'history.jsonl');
    if (fs.existsSync(h)) out.push({ store: `${path.basename(d)}/history.jsonl`, agent: 'Claude Code', path: h, bytes: fs.statSync(h).size, status: 'duplicate', note: 'prompt log; every entry also appears in the project transcripts', shadowclone: path.basename(d) === '.claude' ? 'native (claude-prompts)' : 'gap' });
  }
  const cont = path.join(HOME, '.continue', 'sessions');
  if (isDir(cont)) {
    const files = fs.readdirSync(cont).filter((f) => f.endsWith('.json') && f !== 'sessions.json');
    out.push({ store: '~/.continue/sessions', agent: 'Continue', path: cont, bytes: null, status: files.length ? 'unsupported' : 'empty', note: files.length ? `${files.length} sessions; no adapter yet` : 'no saved sessions', shadowclone: 'gap' });
  }
  const vsc = path.join(process.env.APPDATA || '', 'Code', 'User', 'workspaceStorage');
  if (isDir(vsc)) {
    const chats = walkFiles(vsc, (p) => /[\\/]chatSessions[\\/][^\\/]+\.json$/.test(p));
    out.push({ store: 'VS Code chatSessions', agent: 'GitHub Copilot Chat', path: vsc, bytes: null, status: chats.length ? 'unsupported' : 'empty', note: chats.length ? `${chats.length} chat sessions; no adapter yet` : 'no chat sessions stored', shadowclone: 'gap' });
  }
  return out;
}

/** Agents ShadowClone or users commonly run, checked so absence is reported rather than assumed. */
export function absentAgents() {
  const appdata = process.env.APPDATA || '';
  const probes = [
    ['Pi', path.join(HOME, '.pi', 'agent', 'sessions'), 'native (pi)'],
    ['Cursor CLI (cursor-agent)', path.join(HOME, '.cursor', 'chats'), 'native (cursor)'],
    ['Antigravity CLI', path.join(HOME, '.gemini', 'antigravity-cli'), 'native (antigravity)'],
    ['Gemini CLI', path.join(HOME, '.gemini', 'tmp'), 'gap'],
    ['Windsurf / Codeium', path.join(HOME, '.codeium'), 'gap'],
    ['Factory Droid', path.join(HOME, '.factory', 'sessions'), 'gap'],
    ['Amp', path.join(HOME, '.local', 'share', 'amp'), 'gap'],
    ['Cline / Roo (VS Code)', path.join(appdata, 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev'), 'gap'],
    ['Claude Desktop', path.join(appdata, 'Claude'), 'gap: conversations are stored server-side'],
    ['Aider', path.join(HOME, '.aider'), 'gap'],
  ];
  return probes.map(([agent, p, shadowclone]) => ({ agent, path: p, present: fs.existsSync(p), shadowclone }));
}
