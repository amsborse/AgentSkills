#!/usr/bin/env node
'use strict';

// Antigravity (`agy`) Creative 2-Line Mission-Control Status Line
// Reads Antigravity's live JSON payload on stdin and renders:
//   Line 1: [Color Pill] Session Title │ Workspace (branch ●dirty) │ Model·Effort │ CTX bar % │ Quota %
//   Line 2: [Live State + Turn Timer] │ ALIVE duration │ ETA bar + ~left │ NEXT -> task │ Active agents/tasks/queued
// Adapts cleanly to `terminal_width` and runs in <25ms using short-TTL caches.

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ESC = '\x1b[';
const RST = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;

const rgb = (hex) => {
  const h = String(hex || '#38BDF8').replace(/^#/, '');
  if (h.length !== 6) return '56;189;248';
  return `${parseInt(h.slice(0, 2), 16)};${parseInt(h.slice(2, 4), 16)};${parseInt(h.slice(4, 6), 16)}`;
};
const fg = (hex, text) => `${ESC}38;2;${rgb(hex)}m${text}${RST}`;
const pill = (bgHex, fgHex, text) => `${ESC}48;2;${rgb(bgHex)};38;2;${rgb(fgHex)};1m ${text} ${RST}`;
const dim = (text) => `${DIM}${text}${RST}`;
const bold = (text) => `${BOLD}${text}${RST}`;
const visLen = (s) => [...String(s).replace(/\x1b\[[0-9;]*m/g, '')].length;

function truncate(text, max) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (max <= 1) return '';
  if (s.length <= max) return s;
  return s.slice(0, Math.max(1, max - 1)).trimEnd() + '\u2026';
}

function fmtDur(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const remS = s % 60;
  if (m < 60) return remS > 0 && m < 10 ? `${m}m${String(remS).padStart(2, '0')}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h${String(m % 60).padStart(2, '0')}m`;
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function writeJsonSafe(file, obj) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(obj), 'utf8');
  } catch {}
}

function findLiveSession(payload) {
  if (process.env.AGY_SESSION_STATE && fs.existsSync(process.env.AGY_SESSION_STATE)) {
    const s = readJsonSafe(process.env.AGY_SESSION_STATE);
    if (s) return s;
  }
  const sdir = path.join(os.tmpdir(), 'agy-sessions');
  if (!fs.existsSync(sdir)) return null;
  const convId = payload.conversation_id || payload.session_id || '';
  const cwdNorm = payload.cwd ? path.resolve(payload.cwd).replace(/[\\/]+$/, '').toLowerCase() : '';
  const all = [];
  for (const name of fs.readdirSync(sdir)) {
    if (!name.endsWith('.json')) continue;
    const d = readJsonSafe(path.join(sdir, name));
    if (d) all.push(d);
  }
  if (convId) {
    const byConv = all.find((d) => d.conversationId === convId);
    if (byConv) return byConv;
  }
  if (cwdNorm) {
    const byCwd = all
      .filter((d) => d.cwd && path.resolve(d.cwd).replace(/[\\/]+$/, '').toLowerCase() === cwdNorm)
      .sort((a, b) => (b.updatedAt || b.startedAt || 0) - (a.updatedAt || a.startedAt || 0));
    if (byCwd[0]) return byCwd[0];
  }
  return null;
}

function loadSessionClock(convId, state, liveSession, now) {
  const cacheDir = path.join(os.homedir(), '.gemini', 'config', 'cache', 'session-clock');
  const key = (convId || 'default').replace(/[^\w-]/g, '');
  const file = path.join(cacheDir, `${key}.json`);
  const prev = readJsonSafe(file) || {};
  const bornAt = prev.bornAt || (liveSession && liveSession.startedAt) || now;
  const isBusy = state === 'working' || state === 'tool_use' || state === 'reviewing';
  let turnStart = prev.turnStart || null;
  let lastTurnMs = prev.lastTurnMs || 0;

  if (isBusy && !prev.wasBusy) {
    turnStart = now;
  } else if (!isBusy && prev.wasBusy && prev.turnStart) {
    lastTurnMs = Math.max(0, now - prev.turnStart);
    turnStart = null;
  }

  const next = { bornAt, turnStart, lastTurnMs, wasBusy: isBusy, updatedAt: now };
  if (prev.wasBusy !== next.wasBusy || !prev.bornAt || (now - (prev.updatedAt || 0) > 10000)) {
    writeJsonSafe(file, next);
  }
  return next;
}

function getGitInfo(cwd) {
  if (!cwd) return null;
  const key = cwd.replace(/[^A-Za-z0-9]/g, '_').slice(-48);
  const cacheFile = path.join(os.tmpdir(), 'agy-git-cache', `${key}.json`);
  const cached = readJsonSafe(cacheFile);
  if (cached && (Date.now() - cached.at) < 4000) return cached;

  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd, encoding: 'utf8', timeout: 600, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true,
    }).trim();
    if (!branch) return null;
    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd, encoding: 'utf8', timeout: 600, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true,
    }).trim();
    const dirty = status ? status.split(/\r?\n/).filter(Boolean).length : 0;
    const info = { branch, dirty, at: Date.now() };
    writeJsonSafe(cacheFile, info);
    return info;
  } catch {
    return null;
  }
}

