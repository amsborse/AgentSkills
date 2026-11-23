#!/usr/bin/env node
'use strict';

// Antigravity (`agy`) task ETA & Next-Task tracker for the custom statusLine.
// Commands:
//   node agy-eta.js plan <steps> <minutes> [next task...]   start or re-plan task
//   node agy-eta.js step [next task...]                     complete 1 step + optional next task
//   node agy-eta.js next <next task...>                     update the "NEXT ->" label
//   node agy-eta.js done                                    mark task completed
//   node agy-eta.js clear                                   clear current plan
//   node agy-eta.js show                                    print current JSON state
// Optional flag: --session <conversationId> (defaults to active session from AGY_SESSION_STATE / cwd)

const fs = require('fs');
const os = require('os');
const path = require('path');

function etaDir() {
  return process.env.AGY_ETA_DIR || path.join(os.homedir(), '.gemini', 'config', 'cache', 'eta');
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function resolveSessionKey(explicitId) {
  if (explicitId) return explicitId.replace(/[^\w-]/g, '');
  if (process.env.AGY_CONVERSATION_ID) return process.env.AGY_CONVERSATION_ID.replace(/[^\w-]/g, '');
  if (process.env.AGY_SESSION_STATE && fs.existsSync(process.env.AGY_SESSION_STATE)) {
    const st = readJsonSafe(process.env.AGY_SESSION_STATE);
    if (st && st.conversationId) return String(st.conversationId).replace(/[^\w-]/g, '');
  }
  // Fallback: match active session in %TEMP%/agy-sessions by cwd
  const sdir = path.join(os.tmpdir(), 'agy-sessions');
  const cwdNorm = path.resolve(process.cwd()).replace(/[\\/]+$/, '').toLowerCase();
  if (fs.existsSync(sdir)) {
    const matches = [];
    for (const f of fs.readdirSync(sdir)) {
      if (!f.endsWith('.json')) continue;
      const d = readJsonSafe(path.join(sdir, f));
      if (!d || !d.cwd) continue;
      if (path.resolve(d.cwd).replace(/[\\/]+$/, '').toLowerCase() === cwdNorm) matches.push(d);
    }
    matches.sort((a, b) => (b.updatedAt || b.startedAt || 0) - (a.updatedAt || a.startedAt || 0));
    if (matches[0] && matches[0].conversationId) return String(matches[0].conversationId).replace(/[^\w-]/g, '');
  }
  // Workspace-scoped fallback key
  return 'ws-' + path.basename(process.cwd()).replace(/[^\w-]/g, '_').toLowerCase();
}

function etaFile(key) {
  return path.join(etaDir(), `${key}.json`);
}

function writeAtomic(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj), 'utf8');
  fs.renameSync(tmp, file);
}

function runCli(argv) {
  let explicitSession = null;
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === '--session' || argv[i] === '-s') && i + 1 < argv.length) {
      explicitSession = argv[++i];
      continue;
    }
    positional.push(argv[i]);
  }

  const [cmd, ...rest] = positional;
  const key = resolveSessionKey(explicitSession);
  const file = etaFile(key);
  let state = readJsonSafe(file);
  const now = Date.now();

  if (cmd === 'show') {
    console.log(JSON.stringify(state || null));
    return state;
  }
  if (cmd === 'clear') {
    if (fs.existsSync(file)) fs.rmSync(file, { force: true });
    console.log('eta: cleared');
    return null;
  }
  if (cmd === 'plan') {
    const steps = parseInt(rest[0], 10);
    const minutes = parseFloat(rest[1]);
    if (!(steps > 0) || !(minutes > 0)) {
      console.error('usage: agy-eta.js plan <steps> <minutes> [next task]');
      process.exit(1);
    }
    const nextTask = rest.slice(2).join(' ').trim();
    const keep = state && !state.finished;
    state = {
      started: keep ? state.started : now,
      plannedAt: now,
      steps,
      done: keep ? Math.min(state.done, steps) : 0,
      minutes,
      next: nextTask || (keep ? state.next : ''),
      finished: null,
      updated: now,
    };
  } else if (cmd === 'step') {
    if (!state || state.finished) {
      console.error('eta: no active plan; run `agy-eta.js plan <steps> <minutes> [next]` first');
      process.exit(1);
    }
    state.done = Math.min(state.steps, (state.done || 0) + 1);
    const nextTask = rest.join(' ').trim();
    if (nextTask) state.next = nextTask;
    if (state.done >= state.steps) state.finished = now;
    state.updated = now;
  } else if (cmd === 'next') {
    const nextTask = rest.join(' ').trim();
    state = state || { started: now, plannedAt: now, steps: 0, done: 0, minutes: 0, finished: null };
    state.next = nextTask;
    state.finished = null;
    state.updated = now;
  } else if (cmd === 'done') {
    if (!state) {
      state = { started: now, plannedAt: now, steps: 1, done: 1, minutes: 0, next: '', finished: now, updated: now };
    } else {
      state.done = Math.max(state.steps || 1, state.done || 0);
      state.finished = now;
      state.next = '';
      state.updated = now;
    }
  } else {
    console.error('usage: agy-eta.js plan <steps> <minutes> [next] | step [next] | next <task> | done | clear | show');
    process.exit(1);
  }

  writeAtomic(file, state);
  const msg = state.steps
    ? `eta: ${state.done}/${state.steps} steps (~${state.minutes}m)${state.next ? ` | next: ${state.next}` : ''}${state.finished ? ' [done]' : ''}`
    : `eta: next -> ${state.next || '(none)'}`;
  console.log(msg);
  return state;
}

module.exports = { etaDir, etaFile, resolveSessionKey, runCli };

if (require.main === module) {
  runCli(process.argv.slice(2));
}
