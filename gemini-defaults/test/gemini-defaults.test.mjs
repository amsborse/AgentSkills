import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildHooksConfig, mergeHooksJson, mergeWtSettings, run } from '../install.mjs';

const require = createRequire(import.meta.url);
const { checkCommand, findChainOperator } = require('../scripts/agy-pretool-guard.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-defaults-'));
const quiet = () => {};

test('agy-pretool-guard blocks PS 5.1 chain operators outside quotes and allows quoted text', () => {
  assert.ok(findChainOperator('echo a && echo b') >= 0);
  assert.equal(findChainOperator('echo "a && b"'), -1);
  assert.equal(findChainOperator("echo 'a || b'"), -1);
  assert.match(checkCommand('npm test && npm run build'), /PowerShell 5\.1/);
  assert.equal(checkCommand('npm test; if ($?) { npm run build }'), null);
});

test('agy-pretool-guard blocks batch email sends and destructive git commands', () => {
  assert.match(checkCommand('pnpm --filter @sutra/worker deliver'), /Batch email guard/);
  assert.equal(checkCommand('pnpm --filter @sutra/worker deliver --no-email'), null);
  assert.match(checkCommand('git reset --hard HEAD'), /git reset --hard/);
  assert.match(checkCommand('git clean -fd'), /git clean -fd/);
  assert.match(checkCommand('git push --force origin main'), /force-pushing/);
  assert.equal(checkCommand('git status'), null);
});

test('mergeHooksJson preserves unrelated user hooks and updates managed hooks', () => {
  const existing = { 'user-custom': { Stop: [{ type: 'command', command: 'echo hi' }] } };
  const merged = mergeHooksJson(existing, buildHooksConfig('C:/tmp/scripts'));
  assert.ok(merged['user-custom']);
  assert.ok(merged['agy-session-status']);
  assert.ok(merged['agy-pretool-guard']);
  assert.ok(merged['agy-auto-format']);
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

test('install run is idempotent and honors --dry-run', () => {
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
  assert.equal(first.psProfile, 'updated');
  assert.equal(first.wt, 'updated');

  const second = run([], { home, psProfileDir: psDir, wtSettings: wt, log: quiet });
  assert.equal(second.geminiMd, 'unchanged');
  assert.equal(second.hooks, 'unchanged');
  assert.equal(second.agyColors, 'unchanged');
  assert.equal(second.psProfile, 'unchanged');
  assert.equal(second.wt, 'unchanged');
});