function loadEta(convId, cwd) {
  const dir = process.env.AGY_ETA_DIR || path.join(os.homedir(), '.gemini', 'config', 'cache', 'eta');
  const keys = [];
  if (convId) keys.push(String(convId).replace(/[^\w-]/g, ''));
  if (cwd) keys.push('ws-' + path.basename(cwd).replace(/[^\w-]/g, '_').toLowerCase());
  for (const k of keys) {
    const f = path.join(dir, `${k}.json`);
    const data = readJsonSafe(f);
    if (data) return data;
  }
  return null;
}

function progressBar(pct, width = 8, colorHex = '#38BDF8') {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * width);
  const full = '\u2588'.repeat(filled);
  const empty = '\u2591'.repeat(width - filled);
  return `${fg(colorHex, full)}${dim(empty)}`;
}

function compactModel(model) {
  if (!model) return '';
  let name = String(model.display_name || model.id || '').trim();
  name = name.replace(/^Gemini\s+/i, 'G');
  return name;
}

function lowestQuota(quota) {
  if (!quota || typeof quota !== 'object') return null;
  let minFrac = null;
  let resetSec = null;
  for (const bucket of Object.values(quota)) {
    if (!bucket || bucket.disabled) continue;
    if (typeof bucket.remaining_fraction === 'number') {
      if (minFrac === null || bucket.remaining_fraction < minFrac) {
        minFrac = bucket.remaining_fraction;
        resetSec = bucket.reset_in_seconds;
      }
    }
  }
  if (minFrac === null) return null;
  return { pct: Math.round(minFrac * 100), resetSec };
}

function joinToWidth(segments, maxWidth, sep = ` ${dim('\u2502')} `) {
  const out = [];
  let len = 0;
  const sepLen = visLen(sep);
  for (const seg of segments) {
    if (!seg) continue;
    const sLen = visLen(seg);
    const needed = out.length ? sepLen + sLen : sLen;
    if (len + needed <= maxWidth) {
      out.push(seg);
      len += needed;
    }
  }
  return out.join(sep);
}

