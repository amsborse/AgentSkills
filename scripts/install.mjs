#!/usr/bin/env node
// Idempotent installer: links each skill in this repository into every detected agent's
// user skill directory. Never overwrites a real directory or a link that points elsewhere.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO_ROOT, createLink, detectAgents, linkState, ownedRepoLink, removeLink, repoLinkTarget, skillDirs } from './lib/agents.mjs';

const args = new Set(process.argv.slice(2));
const plan = args.has('--dry-run');
const uninstall = args.has('--uninstall');
const home = process.env.AGENT_SKILLS_HOME_OVERRIDE || os.homedir();
const option = (name) => {
  const i = process.argv.indexOf(name);
  if (i < 0) return null;
  const value = process.argv[i + 1];
  if (!['on', 'off'].includes(value)) throw new Error(`${name} requires on|off`);
  return value;
};
const routerOption = option('--router-hook');
const codexOption = option('--codex-block');
const results = [];
const say = (status, what, detail = '') => {
  results.push({ status, what, detail });
  process.stdout.write(`${status.padEnd(9)} ${what}${detail ? `  (${detail})` : ''}\n`);
};

// Every settings.json the router step will touch must parse before anything is changed, so an
// invalid file aborts the whole run instead of leaving links half-installed.
function routerProfiles() {
  const profiles = new Set();
  if (process.env.CLAUDE_CONFIG_DIR) profiles.add(path.resolve(process.env.CLAUDE_CONFIG_DIR));
  if (fs.existsSync(path.join(home, '.claude'))) profiles.add(path.join(home, '.claude'));
  for (const entry of fs.existsSync(home) ? fs.readdirSync(home) : []) {
    const profile = path.join(home, entry);
    if (/^.claude-[w-]+$/.test(entry) && (fs.existsSync(path.join(profile, 'settings.json')) || fs.existsSync(path.join(profile, '.claude.json')))) profiles.add(profile);
  }
  if (!profiles.size) profiles.add(path.join(home, '.claude'));
  return [...profiles];
}
function readSettings(settings) {
  if (!fs.existsSync(settings)) return {};
  let data;
  try { data = JSON.parse(fs.readFileSync(settings, 'utf8')); }
  catch { throw new Error(`Cannot update ${settings}: invalid JSON; nothing changed`); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`Cannot update ${settings}: expected JSON object; nothing changed`);
  return data;
}
const profilesToConfigure = routerOption || uninstall ? routerProfiles() : [];
for (const profile of profilesToConfigure) readSettings(path.join(profile, 'settings.json'));

// 1. A stable checkout path: ~/agent-skills -> this repository.
const stable = path.join(home, 'agent-skills');
const stableState = linkState(stable, REPO_ROOT);
if (path.resolve(REPO_ROOT).toLowerCase() === path.resolve(stable).toLowerCase()) say('ok', `${stable} is this repository`);
else if (stableState === 'ok') say('ok', `${stable} -> ${REPO_ROOT}`);
else if (stableState === 'missing' && !uninstall) {
  if (!plan) createLink(stable, REPO_ROOT);
  say(plan ? 'would-link' : 'linked', `${stable} -> ${REPO_ROOT}`);
} else if (!uninstall) say('conflict', stable, `${stableState}; left untouched`);

// 2. Skills into every detected agent.
const skills = skillDirs();
const skillNames = skills.map((s) => path.basename(s));
const agents = detectAgents(home);
if (!agents.length) say('skip', 'no supported agent (Claude Code, Codex, OpenCode, Cursor) detected');
for (const agent of agents) {
  if (agent.coveredBy) say('covered', `${agent.name}`, `reads ${agent.coveredBy}`);
  for (const s of agent.skipped || []) say('skip', `${agent.name}: ${s}`);
  const targets = [...agent.targets, ...(agent.migrated || [])];
  for (const dir of targets) {
    let entries = [];
    try { entries = fs.readdirSync(dir); } catch {}
    for (const name of entries) {
      const link = path.join(dir, name);
      const current = agent.targets.includes(dir) && skillNames.includes(name);
      if (!current && ownedRepoLink(link)) {
        if (!plan) removeLink(link);
        say(plan ? 'would-prune' : 'pruned', link, agent.migrated?.includes(dir) ? 'migrated Codex skills link' : 'stale repository link');
      }
    }
  }
  for (const dir of agent.targets) {
    for (const skill of skills) {
      const source = path.join(REPO_ROOT, ...skill.split('/'));
      const link = path.join(dir, path.basename(skill));
      const state = linkState(link, source);
      if (uninstall) {
        if (state === 'ok') {
          if (!plan) removeLink(link);
          say(plan ? 'would-rm' : 'removed', link);
        }
        continue;
      }
      if (state === 'ok') say('ok', `${agent.name}: ${link}`);
      else if (state === 'missing') {
        if (!plan) createLink(link, source);
        say(plan ? 'would-link' : 'linked', `${agent.name}: ${link} -> ${source}`);
      } else if (state === 'foreign-link' && repoLinkTarget(link)) {
        // A link into this checkout at the skill's old path (skills moved under skills/): ours.
        if (!plan) { removeLink(link); createLink(link, source); }
        say(plan ? 'would-relink' : 'relinked', `${agent.name}: ${link} -> ${source}`);
      } else say('conflict', `${agent.name}: ${link}`, `${state === 'occupied' ? 'a real directory exists' : 'links elsewhere'}; left untouched`);
    }
  }
}

