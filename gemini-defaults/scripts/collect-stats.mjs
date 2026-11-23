#!/usr/bin/env node
// Collects REAL usage and effectiveness data for installed Gemini/Antigravity & unified
// terminal features—zero fabricated metrics—and writes:
//   1. gemini-defaults/dashboard/data.json
//   2. Injects the snapshot into gemini-defaults/dashboard/index.html (works via file://)
// Optionally serves live auto-refreshing data on http://127.0.0.1:4789 with --serve.

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DASH_DIR = path.join(ROOT, 'dashboard');
const HTML_FILE = path.join(DASH_DIR, 'index.html');
const LOCAL_HTML_FILE = path.join(DASH_DIR, 'local.html');
const DATA_FILE = path.join(DASH_DIR, 'data.json');

function readJsonSafe(file, fallback = null) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return fallback;
  }
}

function readJsonlSafe(file) {
  try {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8')
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isPidAlive(pid) {
  if (!pid || typeof pid !== 'number') return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e && e.code === 'EPERM'; }
}

function scanLiveSessions(tmpDir) {
  const sessions = [];
  for (const [kind, sub] of [['agy', 'agy-sessions'], ['claude', 'claude-sessions']]) {
    const dir = path.join(tmpDir, sub);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      const d = readJsonSafe(path.join(dir, name));
      if (!d || !isPidAlive(d.pid)) continue;
      sessions.push({
        agent: kind,
        pid: d.pid,
        color: d.color || 'Default',
        accent: d.accent || '#38BDF8',
        status: d.status || 'ready',
        detail: d.detail || '',
        title: d.title || path.basename(d.cwd || ''),
        repo: path.basename(d.cwd || ''),
        startedAt: d.startedAt || null,
        updatedAt: d.updatedAt || null,
      });
    }
  }
  return sessions.sort((a, b) => (b.updatedAt || b.startedAt || 0) - (a.updatedAt || a.startedAt || 0));
}

function findPsDir(home) {
  for (const d of [
    path.join(home, 'OneDrive', 'Documents', 'WindowsPowerShell'),
    path.join(home, 'Documents', 'WindowsPowerShell'),
  ]) {
    if (fs.existsSync(d)) return d;
  }
  return null;
}

function findWtSettings(env) {
  if (!env.LOCALAPPDATA) return null;
  const pkgs = path.join(env.LOCALAPPDATA, 'Packages');
  if (!fs.existsSync(pkgs)) return null;
  for (const name of fs.readdirSync(pkgs)) {
    if (name.startsWith('Microsoft.WindowsTerminal')) {
      const f = path.join(pkgs, name, 'LocalState', 'settings.json');
      if (fs.existsSync(f)) return f;
    }
  }
  return null;
}

