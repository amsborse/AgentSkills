#!/usr/bin/env node
// Idempotent installer for Antigravity / Gemini (`agy`) defaults + unified Claude colors:
// - Syncs GEMINI.md and hook scripts into ~/.gemini/config/
// - Merges our named hooks into ~/.gemini/config/hooks.json (preserving any user hooks)
// - On Windows: installs agy-colors.ps1 & claude-colors.ps1 into the PowerShell profile folder,
//   wires $PROFILE, and merges the Antigravity (AGY) profile + shortcuts into Windows Terminal settings.json.
// - Records install metadata in ~/.gemini/config/telemetry/installed.json for usage analytics.
//
//   node gemini-defaults/install.mjs            install or refresh
//   node gemini-defaults/install.mjs --dry-run  show what would change
//   node gemini-defaults/install.mjs --no-wt    skip Windows Terminal settings merge

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const toSlash = (p) => p.split(path.sep).join('/');

const SCRIPT_FILES = [
  'telemetry.js',
  'agy-session-hook.js',
  'agy-pretool-guard.js',
  'agy-format.js',
  'agy-handoff.js',
  'agy-eta.js',
  'agy-statusline.js',
  'agy-title.js',
  'agy-notify.ps1',
];

export function mergeCliSettings(existingObj, scriptsDir) {
  const s = (name) => toSlash(path.join(scriptsDir, name));
  const out = existingObj && typeof existingObj === 'object' && !Array.isArray(existingObj) ? { ...existingObj } : {};
  if (!out.colorScheme) out.colorScheme = 'terminal';
  out.statusLine = {
    type: 'command',
    command: `node "${s('agy-statusline.js')}"`,
    padding: 0,
    enabled: true,
    stack_with_default: false,
  };
  out.title = {
    type: 'command',
    command: `node "${s('agy-title.js')}"`,
    enabled: true,
  };
  return out;
}

export function buildHooksConfig(scriptsDir) {
  const s = (name) => toSlash(path.join(scriptsDir, name));
  return {
    'agy-session-status': {
      SessionStart: [{ type: 'command', command: `node "${s('agy-session-hook.js')}"`, timeout: 5 }],
      PreInvocation: [{ type: 'command', command: `node "${s('agy-session-hook.js')}"`, timeout: 5 }],
      PostToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: `node "${s('agy-session-hook.js')}"`, timeout: 5 }] }],
      Stop: [{ type: 'command', command: `node "${s('agy-session-hook.js')}"`, timeout: 5 }],
    },
    'agy-pretool-guard': {
      PreToolUse: [{ matcher: 'run_command', hooks: [{ type: 'command', command: `node "${s('agy-pretool-guard.js')}"`, timeout: 5 }] }],
    },
    'agy-auto-format': {
      PostToolUse: [{ matcher: 'edit_file|write_file', hooks: [{ type: 'command', command: `node "${s('agy-format.js')}"`, timeout: 20 }] }],
    },
    'agy-context-handoff': {
      SessionStart: [{ type: 'command', command: `node "${s('agy-handoff.js')}"`, timeout: 10 }],
      Stop: [{ type: 'command', command: `node "${s('agy-handoff.js')}"`, timeout: 8 }],
    },
  };
}

export function mergeHooksJson(existingObj, managedHooks) {
  const base = existingObj && typeof existingObj === 'object' && !Array.isArray(existingObj) ? { ...existingObj } : {};
  for (const [k, v] of Object.entries(managedHooks)) base[k] = v;
  return base;
}

export function mergeWtSettings(existingObj, snippet) {
  const out = JSON.parse(JSON.stringify(existingObj || {}));
  out.actions = Array.isArray(out.actions) ? out.actions : [];
  for (const action of snippet.actions || []) {
    if (!out.actions.some((a) => a && a.id === action.id)) out.actions.push(action);
  }
  out.keybindings = Array.isArray(out.keybindings) ? out.keybindings : [];
  for (const kb of snippet.keybindings || []) {
    if (!out.keybindings.some((k) => k && k.id === kb.id)) out.keybindings.push(kb);
  }
  out.profiles = out.profiles && typeof out.profiles === 'object' ? out.profiles : {};
  out.profiles.list = Array.isArray(out.profiles.list) ? out.profiles.list : [];
  if (snippet.profile && !out.profiles.list.some((p) => p && (p.guid === snippet.profile.guid || p.name === snippet.profile.name))) {
    out.profiles.list.push(snippet.profile);
  }
  return out;
}

