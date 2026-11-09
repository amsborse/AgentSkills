import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hook = path.join(root, 'scripts', 'hooks', 'route-hook.mjs');
const registry = path.join(root, 'tests', 'fixtures', 'registry.json');
const run = (input, env = {}) => spawnSync(process.execPath, [hook], { input, encoding: 'utf8', env: { ...process.env, AGENT_SKILLS_REGISTRY: registry, ...env } });

test('valid prompt emits hook context JSON', () => {
  const result = run(JSON.stringify({ prompt: 'please redesign ui and improve layout' }));
  assert.equal(result.status, 0);
  const json = JSON.parse(result.stdout);
  assert.equal(json.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(json.hookSpecificOutput.additionalContext, /revamp-ui/);
});
test('slash command, invalid input, missing registry and opt-out fail open silently', () => {
  assert.equal(run('{"prompt":"/verify"}').stdout, '');
  const bad = run('{'); assert.equal(bad.status, 0); assert.equal(bad.stdout, '');
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-registry-'));
  const missing = run('{"prompt":"please redesign ui"}', { AGENT_SKILLS_REGISTRY: path.join(empty, 'missing.json') });
  assert.equal(missing.status, 0); assert.equal(missing.stdout, '');
  assert.equal(run('{"prompt":"please redesign ui"}', { AGENT_SKILLS_ROUTER: 'off' }).stdout, '');
  fs.rmSync(empty, { recursive: true, force: true });
});
test('hook finishes promptly', () => {
  const start = performance.now();
  run('{"prompt":"please redesign ui"}');
  assert.ok(performance.now() - start < 1000);
});
