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
  mk('.codex', 'skills', 'nightly-evolution'); // a real directory the installer must not touch
  fs.writeFileSync(path.join(home, '.codex', 'skills', 'nightly-evolution', 'keep.txt'), 'mine');
  mk('.config', 'opencode');

  const plan = install(home, '--dry-run');
  assert.match(plan.out, /would-link/);
  assert.ok(!fs.existsSync(path.join(home, '.claude', 'skills', 'nightly-evolution')), 'dry run changes nothing');

  const first = install(home);
  assert.equal(first.code, 2, 'conflict reported via exit code');
  const skill = path.join(ROOT, 'nightly-evolution');
  assert.ok(resolves(path.join(home, '.claude', 'skills', 'nightly-evolution'), skill));
  assert.ok(resolves(path.join(home, '.claude-work', 'skills', 'nightly-evolution'), skill));
  assert.ok(!fs.existsSync(path.join(home, '.claude-omni', 'skills')), 'profiles without skills/ are left alone');
  assert.equal(fs.readFileSync(path.join(home, '.codex', 'skills', 'nightly-evolution', 'keep.txt'), 'utf8'), 'mine');
  assert.match(first.out, /covered\s+OpenCode/);
  assert.ok(resolves(path.join(home, 'agent-skills'), ROOT));
  assert.ok(fs.existsSync(path.join(home, '.claude', 'skills', 'nightly-evolution', 'SKILL.md')));

  const second = install(home);
  assert.doesNotMatch(second.out, /^linked/m, 'second run is a no-op');

  install(home, '--uninstall');
  assert.ok(!fs.existsSync(path.join(home, '.claude', 'skills', 'nightly-evolution')));
  assert.ok(fs.existsSync(skill), 'uninstall never touches the source');
  assert.ok(fs.existsSync(path.join(home, '.codex', 'skills', 'nightly-evolution', 'keep.txt')));
  // Unlink the remaining repo link explicitly so cleanup can never traverse into the repository.
  const stable = path.join(home, 'agent-skills');
  try {
    fs.unlinkSync(stable);
  } catch {
    fs.rmdirSync(stable);
  }
  assert.ok(fs.existsSync(path.join(ROOT, 'nightly-evolution', 'SKILL.md')));
  fs.rmSync(home, { recursive: true, force: true });
});
