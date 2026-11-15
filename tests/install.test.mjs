import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function install(home, ...args) {
  const env = { ...process.env, AGENT_SKILLS_HOME_OVERRIDE: home, NIGHTLY_EVOLUTION_HOME: path.join(home, '.config', 'nightly-evolution'), PATH: '', HL_SCHEDULER_LOG: path.join(home, 'scheduler.jsonl') }; // never the real scheduler
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

test('links at an old skill location in this checkout are repointed, not reported as conflicts', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-moved-'));
  const dir = path.join(home, '.claude', 'skills');
  fs.mkdirSync(dir, { recursive: true });
  // Before the restructure, skills lived at the repository root: one old path is gone (dangling),
  // another still exists as a folder without SKILL.md (working-agreements keeps its AGENTS.md).
  fs.symlinkSync(path.join(ROOT, 'improve'), path.join(dir, 'improve'), 'junction');
  fs.symlinkSync(path.join(ROOT, 'working-agreements'), path.join(dir, 'working-agreements'), 'junction');
  fs.mkdirSync(path.join(home, 'elsewhere'));
  fs.symlinkSync(path.join(home, 'elsewhere'), path.join(dir, 'verify'), 'junction');
  const result = install(home);
  assert.ok(resolves(path.join(dir, 'improve'), path.join(ROOT, 'skills', 'improve')));
  assert.ok(resolves(path.join(dir, 'working-agreements'), path.join(ROOT, 'skills', 'working-agreements')));
  assert.ok(resolves(path.join(dir, 'verify'), path.join(home, 'elsewhere')), 'a link outside this checkout is still left alone');
  assert.match(result.out, /conflict\s+Claude Code: .*verify/);
  assert.doesNotMatch(result.out, /conflict\s+Claude Code: .*(improve|working-agreements)/);
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

test('learning install adds the notice hook and a daily run, retires the SessionEnd hook, and uninstalls cleanly', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-learning-'));
  const settingsPath = path.join(home, '.claude', 'settings.json');
  const schedulerLog = path.join(home, 'scheduler.jsonl');
  const calls = () => (fs.existsSync(schedulerLog) ? fs.readFileSync(schedulerLog, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : []);
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  // An earlier version installed a SessionEnd hook; it must be removed, other hooks kept.
  const old = { type: 'command', command: 'node "D:/x/history-learning/scripts/hl.mjs" hook session-end', timeout: 5 };
  fs.writeFileSync(settingsPath, JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'keep-start' }] }], SessionEnd: [{ hooks: [old] }, { hooks: [{ type: 'command', command: 'keep-end' }] }] } }, null, 2));
  assert.equal(install(home, '--learning-hooks', 'on').code, 0);
  const first = fs.readFileSync(settingsPath, 'utf8');
  install(home, '--learning-hooks', 'on');
  assert.equal(fs.readFileSync(settingsPath, 'utf8'), first, 'idempotent');
  const hooks = JSON.parse(first).hooks;
  const commands = (event) => hooks[event].flatMap((g) => g.hooks).map((h) => h.command);
  assert.ok(commands('SessionStart').includes('keep-start'));
  assert.equal(commands('SessionStart').filter((c) => c.endsWith('hl.mjs" hook session-start')).length, 1);
  assert.ok(commands('SessionStart').every((c) => !c.includes('\\')), 'forward slashes on every platform');
  assert.deepEqual(commands('SessionEnd'), ['keep-end'], 'retired SessionEnd hook removed, others kept');
  const created = calls().filter((c) => c.argv.includes('/Create') || (c.cmd === 'crontab' && c.argv[0] === '-'));
  assert.equal(created.length, 2, 'the daily run is (re)written on each install');
  const scheduled = JSON.stringify(created[0]);
  assert.match(scheduled, /hl\.mjs.*auto-run --background/);
  if (process.platform === 'win32') assert.ok(created[0].argv.includes('DAILY'));
  install(home, '--learning-hooks', 'off');
  const after = JSON.parse(fs.readFileSync(settingsPath, 'utf8')).hooks;
  assert.deepEqual(after, { SessionStart: [{ hooks: [{ type: 'command', command: 'keep-start' }] }], SessionEnd: [{ hooks: [{ type: 'command', command: 'keep-end' }] }] });
  assert.ok(calls().some((c) => c.argv.includes('/Delete') || (c.cmd === 'crontab' && c.argv[0] === '-' && !String(c.input).includes('auto-run'))), 'daily run removed');
  fs.rmSync(home, { recursive: true, force: true });
});

test('validate checks a linked worktree against the primary checkout, and still fails a missing link', async () => {
  const { installFindings, primaryCheckout } = await import('../scripts/lib/agents.mjs');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-worktree-'));
  const skill = (root, name) => {
    fs.mkdirSync(path.join(root, 'skills', name), { recursive: true });
    fs.writeFileSync(path.join(root, 'skills', name, 'SKILL.md'), `---\nname: ${name}\n---\n`);
  };
  const primary = path.join(base, 'primary');
  const worktree = path.join(base, 'worktree');
  for (const name of ['alpha', 'beta']) { skill(primary, name); skill(worktree, name); }
  skill(worktree, 'gamma'); // exists only on the branch checked out in the worktree
  const gitDir = path.join(primary, '.git', 'worktrees', 'wt');
  fs.mkdirSync(gitDir, { recursive: true });
  fs.writeFileSync(path.join(gitDir, 'commondir'), '../..\n');
  fs.writeFileSync(path.join(worktree, '.git'), `gitdir: ${gitDir}\n`);
  assert.equal(primaryCheckout(worktree), primary);
  assert.equal(primaryCheckout(primary), primary);

  const target = path.join(base, 'home', '.claude', 'skills');
  fs.mkdirSync(target, { recursive: true });
  for (const name of ['alpha', 'beta']) fs.symlinkSync(path.join(primary, 'skills', name), path.join(target, name), 'junction');
  const agents = [{ name: 'Claude Code', targets: [target] }, { name: 'Cursor', targets: [], coveredBy: target }];
  const levels = (found, level) => found.filter(([l]) => l === level).map(([, m]) => m);

  const fromWorktree = installFindings(agents, { root: worktree });
  assert.deepEqual(levels(fromWorktree, 'bad'), [], 'links to the primary checkout are a correct installation');
  assert.equal(levels(fromWorktree, 'ok').length, 3);
  assert.ok(levels(fromWorktree, 'warn').some((m) => /until merged: gamma/.test(m)), 'the branch-only skill is reported, not hidden');

  assert.deepEqual(levels(installFindings(agents, { root: primary }), 'bad'), []);

  fs.rmSync(path.join(target, 'beta'), { recursive: true });
  for (const root of [worktree, primary]) {
    const bad = levels(installFindings(agents, { root }), 'bad');
    assert.equal(bad.length, 2, 'a missing link fails for the target and for the agent it covers');
    assert.match(bad[0], /beta not installed/);
  }
  skill(primary, 'gamma');
  assert.ok(levels(installFindings(agents, { root: primary }), 'bad').some((m) => /gamma not installed/.test(m)), 'in the primary checkout an uninstalled skill is a failure');
  fs.rmSync(base, { recursive: true, force: true });
});
