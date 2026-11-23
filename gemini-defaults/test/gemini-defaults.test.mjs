import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildHooksConfig, mergeCliSettings, mergeHooksJson, mergeWtSettings, run } from '../install.mjs';
import { collectStats } from '../scripts/collect-stats.mjs';

const require = createRequire(import.meta.url);
const { checkCommand, findChainOperator } = require('../scripts/agy-pretool-guard.js');
const { saveHandoff, loadUnusedHandoff } = require('../scripts/agy-handoff.js');
const { renderStatusLine } = require('../scripts/agy-statusline.js');
const { renderTitle } = require('../scripts/agy-title.js');
const { runCli: runEta } = require('../scripts/agy-eta.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-defaults-'));
const quiet = () => {};

test('agy-pretool-guard blocks PS 5.1 chain operators outside quotes and allows quoted text', () => {
  assert.ok(findChainOperator('echo a && echo b') >= 0);
  assert.equal(findChainOperator('echo "a && b"'), -1);
  assert.equal(findChainOperator("echo 'a || b'"), -1);
  assert.match(checkCommand('npm test && npm run build'), /PowerShell 5\.1/);
  assert.equal(checkCommand('npm test; if ($?) { npm run build }'), null);
});

test('agy-pretool-guard blocks batch emails, secrets reads, prod deploys, and destructive git', () => {
  assert.match(checkCommand('pnpm --filter @sutra/worker deliver'), /Batch email guard/);
  assert.equal(checkCommand('pnpm --filter @sutra/worker deliver --no-email'), null);
  assert.match(checkCommand('cat .env'), /Secrets guard/);
  assert.match(checkCommand('Get-Content ~/.ssh/id_ed25519'), /Secrets guard/);
  assert.equal(checkCommand('cat .env.example'), null);
  assert.match(checkCommand('./scripts/deploy.sh'), /Prod deploy guard/);
  assert.match(checkCommand('wrangler deploy'), /Prod deploy guard/);
  assert.equal(checkCommand('wrangler deploy --env test'), null);
  assert.match(checkCommand('vercel --prod'), /Prod deploy guard/);
  assert.match(checkCommand('git reset --hard HEAD'), /git reset --hard/);
  assert.match(checkCommand('git clean -fd'), /git clean -fd/);
  assert.match(checkCommand('git push --force origin main'), /force-pushing/);
  assert.equal(checkCommand('git status'), null);
});

test('agy-handoff saves a handoff note on budget/threshold and loads it once', () => {
  const dir = tmp();
  const prevDir = process.env.AGY_HANDOFF_DIR;
  const prevWatch = process.env.AGY_WATCH_DIR;
  process.env.AGY_HANDOFF_DIR = path.join(dir, 'handoffs');
  process.env.AGY_WATCH_DIR = path.join(dir, 'watch');
  const repoDir = path.join(dir, 'demo-repo');
  fs.mkdirSync(repoDir, { recursive: true });
  try {
    const saved = saveHandoff({
      conversationId: `conv-${Date.now()}`,
      cwd: repoDir,
      terminationReason: 'MAX_TOKEN_BUDGET_EXCEEDED',
    });
    assert.ok(saved && fs.existsSync(saved));
    const loaded = loadUnusedHandoff(repoDir);
    assert.ok(loaded && loaded.content.includes('Session Handoff'));
    // Second load returns null because it was marked .used.md
    assert.equal(loadUnusedHandoff(repoDir), null);
  } finally {
    if (prevDir === undefined) delete process.env.AGY_HANDOFF_DIR;
    else process.env.AGY_HANDOFF_DIR = prevDir;
    if (prevWatch === undefined) delete process.env.AGY_WATCH_DIR;
    else process.env.AGY_WATCH_DIR = prevWatch;
  }
});

test('mergeHooksJson preserves unrelated user hooks and updates managed hooks', () => {
  const existing = { 'user-custom': { Stop: [{ type: 'command', command: 'echo hi' }] } };
  const merged = mergeHooksJson(existing, buildHooksConfig('C:/tmp/scripts'));
  assert.ok(merged['user-custom']);
  assert.ok(merged['agy-session-status']);
  assert.ok(merged['agy-pretool-guard']);
  assert.ok(merged['agy-auto-format']);
  assert.ok(merged['agy-context-handoff']);
});

