import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function install(home, ...args) {
  const env = { ...process.env, AGENT_SKILLS_HOME_OVERRIDE: home, NIGHTLY_EVOLUTION_HOME: path.join(home, '.config', 'nightly-evolution'), PATH: '' };
  delete env.CLAUDE_CONFIG_DIR;
  delete env.CODEX_HOME;
  delete env.XDG_CONFIG_HOME;
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'install.mjs'), ...args], { encoding: 'utf8', env });
  return { code: r.status, out: r.stdout + r.stderr };
}

const resolves = (link, target) => fs.realpathSync.native(link).toLowerCase() === fs.realpathSync.native(target).toLowerCase();

test('installer links into detected agents, is idempotent, and never overwrites', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-home-'));
  const mk = (...p) => fs.mkdirSync(path.join(home, ...p), { recursive: true });
  mk('.claude', 'skills');
  mk('.claude-work', 'skills');
  fs.writeFileSync(path.join(home, '.claude-work', 'settings.json'), '{}');
  mk('.claude-omni');
  fs.writeFileSync(path.join(home, '.claude-omni', 'settings.json'), '{}');
  mk('.codex');
  mk('.codex', 'skills', 'third-party'); // deprecated location can contain real third-party skills
  mk('.codex', 'skills', '.system');
  mk('.agents', 'skills', 'verify');
  fs.writeFileSync(path.join(home, '.agents', 'skills', 'verify', 'keep.txt'), 'local');
  fs.writeFileSync(path.join(home, '.codex', 'skills', 'third-party', 'keep.txt'), 'mine');
  fs.writeFileSync(path.join(home, '.codex', 'skills', '.system', 'keep.txt'), 'system');
  fs.symlinkSync(path.join(ROOT, 'skills', 'improve'), path.join(home, '.codex', 'skills', 'old-repo-skill'), 'junction');
  mk('.config', 'opencode');

  const plan = install(home, '--dry-run');
  assert.match(plan.out, /would-link/);
  assert.ok(!fs.existsSync(path.join(home, '.claude', 'skills', 'nightly-evolution')), 'dry run changes nothing');
  assert.ok(fs.existsSync(path.join(home, '.codex', 'skills', 'old-repo-skill')), 'dry run reports migration pruning without removing it');

  const first = install(home);
  assert.equal(first.code, 2, 'conflict reported via exit code');
  const skill = path.join(ROOT, 'skills', 'improve');
  assert.ok(resolves(path.join(home, '.claude', 'skills', 'improve'), skill));
  assert.ok(resolves(path.join(home, '.claude-work', 'skills', 'improve'), skill));
  assert.ok(!fs.existsSync(path.join(home, '.claude-omni', 'skills')), 'profiles without skills/ are left alone');
  assert.equal(fs.readFileSync(path.join(home, '.codex', 'skills', 'third-party', 'keep.txt'), 'utf8'), 'mine');
  assert.equal(fs.readFileSync(path.join(home, '.codex', 'skills', '.system', 'keep.txt'), 'utf8'), 'system');
  assert.equal(fs.readFileSync(path.join(home, '.agents', 'skills', 'verify', 'keep.txt'), 'utf8'), 'local');
  assert.ok(!fs.existsSync(path.join(home, '.codex', 'skills', 'old-repo-skill')));
  assert.match(first.out, /covered\s+OpenCode/);
  assert.ok(resolves(path.join(home, 'agent-skills'), ROOT));
  assert.ok(fs.existsSync(path.join(home, '.claude', 'skills', 'improve', 'SKILL.md')));
  assert.ok(resolves(path.join(home, '.agents', 'skills', 'improve'), skill));

  const second = install(home);
  assert.doesNotMatch(second.out, /^linked/m, 'second run is a no-op');

  install(home, '--uninstall');
  assert.ok(!fs.existsSync(path.join(home, '.claude', 'skills', 'improve')));
  assert.ok(fs.existsSync(skill, 'uninstall never touches the source'));
  assert.ok(fs.existsSync(path.join(home, '.codex', 'skills', 'third-party', 'keep.txt')));
  // Unlink the remaining repo link explicitly so cleanup can never traverse into the repository.
  const stable = path.join(home, 'agent-skills');
  try {
    fs.unlinkSync(stable);
  } catch {
    fs.rmdirSync(stable);
  }
  assert.ok(fs.existsSync(path.join(ROOT, 'skills', 'improve', 'SKILL.md')));
  fs.rmSync(home, { recursive: true, force: true });
});