function renderStatusLine(payload, now = Date.now()) {
  const width = Math.max(60, Number(payload.terminal_width) || Number(process.env.COLUMNS) || 110);
  const cwd = (payload.workspace && payload.workspace.current_dir) || payload.cwd || '';
  const folder = cwd ? path.basename(cwd) : '';
  const convId = payload.conversation_id || payload.session_id || '';
  const live = findLiveSession(payload);
  const accent = process.env.AGY_SESSION_ACCENT || (live && live.accent) || '#38BDF8';
  const colorName = (process.env.AGY_SESSION_COLOR || (live && live.color) || 'AGY').toUpperCase();
  const title = payload.conversation_title || process.env.AGY_SESSION_TITLE || (live && live.title) || folder || 'New Session';
  const state = payload.tool_confirmation_pending ? 'reviewing' : (payload.agent_state || 'idle');

  const clock = loadSessionClock(convId, state, live, now);
  const git = payload.vcs ? getGitInfo(cwd) : (cwd ? getGitInfo(cwd) : null);
  const eta = loadEta(convId, cwd);

  // --- LINE 1: Identity, Title, Repo/Branch, Model, Context Bar, Quota ---
  const badge = pill(accent, '#0B0F17', colorName);
  const titleMax = width >= 115 ? 34 : (width >= 90 ? 24 : 18);
  const titleSeg = `${badge} ${bold(fg('#EEF2F8', truncate(title, titleMax)))}`;

  let repoSeg = '';
  if (folder) {
    const branchTxt = git
      ? ` ${dim('(')}${fg('#93C5FD', truncate(git.branch, 18))}${git.dirty ? ` ${fg('#FBBF24', `\u25CF${git.dirty}`)}` : ''}${dim(')')}`
      : '';
    repoSeg = `${fg('#CBD5E1', truncate(folder, 18))}${branchTxt}`;
  }

  let modelSeg = '';
  const mName = compactModel(payload.model);
  if (mName) {
    const modeTag = payload.cycle_mode ? ` ${pill('#1E293B', '#38BDF8', payload.cycle_mode.toUpperCase())}` : '';
    modelSeg = `${fg('#C4B5FD', truncate(mName, 24))}${modeTag}`;
  }

  let ctxSeg = '';
  const ctx = payload.context_window;
  if (ctx && typeof ctx.used_percentage === 'number') {
    const pct = Math.round(ctx.used_percentage);
    const barColor = pct >= 80 ? '#FB7185' : (pct >= 50 ? '#FBBF24' : '#34D399');
    const barW = width >= 105 ? 8 : 5;
    ctxSeg = `${dim('CTX')} ${progressBar(pct, barW, barColor)} ${fg(barColor, `${pct}%`)}`;
  }

  let quotaSeg = '';
  const q = lowestQuota(payload.quota);
  if (q) {
    const qColor = q.pct <= 15 ? '#FB7185' : (q.pct <= 35 ? '#FBBF24' : '#34D399');
    quotaSeg = `${dim('Q')} ${fg(qColor, `${q.pct}%`)}`;
  }

  const line1 = joinToWidth([titleSeg, repoSeg, modelSeg, ctxSeg, quotaSeg], width);

  // --- LINE 2: Live Pulse, Time Alive, ETA + Progress, Next Task, Agents/Tasks ---
  let stateSeg;
  const turnElapsed = clock.turnStart ? fmtDur(now - clock.turnStart) : '';
  if (state === 'reviewing') {
    stateSeg = pill('#F59E0B', '#0B0F17', '\u26A0 NEEDS APPROVAL');
  } else if (state === 'error') {
    stateSeg = pill('#F43F5E', '#FFFFFF', '\u2716 ERROR');
  } else if (state === 'tool_use') {
    stateSeg = `${fg('#22D3EE', `\u26A1 TOOL${turnElapsed ? ' ' + turnElapsed : ''}`)}`;
  } else if (state === 'working') {
    stateSeg = `${fg(accent, `\u27F3 WORKING${turnElapsed ? ' ' + turnElapsed : ''}`)}`;
  } else if (state === 'initializing' || state === 'authenticating') {
    stateSeg = `${fg('#A78BFA', `\u25CC ${state.toUpperCase()}`)}`;
  } else {
    const lastTxt = clock.lastTurnMs >= 1000 ? ` ${dim(`(${fmtDur(clock.lastTurnMs)})`)}` : '';
    stateSeg = `${fg('#34D399', '\u2713 READY')}${lastTxt}`;
  }

  const aliveSeg = `${dim('ALIVE')} ${fg('#E2E8F0', fmtDur(now - clock.bornAt))}`;

  let etaSeg = '';
  let nextSeg = '';
  if (eta) {
    if (eta.finished) {
      etaSeg = `${fg('#34D399', `\u2713 ETA done in ${fmtDur(eta.finished - eta.started)}`)}`;
    } else if (eta.steps > 0) {
      const pct = Math.round(((eta.done || 0) / eta.steps) * 100);
      const elapsed = now - (eta.started || now);
      let leftMs;
      if ((eta.done || 0) > 0) leftMs = (elapsed / eta.done) * (eta.steps - eta.done);
      else leftMs = (eta.minutes || 0) * 60000 - (now - (eta.plannedAt || now));
      const leftTxt = leftMs > 0 ? `~${fmtDur(leftMs)} left` : 'over est';
      const etaColor = leftMs > 0 ? '#38BDF8' : '#FBBF24';
      etaSeg = `${dim('ETA')} ${progressBar(pct, 5, etaColor)} ${fg(etaColor, `${eta.done || 0}/${eta.steps}`)} ${dim(leftTxt)}`;
    }
    if (eta.next && !eta.finished) {
      const nextMax = width >= 115 ? 36 : (width >= 90 ? 24 : 16);
      nextSeg = `${dim('NEXT \u2192')} ${fg('#F8FAFC', truncate(eta.next, nextMax))}`;
    }
  } else if (payload.pending_input_count > 0) {
    nextSeg = `${fg('#FBBF24', `QUEUED \u2192 ${payload.pending_input_count} msg`)}`;
  }

  const extras = [];
  const runningSubs = Array.isArray(payload.subagents) ? payload.subagents.filter((s) => s.status === 'running').length : 0;
  if (runningSubs > 0) extras.push(fg('#A78BFA', `${runningSubs} subagent${runningSubs > 1 ? 's' : ''}`));
  if (payload.task_count > 0) extras.push(fg('#22D3EE', `${payload.task_count} bg task${payload.task_count > 1 ? 's' : ''}`));
  if (payload.artifact_count > 0) extras.push(dim(`${payload.artifact_count} art`));
  if (payload.cost && typeof payload.cost.total_usd === 'number' && payload.cost.total_usd > 0) {
    extras.push(dim(`$${payload.cost.total_usd.toFixed(2)}`));
  }
  const extraSeg = extras.join(dim(' · '));

  const line2 = joinToWidth([stateSeg, aliveSeg, etaSeg, nextSeg, extraSeg], width);
  return `${line1}\n${line2}`;
}

module.exports = { renderStatusLine, fmtDur, progressBar, lowestQuota };

if (require.main === module) {
  let payload = {};
  try {
    const raw = fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, '').trim();
    payload = raw ? JSON.parse(raw) : {};
  } catch {}
  process.stdout.write(renderStatusLine(payload) + '\n');
}
