import fs from 'node:fs';
import path from 'node:path';
import { HOME, isDir, jsonl, maxIso, minIso, toIso, walkFiles } from '../util.mjs';
import { projectOf } from '../projects.mjs';

const NOISE = /^\s*(<command-|<local-command-|<system-reminder>|<task-notification>|<bash-(input|stdout|stderr)>|<user-prompt-submit-hook>|Caveat: The messages below|\[Request interrupted|This session is being continued from a previous conversation)/;

/** Human-typed text of a Claude Code `user` line, or null for tool results, hooks and injected context. */
export function humanText(line) {
  if (line.type !== 'user' || line.isSidechain || line.isMeta || line.isCompactSummary || line.toolUseResult) return null;
  const c = line.message?.content;
  let text = '';
  if (typeof c === 'string') text = c;
  else if (Array.isArray(c)) {
    if (c.some((p) => p?.type === 'tool_result')) return null;
    text = c
      .filter((p) => p?.type === 'text')
      .map((p) => p.text)
      .join('\n');
  }
  text = text.trim();
  return text && !NOISE.test(text) ? text : null;
}

function assistantText(line) {
  const c = line.message?.content;
  if (!Array.isArray(c)) return typeof c === 'string' ? c : '';
  return c
    .filter((p) => p?.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

/** Every Claude Code config dir (`~/.claude` plus `CLAUDE_CONFIG_DIR` profiles such as `~/.claude-work`). */
export function claudeProfiles(env = process.env) {
  const dirs = new Set();
  if (env.CLAUDE_CONFIG_DIR) dirs.add(path.resolve(env.CLAUDE_CONFIG_DIR));
  for (const d of fs.readdirSync(HOME)) if (/^\.claude(-[\w-]+)?$/.test(d)) dirs.add(path.join(HOME, d));
  return [...dirs].filter((d) => isDir(path.join(d, 'projects')));
}

export const claude = {
  id: 'claude-code',
  agent: 'Claude Code',
  roots() {
    return claudeProfiles().map((d) => ({
      path: path.join(d, 'projects'),
      exists: true,
      shadowclone: path.resolve(d) === path.join(HOME, '.claude') ? 'native (claude-code)' : 'gap: ShadowClone reads only ~/.claude',
      profile: path.basename(d),
    }));
  },
  async *sessions(root) {
    for (const file of walkFiles(root.path, (p) => p.endsWith('.jsonl'))) {
      const st = fs.statSync(file);
      const s = { file, bytes: st.size, userTurns: 0, assistantTurns: 0, started: null, ended: null, cwd: null, id: path.basename(file, '.jsonl'), entry: null, stats: {} };
      const isSubagentFile = /[\\/]subagents[\\/]/.test(file);
      if (st.size > 0) {
        for await (const line of jsonl(file, s.stats)) {
          const ts = toIso(line.timestamp);
          if (ts) (s.started = minIso(s.started, ts)), (s.ended = maxIso(s.ended, ts));
          if (line.cwd && !s.cwd) s.cwd = line.cwd;
          if (line.sessionId && !isSubagentFile) s.id = line.sessionId;
          if (line.entrypoint && !s.entry) s.entry = line.entrypoint;
          if (line.type === 'assistant') s.assistantTurns++;
          else if (humanText(line)) s.userTurns++;
        }
      }
      yield {
        source: `claude-code:${root.profile}`,
        agent: 'Claude Code',
        id: s.id,
        dupKey: `claude:${s.id}`,
        project: projectOf(s.cwd).name,
        cwd: s.cwd,
        started: s.started || st.mtime.toISOString(),
        ended: s.ended || st.mtime.toISOString(),
        userTurns: s.userTurns,
        assistantTurns: s.assistantTurns,
        bytes: s.bytes,
        origin: isSubagentFile ? 'subagent' : /^sdk/.test(s.entry || '') ? 'automated' : 'interactive',
        status: st.size === 0 ? 'empty' : 'ok',
        badLines: s.stats.badLines || 0,
        ref: { file },
        mtimeMs: st.mtimeMs,
      };
    }
  },
  async *turns(session) {
    let prev = '';
    for await (const line of jsonl(session.ref.file)) {
      if (line.type === 'assistant') {
        const t = assistantText(line);
        if (t.trim()) prev = t;
        continue;
      }
      const text = humanText(line);
      if (text) yield { key: line.uuid || null, ts: toIso(line.timestamp), text, prev };
    }
  },
};