test('installer prunes stale and dangling repo links, preserving real and foreign entries', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-prune-'));
  const dir = path.join(home, '.agents', 'skills');
  fs.mkdirSync(path.join(dir, 'real'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'real', 'keep'), 'yes');
  fs.mkdirSync(path.join(home, 'foreign'));
  fs.symlinkSync(path.join(ROOT, 'skills', 'improve'), path.join(dir, 'stale'), 'junction');
  fs.symlinkSync(path.join(ROOT, 'skills', 'gone'), path.join(dir, 'dangling'), 'junction');
  fs.symlinkSync(path.join(home, 'foreign'), path.join(dir, 'foreign-link'), 'junction');
  // A user's own link into a non-skill folder of this checkout is not ours to prune.
  fs.symlinkSync(path.join(ROOT, 'docs'), path.join(dir, 'repo-docs'), 'junction');
  const result = install(home);
  assert.match(result.out, /pruned/);
  assert.ok(!fs.existsSync(path.join(dir, 'stale')));
  assert.ok(!fs.existsSync(path.join(dir, 'dangling')));
  assert.ok(fs.existsSync(path.join(dir, 'real', 'keep')));
  assert.ok(fs.existsSync(path.join(dir, 'foreign-link')));
  assert.ok(fs.existsSync(path.join(dir, 'repo-docs')), 'link to a non-skill repo folder is preserved');
  fs.rmSync(home, { recursive: true, force: true });
});

test('router hook and Codex block are idempotent and uninstall cleanly', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-config-'));
  const settingsPath = path.join(home, '.claude', 'settings.json');
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify({ hooks: { UserPromptSubmit: [{ matcher: 'x', hooks: [{ type: 'command', command: 'keep' }] }] }, other: 1 }, null, 2));
  install(home, '--router-hook', 'on', '--codex-block', 'on', '--dry-run');
  assert.doesNotMatch(fs.readFileSync(settingsPath, 'utf8'), /route-hook\.mjs/);
  assert.ok(!fs.existsSync(path.join(home, '.codex', 'AGENTS.md')));
  install(home, '--router-hook', 'on', '--codex-block', 'on');
  const firstSettings = fs.readFileSync(settingsPath, 'utf8');
  install(home, '--router-hook', 'on', '--codex-block', 'on');
  assert.equal(fs.readFileSync(settingsPath, 'utf8'), firstSettings);
  assert.ok(fs.existsSync(`${settingsPath}.agent-skills-backup`));
  const settings = JSON.parse(firstSettings);
  assert.ok(settings.hooks.UserPromptSubmit.flatMap((g) => g.hooks).some((h) => h.command === 'keep'));
  assert.equal(settings.hooks.UserPromptSubmit.flatMap((g) => g.hooks).filter((h) => h.command?.includes('route-hook.mjs')).length, 1);
  const codexPath = path.join(home, '.codex', 'AGENTS.md');
  const original = 'top\n\n';
  fs.writeFileSync(codexPath, `${original}bottom\n`);
  install(home, '--codex-block', 'on');
  const marked = fs.readFileSync(codexPath, 'utf8');
  install(home, '--codex-block', 'on');
  assert.equal(fs.readFileSync(codexPath, 'utf8'), marked);
  install(home, '--uninstall');
  assert.doesNotMatch(fs.readFileSync(settingsPath, 'utf8'), /route-hook\.mjs/);
  assert.equal(fs.readFileSync(codexPath, 'utf8'), `${original}bottom\n`);
  fs.rmSync(home, { recursive: true, force: true });
});

test('invalid Claude settings aborts without modification', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-invalid-'));
  const settingsPath = path.join(home, '.claude', 'settings.json');
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, '{ invalid');
  const result = install(home, '--router-hook', 'on');
  assert.notEqual(result.code, 0);
  assert.equal(fs.readFileSync(settingsPath, 'utf8'), '{ invalid');
  assert.ok(!fs.existsSync(`${settingsPath}.agent-skills-backup`));
  assert.ok(!fs.existsSync(path.join(home, '.claude', 'skills', 'improve')), 'no skill links before the abort');
  assert.ok(!fs.existsSync(path.join(home, 'agent-skills')), 'no stable checkout link before the abort');
  fs.rmSync(home, { recursive: true, force: true });
});