function syncFile(src, dst, dryRun, log) {
  const content = fs.readFileSync(src);
  const exists = fs.existsSync(dst);
  if (exists && Buffer.compare(fs.readFileSync(dst), content) === 0) {
    log(`unchanged ${dst}`);
    return 'unchanged';
  }
  if (!dryRun) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, content);
  }
  log(`${dryRun ? 'would-write' : 'wrote'} ${dst}`);
  return dryRun ? 'would-write' : 'wrote';
}

function findPsProfileDir(home) {
  const candidates = [
    path.join(home, 'OneDrive', 'Documents', 'WindowsPowerShell'),
    path.join(home, 'Documents', 'WindowsPowerShell'),
  ];
  return candidates.find((d) => fs.existsSync(d)) || null;
}

function findWtSettings(env) {
  const localApp = env.LOCALAPPDATA;
  if (!localApp) return null;
  const pkgs = path.join(localApp, 'Packages');
  if (!fs.existsSync(pkgs)) return null;
  for (const name of fs.readdirSync(pkgs)) {
    if (name.startsWith('Microsoft.WindowsTerminal')) {
      const f = path.join(pkgs, name, 'LocalState', 'settings.json');
      if (fs.existsSync(f)) return f;
    }
  }
  return null;
}

export function run(argv = [], opts = {}) {
  const dryRun = argv.includes('--dry-run');
  const skipWt = argv.includes('--no-wt');
  const env = opts.env || process.env;
  const home = opts.home || os.homedir();
  const log = opts.log || ((s) => console.log(s));

  const geminiConfig = opts.geminiConfig || path.join(home, '.gemini', 'config');
  const scriptsDst = path.join(geminiConfig, 'scripts');
  const results = {};

  results.geminiMd = syncFile(path.join(HERE, 'GEMINI.md'), path.join(geminiConfig, 'GEMINI.md'), dryRun, log);

  for (const file of SCRIPT_FILES) {
    results[file] = syncFile(path.join(HERE, 'scripts', file), path.join(scriptsDst, file), dryRun, log);
  }

  // Merge hooks.json
  const hooksFile = path.join(geminiConfig, 'hooks.json');
  const prevHooks = fs.existsSync(hooksFile) ? JSON.parse(fs.readFileSync(hooksFile, 'utf8')) : {};
  const nextHooks = mergeHooksJson(prevHooks, buildHooksConfig(scriptsDst));
  const nextHooksText = JSON.stringify(nextHooks, null, 2) + '\n';
  const prevHooksText = fs.existsSync(hooksFile) ? fs.readFileSync(hooksFile, 'utf8') : '';
  if (nextHooksText === prevHooksText) {
    log(`unchanged ${hooksFile}`);
    results.hooks = 'unchanged';
  } else {
    if (!dryRun) {
      fs.mkdirSync(path.dirname(hooksFile), { recursive: true });
      fs.writeFileSync(hooksFile, nextHooksText, 'utf8');
    }
    log(`${dryRun ? 'would-write' : 'wrote'} ${hooksFile}`);
    results.hooks = dryRun ? 'would-write' : 'wrote';
  }

  // Merge ~/.gemini/antigravity-cli/settings.json (native statusLine + title + terminal colorScheme)
  const cliSettingsFile = opts.cliSettings || path.join(home, '.gemini', 'antigravity-cli', 'settings.json');
  const prevCliText = fs.existsSync(cliSettingsFile) ? fs.readFileSync(cliSettingsFile, 'utf8') : '';
  const prevCli = prevCliText ? JSON.parse(prevCliText) : {};
  const nextCli = mergeCliSettings(prevCli, scriptsDst);
  const nextCliText = JSON.stringify(nextCli, null, 2) + '\n';
  if (JSON.stringify(prevCli) === JSON.stringify(nextCli)) {
    log(`unchanged ${cliSettingsFile}`);
    results.cliSettings = 'unchanged';
  } else {
    if (!dryRun) {
      fs.mkdirSync(path.dirname(cliSettingsFile), { recursive: true });
      fs.writeFileSync(cliSettingsFile, nextCliText, 'utf8');
    }
    log(`${dryRun ? 'would-write' : 'wrote'} ${cliSettingsFile}`);
    results.cliSettings = dryRun ? 'would-write' : 'wrote';
  }

  // PowerShell agy-colors.ps1 + unified claude-colors.ps1 + $PROFILE wiring
  const psDir = opts.psProfileDir !== undefined ? opts.psProfileDir : findPsProfileDir(home);
  if (psDir) {
    results.agyColors = syncFile(path.join(HERE, 'powershell', 'agy-colors.ps1'), path.join(psDir, 'agy-colors.ps1'), dryRun, log);
    results.claudeColors = syncFile(path.join(HERE, 'powershell', 'claude-colors.ps1'), path.join(psDir, 'claude-colors.ps1'), dryRun, log);
    const profFile = path.join(psDir, 'Microsoft.PowerShell_profile.ps1');
    if (fs.existsSync(profFile)) {
      const profText = fs.readFileSync(profFile, 'utf8');
      if (!profText.includes('AGY COLORS')) {
        const block = "\r\n\r\n# >>> AGY COLORS >>>\r\n$AgyColorsModule = Join-Path $PSScriptRoot 'agy-colors.ps1'\r\nif (Test-Path $AgyColorsModule) {\r\n    . $AgyColorsModule\r\n}\r\n# <<< AGY COLORS <<<\r\n";
        if (!dryRun) fs.appendFileSync(profFile, block, 'utf8');
        log(`${dryRun ? 'would-update' : 'updated'} ${profFile}`);
        results.psProfile = dryRun ? 'would-update' : 'updated';
      } else {
        results.psProfile = 'unchanged';
      }
    }
  }

  // Windows Terminal profile + shortcuts
  const wtFile = skipWt ? null : (opts.wtSettings !== undefined ? opts.wtSettings : findWtSettings(env));
  if (wtFile && fs.existsSync(wtFile)) {
    const snippet = JSON.parse(fs.readFileSync(path.join(HERE, 'windows-terminal', 'agy-profile.json'), 'utf8'));
    const prevWtText = fs.readFileSync(wtFile, 'utf8');
    const prevWt = JSON.parse(prevWtText);
    const nextWt = mergeWtSettings(prevWt, snippet);
    const nextWtText = JSON.stringify(nextWt, null, 4);
    if (JSON.stringify(prevWt) === JSON.stringify(nextWt)) {
      log(`unchanged ${wtFile}`);
      results.wt = 'unchanged';
    } else {
      if (!dryRun) fs.writeFileSync(wtFile, nextWtText, 'utf8');
      log(`${dryRun ? 'would-update' : 'updated'} ${wtFile}`);
      results.wt = dryRun ? 'would-update' : 'updated';
    }
  }

  // Record install stamp for telemetry/dashboard (preserve original installedAt)
  if (!dryRun) {
    const metaFile = path.join(geminiConfig, 'telemetry', 'installed.json');
    fs.mkdirSync(path.dirname(metaFile), { recursive: true });
    let prev = {};
    if (fs.existsSync(metaFile)) {
      try { prev = JSON.parse(fs.readFileSync(metaFile, 'utf8')); } catch {}
    }
    const now = new Date().toISOString();
    const meta = {
      installedAt: prev.installedAt || now,
      updatedAt: now,
      version: 2,
    };
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  }

  return results;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { run(process.argv.slice(2)); }
  catch (err) { console.error('gemini-defaults install failed: ' + err.message); process.exit(1); }
}