export function collectStats(opts = {}) {
  const home = opts.home || os.homedir();
  const env = opts.env || process.env;
  const tmpDir = opts.tmpDir || os.tmpdir();
  const geminiCfg = path.join(home, '.gemini', 'config');
  const scriptsDir = path.join(geminiCfg, 'scripts');
  const telDir = path.join(geminiCfg, 'telemetry');
  const psDir = opts.psDir !== undefined ? opts.psDir : findPsDir(home);
  const wtFile = opts.wtFile !== undefined ? opts.wtFile : findWtSettings(env);

  const installMeta = readJsonSafe(path.join(telDir, 'installed.json'), {});
  const installedAt = installMeta.installedAt || null;
  const installedMs = installedAt ? Date.parse(installedAt) : 0;

  const events = readJsonlSafe(path.join(telDir, 'events.jsonl'));
  const liveSessions = scanLiveSessions(tmpDir);

  // Real Antigravity CLI history (last 24h + since install)
  const history = readJsonlSafe(path.join(home, '.gemini', 'antigravity-cli', 'history.jsonl'));
  const dayCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const cutoffMs = installedMs ? Math.min(installedMs, dayCutoff) : dayCutoff;
  const recentHistory = history.filter((h) => (h.timestamp || 0) >= cutoffMs);
  const byWorkspace = {};
  const uniqueConvs = new Set();
  for (const h of recentHistory) {
    const ws = h.workspace ? path.basename(h.workspace) : 'global';
    byWorkspace[ws] = (byWorkspace[ws] || 0) + 1;
    if (h.conversationId) uniqueConvs.add(h.conversationId);
  }

  // Real handoff files on disk
  const handoffPath = path.join(geminiCfg, 'handoffs');
  let handoffFiles = [];
  if (fs.existsSync(handoffPath)) {
    handoffFiles = fs.readdirSync(handoffPath).filter((f) => f.endsWith('.md'));
  }
  const handoffsUsed = handoffFiles.filter((f) => f.endsWith('.used.md')).length;
  const handoffsPending = handoffFiles.length - handoffsUsed;

  // Real skills & MCP counts
  const skillsDir = path.join(home, '.agents', 'skills');
  const skillCount = fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir).filter((f) => !f.startsWith('.')).length : 0;
  const mcpCfg = readJsonSafe(path.join(geminiCfg, 'mcp_config.json'), {});
  const mcpServers = Object.keys(mcpCfg.mcpServers || {});

  // Check WT profile presence
  const wtObj = wtFile ? readJsonSafe(wtFile, {}) : {};
  const hasWtProfile = Array.isArray(wtObj?.profiles?.list) && wtObj.profiles.list.some((p) => p?.name === 'Antigravity (AGY)');

  // Check ntfy opt-in status
  const ntfyCfg = readJsonSafe(path.join(geminiCfg, 'ntfy.json'), {});
  const hasNtfy = Boolean(env.AGY_NTFY_TOPIC || ntfyCfg?.topic);

  // Check hooks.json & CLI settings presence
  const hooksCfg = readJsonSafe(path.join(geminiCfg, 'hooks.json'), {});
  const cliSettings = readJsonSafe(path.join(home, '.gemini', 'antigravity-cli', 'settings.json'), {});
  const hasNativeStatus = Boolean(cliSettings?.statusLine?.enabled !== false && cliSettings?.statusLine?.command);
  const hasNativeTitle = Boolean(cliSettings?.title?.enabled !== false && cliSettings?.title?.command);
  const etaDir = path.join(geminiCfg, 'cache', 'eta');
  const etaCount = fs.existsSync(etaDir) ? fs.readdirSync(etaDir).filter((f) => f.endsWith('.json')).length : 0;

  // Aggregate telemetry per feature key
  const byFeature = {};
  for (const ev of events) {
    const key = ev.feature || 'unknown';
    if (!byFeature[key]) {
      byFeature[key] = { total: 0, blocked: 0, allowed: 0, formatted: 0, notified: 0, saved: 0, injected: 0, fired: 0, errors: 0, lastAt: null, avgMs: null, _msSum: 0, _msCount: 0 };
    }
    const f = byFeature[key];
    f.total++;
    if (ev.outcome === 'blocked') f.blocked++;
    else if (ev.outcome === 'allowed') f.allowed++;
    else if (ev.outcome === 'formatted') f.formatted++;
    else if (ev.outcome === 'notified') f.notified++;
    else if (ev.outcome === 'saved') f.saved++;
    else if (ev.outcome === 'injected') f.injected++;
    else if (ev.outcome === 'error') f.errors++;
    else f.fired++;
    if (!f.lastAt || ev.ts > f.lastAt) f.lastAt = ev.ts;
    if (typeof ev.ms === 'number') { f._msSum += ev.ms; f._msCount++; }
  }
  for (const f of Object.values(byFeature)) {
    f.avgMs = f._msCount ? Math.round(f._msSum / f._msCount) : null;
    delete f._msSum;
    delete f._msCount;
  }

  function sumFeatures(keys) {
    const acc = { total: 0, blocked: 0, allowed: 0, formatted: 0, notified: 0, saved: 0, injected: 0, fired: 0, errors: 0, lastAt: null, avgMs: null };
    let msSum = 0, msN = 0;
    for (const k of keys) {
      const f = byFeature[k];
      if (!f) continue;
      for (const field of ['total', 'blocked', 'allowed', 'formatted', 'notified', 'saved', 'injected', 'fired', 'errors']) acc[field] += f[field];
      if (f.lastAt && (!acc.lastAt || f.lastAt > acc.lastAt)) acc.lastAt = f.lastAt;
      if (f.avgMs !== null) { msSum += f.avgMs * f.total; msN += f.total; }
    }
    acc.avgMs = msN ? Math.round(msSum / msN) : null;
    return acc;
  }

  const guardAll = sumFeatures(['pretool-guard', 'ps5-chain-operator', 'batch-email-guard', 'secrets-env-read', 'secrets-cred-read', 'prod-deploy-guard', 'destructive-git-reset', 'destructive-git-clean', 'destructive-force-push', 'destructive-rm-root']);
  const ps5Stats = sumFeatures(['ps5-chain-operator']);
  const secretProdStats = sumFeatures(['secrets-env-read', 'secrets-cred-read', 'prod-deploy-guard', 'batch-email-guard']);
  const gitSafetyStats = sumFeatures(['destructive-git-reset', 'destructive-git-clean', 'destructive-force-push', 'destructive-rm-root']);
  const formatStats = sumFeatures(['auto-format']);
  const sessionStats = sumFeatures(['session-status']);
  const titleStats = sumFeatures(['auto-title']);
  const notifyStats = sumFeatures(['desktop-notify']);
  const ntfyStats = sumFeatures(['ntfy-push']);
  const handoffStats = sumFeatures(['context-handoff']);
  const hlStats = sumFeatures(['history-learning']);

  const verdict = (active, count, optIn = false) => {
    if (optIn && !active) return 'opt-in';
    if (!active) return 'inactive';
    if (count >= 3) return 'proven';
    if (count >= 1) return 'active';
    return 'collecting';
  };

  const features = [
    {
      id: 'native-statusline-title',
      name: 'Mission-Control Status Line, ETA & Native Title',
      category: 'Terminal UX',
      status: hasNativeStatus && hasNativeTitle ? 'active' : 'missing',
      summary: 'Creative 2-line native agy status bar + tab title showing distinct color pill, AI conversation title, git branch/dirty count, context & quota bars, live turn timer, time alive, ETA progress bar, and NEXT task.',
      why: 'Gives full cockpit awareness (what this session is doing, how long it has been alive, time left, and what comes next) natively inside agy without fighting the TUI.',
      files: ['~/.gemini/antigravity-cli/settings.json', '~/.gemini/config/scripts/agy-statusline.js', '~/.gemini/config/scripts/agy-title.js', '~/.gemini/config/scripts/agy-eta.js'],
      triggerHint: 'Runs automatically on every agy state update; track multi-step ETA with `node ~/.gemini/config/scripts/agy-eta.js plan <steps> <mins> "<next>"`.',
      metricLabel: `${hasNativeStatus ? 'statusLine ON' : 'OFF'} · ${hasNativeTitle ? 'title ON' : 'OFF'} · ${etaCount} ETA plan(s)`,
      evidenceCount: (hasNativeStatus ? 1 : 0) + etaCount + liveSessions.length,
      lastAt: installedAt,
      verdict: verdict(hasNativeStatus && hasNativeTitle, (hasNativeStatus ? 1 : 0) + etaCount + liveSessions.length),
    },
    {
      id: 'session-colors-status',
      name: 'Distinct Session Colors & Live Tab Status',
      category: 'Terminal UX',
      status: psDir && fs.existsSync(path.join(psDir, 'agy-colors.ps1')) ? 'active' : 'missing',
      summary: 'Assigns every open agy & Claude tab a collision-free text/cursor color, auto-title, and live Ready/Working/Done/Error tab status with Windows Terminal spinner.',
      why: 'Prevents mixing up parallel agent tabs and shows at a glance which session is busy vs waiting on you without clicking into each tab.',
      files: ['~/.gemini/config/scripts/agy-session-hook.js', 'WindowsPowerShell/agy-colors.ps1', 'WindowsPowerShell/claude-colors.ps1'],
      triggerHint: 'Runs automatically on every interactive `agy`, `agyn`, or `claude` session.',
      metricLabel: `${liveSessions.length} live now · ${sessionStats.total} hook events · ${titleStats.total} auto-titles`,
      evidenceCount: liveSessions.length + sessionStats.total + titleStats.total,
      lastAt: sessionStats.lastAt || (liveSessions[0]?.updatedAt ? new Date(liveSessions[0].updatedAt).toISOString() : null),
      verdict: verdict(Boolean(psDir && fs.existsSync(path.join(psDir, 'agy-colors.ps1'))), liveSessions.length + sessionStats.total),
    },
    {
      id: 'wt-profile',
      name: 'Windows Terminal AGY Profile & Hotkeys',
      category: 'Terminal UX',
      status: hasWtProfile ? 'active' : 'missing',
      summary: 'Adds a dedicated Antigravity (AGY) profile with Ctrl+Alt+A (new tab) and Ctrl+Shift+Alt+A (split pane), matching your Claude Code shortcuts.',
      why: 'Launch or split a fresh agy session from anywhere in Windows Terminal in one chord.',
      files: ['WindowsTerminal/LocalState/settings.json'],
      triggerHint: 'Press Ctrl+Alt+A for a new tab or Ctrl+Shift+Alt+A for a side-by-side split.',
      metricLabel: hasWtProfile ? 'Installed & bound (Ctrl+Alt+A)' : 'Not found in WT settings',
      evidenceCount: hasWtProfile ? liveSessions.filter((s) => s.agent === 'agy').length : 0,
      lastAt: liveSessions[0]?.startedAt ? new Date(liveSessions[0].startedAt).toISOString() : null,
      verdict: verdict(hasWtProfile, liveSessions.filter((s) => s.agent === 'agy').length),
    },
    {
      id: 'concise-default',
      name: 'Concise 1–2 Line Default Rule',
      category: 'Memory & Context',
      status: fs.existsSync(path.join(geminiCfg, 'GEMINI.md')) ? 'active' : 'missing',
      summary: 'Global always-on rule in GEMINI.md keeping replies direct and 1–2 lines unless you explicitly ask for deeper detail.',
      why: 'Cuts reading fatigue and token burn on routine questions while still allowing full detail when requested.',
      files: ['~/.gemini/config/GEMINI.md', '~/.gemini/config/AGENTS.md'],
      triggerHint: 'Loaded on every turn across all workspaces.',
      metricLabel: `${recentHistory.length} prompt(s) across ${uniqueConvs.size} conversation(s) since install`,
      evidenceCount: recentHistory.length,
      lastAt: recentHistory.length ? new Date(Math.max(...recentHistory.map((h) => h.timestamp || 0))).toISOString() : null,
      verdict: verdict(fs.existsSync(path.join(geminiCfg, 'GEMINI.md')), recentHistory.length),
    },
    {
      id: 'ps5-guard',
      name: 'PowerShell 5.1 Chain-Operator Guard',
      category: 'Safety Guardrails',
      status: hooksCfg['agy-pretool-guard'] && fs.existsSync(path.join(scriptsDir, 'agy-pretool-guard.js')) ? 'active' : 'missing',
      summary: 'Intercepts invalid `&&` and `||` operators before Windows PowerShell 5.1 crashes on them, while ignoring quoted strings and here-strings.',
      why: 'Eliminates wasted failed shell turns and teaches the agent to emit valid `; if ($?) { ... }` syntax immediately.',
      files: ['~/.gemini/config/scripts/agy-pretool-guard.js'],
      triggerHint: 'Fires on every `run_command` PreToolUse.',
      metricLabel: `${ps5Stats.blocked} blocked · ${guardAll.allowed} allowed (${guardAll.avgMs ?? '—'}ms avg)`,
      evidenceCount: ps5Stats.blocked + guardAll.allowed,
      lastAt: ps5Stats.lastAt || guardAll.lastAt,
      verdict: verdict(Boolean(hooksCfg['agy-pretool-guard']), ps5Stats.blocked + guardAll.allowed),
    },
    {
      id: 'secrets-prod-guard',
      name: 'Secrets, Batch-Email & Prod Deploy Guard',
      category: 'Safety Guardrails',
      status: hooksCfg['agy-pretool-guard'] ? 'active' : 'missing',
      summary: 'Blocks shell reads of `.env`/SSH keys/credential JSONs, bulk Manthan email sends (`deliver`/`rerun`/`--resend`), and unapproved prod deploys (`deploy.sh`, `wrangler deploy`, `vercel --prod`).',
      why: 'Hard deterministic boundary—never relies on LLM willpower to protect secrets, email lists, or production infrastructure.',
      files: ['~/.gemini/config/scripts/agy-pretool-guard.js'],
      triggerHint: 'Fires on every `run_command` PreToolUse; logs rule ID only (never command text or secrets).',
      metricLabel: `${secretProdStats.blocked} dangerous command(s) blocked`,
      evidenceCount: secretProdStats.blocked,
      lastAt: secretProdStats.lastAt,
      verdict: verdict(Boolean(hooksCfg['agy-pretool-guard']), secretProdStats.blocked),
    },
    {
      id: 'git-safety-guard',
      name: 'Destructive Git & Root-Delete Guard',
      category: 'Safety Guardrails',
      status: hooksCfg['agy-pretool-guard'] ? 'active' : 'missing',
      summary: 'Blocks `git reset --hard`, `git clean -fd`, force-pushing to `main`/`master`, and recursive deletes on drive roots or `$HOME`.',
      why: 'Protects uncommitted edits across parallel agent sessions from accidental wipeouts.',
      files: ['~/.gemini/config/scripts/agy-pretool-guard.js'],
      triggerHint: 'Fires automatically on every `run_command` PreToolUse.',
      metricLabel: `${gitSafetyStats.blocked} destructive command(s) blocked`,
      evidenceCount: gitSafetyStats.blocked,
      lastAt: gitSafetyStats.lastAt,
      verdict: verdict(Boolean(hooksCfg['agy-pretool-guard']), gitSafetyStats.blocked),
    },
    {
      id: 'auto-format',
      name: 'Post-Edit Auto-Formatter (Prettier + Ruff)',
      category: 'Automation',
      status: hooksCfg['agy-auto-format'] && fs.existsSync(path.join(scriptsDir, 'agy-format.js')) ? 'active' : 'missing',
      summary: 'Silently formats edited JS/TS/JSON/CSS/MD files with the project-local Prettier and Python files with `ruff` right after `edit_file`/`write_file`.',
      why: 'Keeps diffs clean with zero token cost and zero extra agent turns spent running formatters.',
      files: ['~/.gemini/config/scripts/agy-format.js'],
      triggerHint: 'Fires after every `edit_file` or `write_file` in projects with Prettier or `ruff`.',
      metricLabel: `${formatStats.formatted} file(s) formatted (${formatStats.avgMs ?? '—'}ms avg)`,
      evidenceCount: formatStats.formatted,
      lastAt: formatStats.lastAt,
      verdict: verdict(Boolean(hooksCfg['agy-auto-format']), formatStats.formatted),
    },
    {
      id: 'desktop-notify',
      name: 'Colored Desktop Toast & Sound Alerts',
      category: 'Notifications',
      status: fs.existsSync(path.join(scriptsDir, 'agy-notify.ps1')) ? 'active' : 'missing',
      summary: 'Shows a persistent Windows toast with a matching colored session badge and plays your finish/error sound when a multi-step turn goes idle or errors.',
      why: 'Lets you context-switch freely during long agent runs and immediately know WHICH colored tab finished or failed.',
      files: ['~/.gemini/config/scripts/agy-notify.ps1', '~/.gemini/config/scripts/agy-session-hook.js'],
      triggerHint: 'Fires detached (0ms hook lag) on Stop when a turn takes >=6s or errors.',
      metricLabel: `${notifyStats.notified} alert(s) sent`,
      evidenceCount: notifyStats.notified,
      lastAt: notifyStats.lastAt,
      verdict: verdict(fs.existsSync(path.join(scriptsDir, 'agy-notify.ps1')), notifyStats.notified),
    },
    {
      id: 'ntfy-push',
      name: 'Mobile / Remote Push Pings (ntfy.sh)',
      category: 'Notifications',
      status: hasNtfy ? 'active' : 'opt-in',
      summary: 'Optional mobile push notification via ntfy.sh whenever a long unattended run completes or hits an error.',
      why: 'Walk away from your desk during long tasks and get pinged on your phone the second input is needed.',
      files: ['~/.gemini/config/scripts/agy-notify.ps1', '~/.gemini/config/ntfy.json'],
      triggerHint: 'Enable by setting `$env:AGY_NTFY_TOPIC` or writing `{"topic":"your-secret-topic"}` in `~/.gemini/config/ntfy.json`.',
      metricLabel: hasNtfy ? `${ntfyStats.notified} push(es) sent` : 'Opt-in (set topic in ntfy.json to enable)',
      evidenceCount: ntfyStats.notified,
      lastAt: ntfyStats.lastAt,
      verdict: verdict(hasNtfy, ntfyStats.notified, true),
    },
    {
      id: 'context-handoff',
      name: 'Context-Watch & Auto Session Handoff',
      category: 'Memory & Context',
      status: hooksCfg['agy-context-handoff'] && fs.existsSync(path.join(scriptsDir, 'agy-handoff.js')) ? 'active' : 'missing',
      summary: 'Automatically saves a repo handoff snapshot (git branch, dirty files, last prompts) when a session grows large (>=80 steps or 350 KB) and injects it once into your next fresh session.',
      why: 'Makes starting a clean session effortless when context gets heavy instead of suffering degraded compaction.',
      files: ['~/.gemini/config/scripts/agy-handoff.js', '~/.gemini/config/handoffs/'],
      triggerHint: 'Saves on Stop when threshold is crossed; loads once on next SessionStart (<3 days old).',
      metricLabel: `${handoffStats.saved + handoffsPending + handoffsUsed} saved · ${handoffStats.injected + handoffsUsed} loaded`,
      evidenceCount: handoffStats.saved + handoffStats.injected + handoffFiles.length,
      lastAt: handoffStats.lastAt,
      verdict: verdict(Boolean(hooksCfg['agy-context-handoff']), handoffStats.saved + handoffStats.injected + handoffFiles.length),
    },
    {
      id: 'history-learning',
      name: 'History-Learning Session Bridge',
      category: 'Memory & Context',
      status: hooksCfg['agy-context-handoff'] && fs.existsSync(path.join(home, 'agent-skills', 'history-learning', 'scripts', 'hl.mjs')) ? 'active' : 'missing',
      summary: 'Bridges your AgentSkills `hl.mjs` session-start hook into Antigravity so pending preference clusters and taste statements surface in Gemini sessions too.',
      why: 'Keeps your cross-agent learning loop active whether you start your day in Claude Code or Antigravity.',
      files: ['~/.gemini/config/scripts/agy-handoff.js', '~/agent-skills/history-learning/scripts/hl.mjs'],
      triggerHint: 'Runs on SessionStart and injects a notice only when new clusters are ready for review.',
      metricLabel: `${hlStats.fired + hlStats.injected} check(s) · ${hlStats.injected} notice(s)`,
      evidenceCount: hlStats.fired + hlStats.injected,
      lastAt: hlStats.lastAt,
      verdict: verdict(Boolean(hooksCfg['agy-context-handoff']), hlStats.fired + hlStats.injected),
    },
    {
      id: 'shared-skills-mcp',
      name: 'Shared Skills Library & MCP Servers',
      category: 'Automation',
      status: skillCount > 0 && mcpServers.length > 0 ? 'active' : 'missing',
      summary: `Mounts all ${skillCount} AgentSkills via progressive disclosure and connects ${mcpServers.join(', ') || 'MCP'} servers globally across every agy workspace.`,
      why: 'Zero duplication between Claude Code, Codex, and Antigravity—one git repo updates every agent.',
      files: ['~/.gemini/config/skills.json', '~/.gemini/config/mcp_config.json', 'AgentSkills/scripts/install.mjs'],
      triggerHint: 'Auto-synced whenever `node scripts/install.mjs` runs.',
      metricLabel: `${skillCount} skills · ${mcpServers.length} MCP (${mcpServers.join(', ') || 'none'})`,
      evidenceCount: skillCount + mcpServers.length,
      lastAt: installedAt,
      verdict: verdict(skillCount > 0, skillCount),
    },
  ];

  const activeCount = features.filter((f) => f.status === 'active').length;
  const optInCount = features.filter((f) => f.status === 'opt-in').length;
  const provenCount = features.filter((f) => f.verdict === 'proven' || f.verdict === 'active').length;
  const collectingCount = features.filter((f) => f.verdict === 'collecting').length;

  return {
    generatedAt: new Date().toISOString(),
    installedAt,
    summary: {
      totalFeatures: features.length,
      activeFeatures: activeCount,
      optInFeatures: optInCount,
      provenOrUsed: provenCount,
      collectingData: collectingCount,
      totalTelemetryEvents: events.length,
      totalBlocks: guardAll.blocked,
      totalFormats: formatStats.formatted,
      totalNotifications: notifyStats.notified + ntfyStats.notified,
      totalHandoffs: handoffFiles.length,
      liveSessionCount: liveSessions.length,
      promptsSinceInstall: recentHistory.length,
      conversationsSinceInstall: uniqueConvs.size,
    },
    liveSessions,
    workspaces: Object.entries(byWorkspace)
      .map(([name, prompts]) => ({ name, prompts }))
      .sort((a, b) => b.prompts - a.prompts)
      .slice(0, 8),
    features,
    recentEvents: events.slice(-25).reverse(),
  };
}

