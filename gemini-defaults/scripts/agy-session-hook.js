'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { recordEvent } = require('./telemetry.js');

const SESSION_DIR = path.join(os.tmpdir(), 'agy-sessions');
const NOTIFY_SCRIPT = path.join(__dirname, 'agy-notify.ps1');
const MIN_NOTIFY_MS = 6000;

function readStdin() {
  try {
    const raw = fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, '').trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function normPath(p) {
  if (!p || typeof p !== 'string') return '';
  return path.resolve(p).replace(/[\\/]+$/, '').toLowerCase();
}

function isPidAlive(pid) {
  if (!pid || typeof pid !== 'number') return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err && err.code === 'EPERM';
  }
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function writeJsonAtomic(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj), 'utf8');
  fs.renameSync(tmp, file);
}

function findSessionFile(payload) {
  const envState = process.env.AGY_SESSION_STATE;
  if (envState && fs.existsSync(envState)) {
    return envState;
  }

  if (!fs.existsSync(SESSION_DIR)) return null;

  const entries = [];
  for (const name of fs.readdirSync(SESSION_DIR)) {
    if (!name.endsWith('.json')) continue;
    const full = path.join(SESSION_DIR, name);
    const data = readJsonSafe(full);
    if (!data) continue;
    if (!isPidAlive(data.pid)) continue;
    entries.push({ file: full, data });
  }

  if (!entries.length) return null;

  const convId = payload.conversationId || '';
  if (convId) {
    const byConv = entries.find((e) => e.data.conversationId === convId);
    if (byConv) return byConv.file;
  }

  const cwdNorm = normPath(payload.cwd || (payload.workspacePaths && payload.workspacePaths[0]));
  if (cwdNorm) {
    const sameCwd = entries
      .filter((e) => normPath(e.data.cwd) === cwdNorm)
      .sort((a, b) => (b.data.startedAt || 0) - (a.data.startedAt || 0));

    const unclaimed = sameCwd.find((e) => !e.data.conversationId);
    if (unclaimed) return unclaimed.file;
    if (sameCwd.length === 1) return sameCwd[0].file;
  }

  return null;
}

function cleanPromptTitle(text) {
  if (!text || typeof text !== 'string') return '';
  const line = text.replace(/\s+/g, ' ').trim();
  if (!line || line.startsWith('/')) return '';
  return line.length > 30 ? line.slice(0, 29).trimEnd() + '\u2026' : line;
}

function shortToolName(name) {
  if (!name || typeof name !== 'string') return '';
  const map = {
    run_command: 'cmd',
    read_file: 'read',
    edit_file: 'edit',
    write_file: 'write',
    search_web: 'web',
    invoke_subagent: 'agent',
    run_workflow: 'flow',
  };
  return map[name] || name.replace(/_/g, ' ').slice(0, 14);
}

function main() {
  const t0 = Date.now();
  const payload = readStdin();
  const event = payload.hookEventName || '';
  const cwd = payload.cwd || (payload.workspacePaths && payload.workspacePaths[0]) || '';

  try {
    const file = findSessionFile(payload);
    if (file) {
      const state = readJsonSafe(file) || {};

      if (payload.conversationId && !state.conversationId) {
        state.conversationId = payload.conversationId;
      }

      if (event === 'SessionStart') {
        state.status = 'ready';
        state.detail = '';
        recordEvent({ feature: 'session-status', event, outcome: 'fired', detail: state.color || '', repo: cwd, ms: Date.now() - t0 });
      } else if (event === 'PreInvocation') {
        if (state.status !== 'working') {
          state.turnStartedAt = Date.now();
        }
        state.status = 'working';
        state.detail = '';
        if (state.autoTitle && !state.titleLocked && payload.lastUserInput) {
          const derived = cleanPromptTitle(payload.lastUserInput);
          if (derived) {
            state.title = derived;
            state.titleLocked = true;
            recordEvent({ feature: 'auto-title', event, outcome: 'fired', detail: state.color || '', repo: cwd, ms: Date.now() - t0 });
          }
        }
      } else if (event === 'PostToolUse') {
        state.status = 'working';
        state.detail = shortToolName(payload.toolCall && payload.toolCall.name);
      } else if (event === 'Stop') {
        const reason = payload.terminationReason || '';
        const isError = reason === 'ERROR' || Boolean(payload.error);
        const isCanceled = reason === 'USER_CANCELED';
        const turnMs = state.turnStartedAt ? (Date.now() - state.turnStartedAt) : 0;

        if (isError) {
          state.status = 'error';
          state.detail = '';
        } else if (isCanceled) {
          state.status = 'paused';
          state.detail = '';
        } else {
          state.status = 'done';
          state.detail = '';
        }

        recordEvent({
          feature: 'session-status',
          event,
          outcome: isError ? 'error' : (isCanceled ? 'skipped' : 'fired'),
          detail: state.color || '',
          repo: cwd,
          ms: turnMs || (Date.now() - t0),
        });

        const shouldNotify =
          !process.env.AGY_NO_NOTIFY &&
          fs.existsSync(NOTIFY_SCRIPT) &&
          (isError || (!isCanceled && payload.fullyIdle !== false && turnMs >= MIN_NOTIFY_MS));

        if (shouldNotify) {
          const folder = path.basename(cwd || state.cwd || '');
          const args = [
            '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', NOTIFY_SCRIPT,
            '-Status', isError ? 'error' : 'done',
            '-SessionTitle', String(state.title || folder || ''),
            '-Folder', folder,
            '-ColorName', String(state.color || ''),
            '-AccentHex', String(state.accent || ''),
            '-Detail', String(payload.error || '').slice(0, 140),
          ];
          spawn('powershell.exe', args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
          recordEvent({
            feature: 'desktop-notify',
            event,
            outcome: 'notified',
            detail: isError ? 'error' : 'done',
            repo: cwd,
            ms: Date.now() - t0,
          });
        }
      }

      state.updatedAt = Date.now();
      writeJsonAtomic(file, state);
    }
  } catch {
    // Never block or fail agy execution due to status telemetry
  }

  if (event === 'Stop') {
    process.stdout.write(JSON.stringify({ decision: 'allow' }));
  } else {
    process.stdout.write('{}');
  }
}

main();
