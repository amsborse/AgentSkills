'use strict';

// Antigravity SessionStart & Stop hook for:
// 1. Context-watch & auto-handoff (ported from ~/.claude/hooks/context-watch.ps1 & handoff.ps1)
//    - On Stop: when transcript exceeds threshold (steps/bytes) or token budget hit, saves a
//      per-repo handoff note in ~/.gemini/config/handoffs/ once per conversation.
//    - On SessionStart: loads the newest unused handoff note (< 3 days old) for this repo once
//      and marks it `.used.md`, injecting it into context.
// 2. History-learning bridge (SessionStart): runs ~/agent-skills/history-learning/scripts/hl.mjs
//    and forwards any review notice cleanly via Antigravity's `injectSteps` contract.

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { recordEvent } = require('./telemetry.js');

const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const WARN_LINES = 80;
const WARN_BYTES = 350 * 1024;

function handoffDir() {
  return process.env.AGY_HANDOFF_DIR || path.join(os.homedir(), '.gemini', 'config', 'handoffs');
}

function watchStateDir() {
  return process.env.AGY_WATCH_DIR || path.join(os.tmpdir(), 'agy-context-watch');
}

function repoSlug(cwd) {
  const leaf = path.basename(cwd || 'workspace') || 'workspace';
  return leaf.replace(/[^A-Za-z0-9._-]+/g, '_').toLowerCase();
}

function gitSafe(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function extractRecentPrompts(transcriptPath, max = 3) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return [];
  try {
    const lines = fs.readFileSync(transcriptPath, 'utf8').split(/\r?\n/).filter(Boolean);
    const prompts = [];
    for (let i = lines.length - 1; i >= 0 && prompts.length < max; i--) {
      if (!lines[i].includes('USER_INPUT')) continue;
      try {
        const obj = JSON.parse(lines[i]);
        const text = String(obj.content || obj.text || '').replace(/\s+/g, ' ').trim();
        if (text && !text.startsWith('/')) prompts.unshift(text.slice(0, 180));
      } catch {}
    }
    return prompts;
  } catch {
    return [];
  }
}