export function writeDashboardSnapshot(data) {
  fs.mkdirSync(DASH_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  if (fs.existsSync(HTML_FILE)) {
    const html = fs.readFileSync(HTML_FILE, 'utf8');
    const markerRe = /\/\*__AGY_DATA_BEGIN__\*\/[\s\S]*?\/\*__AGY_DATA_END__\*\//;
    if (markerRe.test(html)) {
      const safeJson = JSON.stringify(data).replace(/<\//g, '<\\/');
      const updated = html.replace(markerRe, `/*__AGY_DATA_BEGIN__*/window.__AGY_DATA__ = ${safeJson};/*__AGY_DATA_END__*/`);
      fs.writeFileSync(LOCAL_HTML_FILE, updated, 'utf8');
    }
  }
}

function serve(port = 4789) {
  const server = http.createServer((req, res) => {
    if (req.url && req.url.startsWith('/api/stats')) {
      const data = collectStats();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
      return;
    }
    const data = collectStats();
    writeDashboardSnapshot(data);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(LOCAL_HTML_FILE, 'utf8'));
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`AGY Feature & Telemetry Dashboard live at http://127.0.0.1:${port}`);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const data = collectStats();
  writeDashboardSnapshot(data);
  if (process.argv.includes('--serve')) {
    const idx = process.argv.indexOf('--port');
    const port = idx >= 0 ? Number(process.argv[idx + 1]) || 4789 : 4789;
    serve(port);
  } else {
    console.log(`Updated ${DATA_FILE} (${data.summary.activeFeatures}/${data.summary.totalFeatures} active, ${data.summary.totalTelemetryEvents} telemetry events, ${data.summary.liveSessionCount} live sessions)`);
  }
}