test('mergeWtSettings adds profile and bindings once idempotently', () => {
  const snippet = JSON.parse(fs.readFileSync(new URL('../windows-terminal/agy-profile.json', import.meta.url), 'utf8'));
  const once = mergeWtSettings({ actions: [], keybindings: [], profiles: { list: [] } }, snippet);
  const twice = mergeWtSettings(once, snippet);
  assert.equal(once.actions.length, 2);
  assert.equal(once.keybindings.length, 2);
  assert.equal(once.profiles.list.length, 1);
  assert.deepEqual(twice, once);
});

test('install run is idempotent and collectStats reads real telemetry honestly', () => {
  const home = tmp();
  const psDir = path.join(home, 'ps');
  fs.mkdirSync(psDir, { recursive: true });
  const prof = path.join(psDir, 'Microsoft.PowerShell_profile.ps1');
  fs.writeFileSync(prof, '# existing profile\n', 'utf8');
  const wt = path.join(home, 'wt.json');
  fs.writeFileSync(wt, JSON.stringify({ actions: [], keybindings: [], profiles: { list: [] } }), 'utf8');

  const dry = run(['--dry-run'], { home, psProfileDir: psDir, wtSettings: wt, log: quiet });
  assert.equal(dry.geminiMd, 'would-write');
  assert.equal(fs.existsSync(path.join(home, '.gemini', 'config', 'GEMINI.md')), false);

  const first = run([], { home, psProfileDir: psDir, wtSettings: wt, log: quiet });
  assert.equal(first.geminiMd, 'wrote');
  assert.equal(first.hooks, 'wrote');
  assert.equal(first.agyColors, 'wrote');
  assert.equal(first.claudeColors, 'wrote');
  assert.equal(first.psProfile, 'updated');
  assert.equal(first.wt, 'updated');

  const second = run([], { home, psProfileDir: psDir, wtSettings: wt, log: quiet });
  assert.equal(second.geminiMd, 'unchanged');
  assert.equal(second.hooks, 'unchanged');
  assert.equal(second.agyColors, 'unchanged');
  assert.equal(second.claudeColors, 'unchanged');
  assert.equal(second.psProfile, 'unchanged');
  assert.equal(second.wt, 'unchanged');

  const stats = collectStats({ home, psDir, wtFile: wt, tmpDir: path.join(home, 'tmp') });
  assert.equal(stats.summary.totalTelemetryEvents, 0);
  assert.ok(stats.features.length >= 12);
});

test('statusLine, native title, and agy-eta render title, time alive, ETA, and next task', () => {
  const dir = tmp();
  const prevEta = process.env.AGY_ETA_DIR;
  process.env.AGY_ETA_DIR = path.join(dir, 'eta');
  try {
    runEta(['--session', 'conv-ui-1', 'plan', '4', '10', 'Wire native statusLine']);
    runEta(['--session', 'conv-ui-1', 'step', 'Deploy & test']);
    const payload = {
      cwd: 'C:\\Tools',
      conversation_id: 'conv-ui-1',
      conversation_title: 'Creative Cockpit Statusbar',
      agent_state: 'working',
      model: { id: 'Gemini 4 Neon (High)', display_name: 'Gemini 4 Neon (High)' },
      context_window: { used_percentage: 28.4 },
      quota: { weekly: { remaining_fraction: 0.91 } },
      subagents: [{ name: 'worker', role: 'Tester', status: 'running' }],
      task_count: 1,
      terminal_width: 140,
    };
    const out = renderStatusLine(payload);
    const plain = out.replace(/\x1b\[[0-9;]*m/g, '');
    assert.ok(plain.includes('Creative Cockpit Statusbar'));
    assert.ok(plain.includes('CTX'));
    assert.ok(plain.includes('ALIVE'));
    assert.ok(plain.includes('ETA'));
    assert.ok(plain.includes('1/4'));
    assert.ok(plain.includes('NEXT'));
    assert.ok(plain.includes('Deploy & test'));
    const title = renderTitle(payload);
    assert.ok(title.includes('Working') && title.includes('Creative Cockpit'));

    const cliCfg = mergeCliSettings({ model: 'Gemini 4 Neon (High)' }, 'C:/cfg/scripts');
    assert.equal(cliCfg.model, 'Gemini 4 Neon (High)');
    assert.equal(cliCfg.colorScheme, 'terminal');
    assert.equal(cliCfg.statusLine.command, 'node C:/cfg/scripts/agy-statusline.js');
    assert.equal(cliCfg.title.command, 'node C:/cfg/scripts/agy-title.js');
  } finally {
    if (prevEta === undefined) delete process.env.AGY_ETA_DIR;
    else process.env.AGY_ETA_DIR = prevEta;
  }
});