const backupSettings = (file) => {
  const backup = `${file}.agent-skills-backup`;
  if (fs.existsSync(file) && !fs.existsSync(backup)) fs.copyFileSync(file, backup);
};
// Forward slashes on every platform (matches the existing SessionStart hook); `ours` also
// accepts backslashes so a hand-edited or older entry is still recognised and not duplicated.
const hookCommand = `node "${path.join(REPO_ROOT, 'scripts', 'hooks', 'route-hook.mjs').replaceAll('\\', '/')}"`;
const ours = (h) => typeof h?.command === 'string' && h.command.replaceAll('\\', '/').includes('scripts/hooks/route-hook.mjs');
function configureRouter(profile, mode) {
  const settings = path.join(profile, 'settings.json');
  if (!fs.existsSync(settings) && mode === 'off') return;
  const data = readSettings(settings);
  const hooks = data.hooks && typeof data.hooks === 'object' ? data.hooks : {};
  const submitWasArray = Array.isArray(hooks.UserPromptSubmit);
  const groups = Array.isArray(hooks.UserPromptSubmit) ? hooks.UserPromptSubmit : [];
  const before = JSON.stringify(data);
  if (mode === 'on') {
    if (!groups.some((g) => Array.isArray(g?.hooks) && g.hooks.some(ours))) groups.push({ hooks: [{ type: 'command', command: hookCommand, timeout: 5 }] });
    hooks.UserPromptSubmit = groups;
  } else if (mode === 'off') {
    const hadOurs = groups.some((g) => Array.isArray(g?.hooks) && g.hooks.some(ours));
    const remainingGroups = groups.flatMap((g) => {
      const entries = g.hooks || [];
      const remaining = entries.filter((h) => !ours(h));
      return remaining.length || remaining.length === entries.length ? [{ ...g, hooks: remaining }] : [];
    });
    if (hadOurs && !remainingGroups.length) delete hooks.UserPromptSubmit;
    else if (submitWasArray || groups.length) hooks.UserPromptSubmit = remainingGroups;
  }
  if (!Object.keys(hooks).length) delete data.hooks;
  else data.hooks = hooks;
  if (JSON.stringify(data) !== before) {
    if (!plan) {
      backupSettings(settings);
      fs.mkdirSync(profile, { recursive: true });
      fs.writeFileSync(settings, `${JSON.stringify(data, null, 2)}\n`);
    }
    say(plan ? 'would-update' : 'updated', settings, `router hook ${mode}`);
  } else say('ok', settings, `router hook already ${mode === 'on' ? 'installed' : 'absent'}`);
}

for (const profile of profilesToConfigure) configureRouter(profile, uninstall ? 'off' : routerOption);

const codexHome = process.env.CODEX_HOME ? path.resolve(process.env.CODEX_HOME) : path.join(home, '.codex');
const codexFile = path.join(codexHome, 'AGENTS.md');
const begin = '<!-- agent-skills:begin -->';
const end = '<!-- agent-skills:end -->';
const codexText = `${begin}\nThe owner's working agreements are at ~/agent-skills/working-agreements/AGENTS.md; read them before coding work. Skills are installed under ~/.agents/skills. Run node ~/agent-skills/scripts/route.mjs "<task>" to find a skill that fits a task.\n${end}`;
function configureCodex(mode) {
  if (!fs.existsSync(codexFile) && mode === 'off') return;
  const original = fs.existsSync(codexFile) ? fs.readFileSync(codexFile, 'utf8') : '';
  const blockPattern = /<!-- agent-skills:begin -->[\s\S]*?<!-- agent-skills:end -->/;
  const removalPattern = /(?:\r?\n)?<!-- agent-skills:begin -->[\s\S]*?<!-- agent-skills:end -->/;
  const next = mode === 'on'
    ? (blockPattern.test(original) ? original.replace(blockPattern, codexText) : `${original}${original ? '\n' : ''}${codexText}`)
    : original.replace(removalPattern, '');
  if (next === original) { say('ok', codexFile, `Codex block already ${mode === 'on' ? 'installed' : 'absent'}`); return; }
  if (!plan) { fs.mkdirSync(codexHome, { recursive: true }); fs.writeFileSync(codexFile, next); }
  say(plan ? 'would-update' : 'updated', codexFile, `Codex block ${mode}`);
}
if (codexOption || uninstall) configureCodex(uninstall ? 'off' : codexOption);

if (!plan) {
  const manifest = path.join(process.env.NIGHTLY_EVOLUTION_HOME || path.join(home, '.config', 'nightly-evolution'), 'install.json');
  fs.mkdirSync(path.dirname(manifest), { recursive: true });
  fs.writeFileSync(manifest, `${JSON.stringify({ at: new Date().toISOString(), repo: REPO_ROOT, uninstall, agents: agents.map((a) => ({ id: a.id, targets: a.targets, coveredBy: a.coveredBy })), links: results.filter((r) => ['linked', 'would-link', 'ok', 'removed'].includes(r.status)), pruned: results.filter((r) => ['pruned', 'would-prune'].includes(r.status)), routerHook: results.filter((r) => r.what.includes('settings.json')), codexBlock: results.filter((r) => r.what.endsWith('AGENTS.md')), results }, null, 2)}\n`);
}
const conflicts = results.filter((r) => r.status === 'conflict').length;
process.stdout.write(`\n${skills.length} skill(s), ${agents.length} agent(s), ${conflicts} conflict(s).${plan ? ' Dry run: nothing changed.' : ''}\n`);
process.exitCode = conflicts ? 2 : 0;
