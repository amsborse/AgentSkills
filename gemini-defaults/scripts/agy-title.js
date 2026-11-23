#!/usr/bin/env node
'use strict';

// Antigravity (`agy`) Native Terminal Title Script
// Outputs a single clean plain-text line (no ANSI codes) for Windows Terminal tabs:
//   <ColorDot> <State> · <Session Title> (<Alive / ETA>)

const fs = require('fs');
const os = require('os');
const path = require('path');

const COLOR_DOTS = {
  Mint: '\u{1F7E2}',
  Sky: '\u{1F535}',
  Lilac: '\u{1F7E3}',
  Gold: '\u{1F7E1}',
  Peach: '\u{1F7E0}',
  Rose: '\u{1F534}',
  Aqua: '\u{1FA75}',
  Lime: '\u{1F7E9}',
};

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function fmtShortDur(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`;
}

function findLiveSession(payload) {
  if (process.env.AGY_SESSION_STATE && fs.existsSync(process.env.AGY_SESSION_STATE)) {
    const d = readJsonSafe(process.env.AGY_SESSION_STATE);
    if (d) return d;
  }
  const sdir = path.join(os.tmpdir(), 'agy-sessions');
  if (!fs.existsSync(sdir)) return null;
  const convId = payload.conversation_id || payload.session_id || '';
  const cwdNorm = payload.cwd ? path.resolve(payload.cwd).replace(/[\\/]+$/, '').toLowerCase() : '';
  const list = [];
  for (const f of fs.readdirSync(sdir)) {
    if (!f.endsWith('.json')) continue;
    const d = readJsonSafe(path.join(sdir, f));
    if (d) list.push(d);
  }
  if (convId) {
    const hit = list.find((d) => d.conversationId === convId);
    if (hit) return hit;
  }
  if (cwdNorm) {
    const hits = list
      .filter((d) => d.cwd && path.resolve(d.cwd).replace(/[\\/]+$/, '').toLowerCase() === cwdNorm)
      .sort((a, b) => (b.updatedAt || b.startedAt || 0) - (a.updatedAt || a.startedAt || 0));
    if (hits[0]) return hits[0];
  }
  return null;
}

function renderTitle(payload, now = Date.now()) {
  const cwd = (payload.workspace && payload.workspace.current_dir) || payload.cwd || '';
  const folder = cwd ? path.basename(cwd) : 'AGY';
  const live = findLiveSession(payload);
  const colorName = process.env.AGY_SESSION_COLOR || (live && live.color) || '';
  const dot = COLOR_DOTS[colorName] || '\u2728';

  const rawTitle = payload.conversation_title || process.env.AGY_SESSION_TITLE || (live && live.title) || folder;
  const cleanTitle = String(rawTitle).replace(/\s+/g, ' ').trim();
  const shortTitle = cleanTitle.length > 28 ? cleanTitle.slice(0, 27).trimEnd() + '\u2026' : cleanTitle;

  const state = payload.tool_confirmation_pending ? 'reviewing' : (payload.agent_state || 'idle');
  let stateLabel = '\u2713 Ready';
  if (state === 'reviewing') stateLabel = '\u26A0 Approve';
  else if (state === 'error') stateLabel = '\u2716 Error';
  else if (state === 'tool_use') stateLabel = '\u26A1 Tool';
  else if (state === 'working') stateLabel = '\u27F3 Working';
  else if (state === 'initializing' || state === 'authenticating') stateLabel = '\u25CC Starting';

  let suffix = '';
  const convId = (payload.conversation_id || payload.session_id || '').replace(/[^\w-]/g, '');
  if (convId) {
    const clock = readJsonSafe(path.join(os.homedir(), '.gemini', 'config', 'cache', 'session-clock', `${convId}.json`));
    if (clock && clock.bornAt) {
      suffix = ` · ${fmtShortDur(now - clock.bornAt)}`;
    }
  }

  return `${dot} ${stateLabel} · ${shortTitle}${suffix}`;
}

module.exports = { renderTitle };

if (require.main === module) {
  let payload = {};
  try {
    const raw = fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, '').trim();
    payload = raw ? JSON.parse(raw) : {};
  } catch {}
  process.stdout.write(renderTitle(payload) + '\n');
}