function saveHandoff(payload) {
  const cwd = payload.cwd || (payload.workspacePaths && payload.workspacePaths[0]) || '';
  if (!cwd) return null;
  const convId = String(payload.conversationId || 'session').slice(0, 8);
  const wdir = watchStateDir();
  fs.mkdirSync(wdir, { recursive: true });
  const marker = path.join(wdir, `${convId}.saved`);
  if (fs.existsSync(marker)) return null;

  let shouldSave = payload.terminationReason === 'MAX_TOKEN_BUDGET_EXCEEDED';
  let lineCount = 0;
  let byteSize = 0;
  if (!shouldSave && payload.transcriptPath && fs.existsSync(payload.transcriptPath)) {
    const stat = fs.statSync(payload.transcriptPath);
    byteSize = stat.size;
    if (byteSize >= WARN_BYTES) {
      shouldSave = true;
    } else if (byteSize > 10000) {
      lineCount = fs.readFileSync(payload.transcriptPath, 'utf8').split('\n').length;
      if (lineCount >= WARN_LINES) shouldSave = true;
    }
  }
  if (!shouldSave) return null;

  const branch = gitSafe(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const status = gitSafe(cwd, ['status', '--short']).split(/\r?\n/).filter(Boolean).slice(0, 20);
  const prompts = extractRecentPrompts(payload.transcriptPath, 3);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const slug = repoSlug(cwd);
  const dir = handoffDir();
  fs.mkdirSync(dir, { recursive: true });
  const outFile = path.join(dir, `${slug}.${stamp}.${convId}.md`);

  const md = [
    `# Session Handoff — ${path.basename(cwd)}`,
    `- Saved: ${new Date().toISOString()}`,
    `- Conversation: ${payload.conversationId || 'unknown'}`,
    branch ? `- Branch: \`${branch}\`` : null,
    `- Transcript size: ${Math.round(byteSize / 1024)} KB${lineCount ? ` (${lineCount} steps)` : ''}`,
    '',
    '## Recent User Requests',
    ...(prompts.length ? prompts.map((p, idx) => `${idx + 1}. ${p}`) : ['- (none captured)']),
    '',
    '## Working Tree Snapshot',
    ...(status.length ? ['```text', ...status, '```'] : ['- Clean working tree']),
    '',
  ].filter((x) => x !== null).join('\n');

  fs.writeFileSync(outFile, md, 'utf8');
  fs.writeFileSync(marker, outFile, 'utf8');
  return outFile;
}

function loadUnusedHandoff(cwd) {
  if (!cwd) return null;
  const dir = handoffDir();
  if (!fs.existsSync(dir)) return null;
  const prefix = `${repoSlug(cwd)}.`;
  const now = Date.now();
  const candidates = fs.readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.md') && !f.endsWith('.used.md'))
    .map((f) => {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      return { full, mtime: stat.mtimeMs };
    })
    .filter((c) => now - c.mtime <= MAX_AGE_MS)
    .sort((a, b) => b.mtime - a.mtime);

  if (!candidates.length) return null;
  const newest = candidates[0];
  const content = fs.readFileSync(newest.full, 'utf8');
  const usedPath = newest.full.replace(/\.md$/, '.used.md');
  try { fs.renameSync(newest.full, usedPath); } catch {}
  return { file: usedPath, content };
}

function runHistoryLearningBridge() {
  const hlCandidates = [
    path.join(os.homedir(), 'agent-skills', 'history-learning', 'scripts', 'hl.mjs'),
    'D:/1 - Projects/Projects/AgentSkills/history-learning/scripts/hl.mjs',
  ];
  const hl = hlCandidates.find((p) => fs.existsSync(p));
  if (!hl) return null;

  const res = spawnSync(process.execPath, [hl, 'hook', 'session-start'], {
    input: JSON.stringify({ source: 'startup' }),
    encoding: 'utf8',
    timeout: 8000,
    windowsHide: true,
  });
  if (res.error || res.status !== 0 || !res.stdout) return null;
  try {
    const parsed = JSON.parse(res.stdout.trim());
    const msg = parsed.systemMessage || (parsed.hookSpecificOutput && parsed.hookSpecificOutput.additionalContext);
    return msg || null;
  } catch {
    return null;
  }
}

module.exports = { saveHandoff, loadUnusedHandoff, repoSlug };

if (require.main === module) {
  const t0 = Date.now();
  let payload = {};
  try {
    const raw = fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, '').trim();
    payload = raw ? JSON.parse(raw) : {};
  } catch {}

  const event = payload.hookEventName || '';
  const cwd = payload.cwd || (payload.workspacePaths && payload.workspacePaths[0]) || '';

  if (event === 'SessionStart') {
    const injectSteps = [];
    try {
      const handoff = loadUnusedHandoff(cwd);
      if (handoff) {
        injectSteps.push({
          systemMessage: {
            systemMessage: `Previous session handoff loaded (${path.basename(handoff.file)}):\n\n${handoff.content}`,
          },
        });
        recordEvent({ feature: 'context-handoff', event, outcome: 'injected', detail: path.basename(handoff.file), repo: cwd, ms: Date.now() - t0 });
      }
    } catch {}

    try {
      if (!process.env.AGY_NO_HL) {
        const hlMsg = runHistoryLearningBridge();
        if (hlMsg) {
          injectSteps.push({ systemMessage: { systemMessage: hlMsg } });
          recordEvent({ feature: 'history-learning', event, outcome: 'injected', detail: 'notice', repo: cwd, ms: Date.now() - t0 });
        } else {
          recordEvent({ feature: 'history-learning', event, outcome: 'fired', detail: 'no-notice', repo: cwd, ms: Date.now() - t0 });
        }
      }
    } catch {}

    process.stdout.write(JSON.stringify(injectSteps.length ? { injectSteps } : {}));
  } else if (event === 'Stop') {
    try {
      const saved = saveHandoff(payload);
      if (saved) {
        recordEvent({ feature: 'context-handoff', event, outcome: 'saved', detail: path.basename(saved), repo: cwd, ms: Date.now() - t0 });
      }
    } catch {}
    process.stdout.write(JSON.stringify({ decision: 'allow' }));
  } else {
    process.stdout.write('{}');
  }
}
