import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'tests', 'fixtures', 'registry-build');
const build = (...args) => spawnSync(process.execPath, [path.join(root, 'scripts', 'build-registry.mjs'), '--root', fixture, ...args], { encoding: 'utf8' });

test('registry build shape and deterministic check detects drift', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'registry-'));
  const skills = path.join(temp, 'skills', 'sample');
  fs.mkdirSync(path.join(skills, 'workflows'), { recursive: true });
  fs.copyFileSync(path.join(fixture, 'skills', 'sample', 'SKILL.md'), path.join(skills, 'SKILL.md'));
  fs.copyFileSync(path.join(fixture, 'skills', 'sample', 'workflows', 'example.md'), path.join(skills, 'workflows', 'example.md'));
  const run = (...args) => spawnSync(process.execPath, [path.join(root, 'scripts', 'build-registry.mjs'), '--root', temp, ...args], { encoding: 'utf8' });
  assert.equal(run().status, 0);
  const file = path.join(temp, 'registry', 'skills.json');
  const first = fs.readFileSync(file, 'utf8');
  assert.equal(run().status, 0);
  assert.equal(fs.readFileSync(file, 'utf8'), first);
  const parsed = JSON.parse(first);
  assert.equal(parsed.skills[0].requires[1].optional, true);
  assert.deepEqual(parsed.skills[0].workflows, ['skills/sample/workflows/example.md']);
  const capabilities = JSON.parse(fs.readFileSync(path.join(temp, 'registry', 'capabilities.json'), 'utf8'));
  assert.deepEqual(capabilities.capabilities.browser, { requiredBy: ['sample'], optionalFor: [] });
  assert.deepEqual(capabilities.capabilities['image-generation'], { requiredBy: [], optionalFor: ['sample'] });
  fs.writeFileSync(file, '{}\n');
  assert.equal(run('--check').status, 1);
  fs.rmSync(temp, { recursive: true, force: true });
});
