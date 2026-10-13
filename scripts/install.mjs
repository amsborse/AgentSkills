#!/usr/bin/env node
// Idempotent installer: links each skill in this repository into every detected agent's
// user skill directory. Never overwrites a real directory or a link that points elsewhere.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO_ROOT, createLink, detectAgents, linkState, removeLink, skillDirs } from './lib/agents.mjs';

const args = new Set(process.argv.slice(2));
const plan = args.has('--dry-run');
const uninstall = args.has('--uninstall');
const home = process.env.AGENT_SKILLS_HOME_OVERRIDE || os.homedir();
const results = [];
const say = (status, what, detail = '') => {
  results.push({ status, what, detail });
  process.stdout.write(`${status.padEnd(9)} ${what}${detail ? `  (${detail})` : ''}\n`);
};

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
const agents = detectAgents(home);
if (!agents.length) say('skip', 'no supported agent (Claude Code, Codex, OpenCode, Cursor) detected');
for (const agent of agents) {
  if (agent.coveredBy) say('covered', `${agent.name}`, `reads ${agent.coveredBy}`);
  for (const s of agent.skipped || []) say('skip', `${agent.name}: ${s}`);
  for (const dir of agent.targets) {
    for (const skill of skills) {
      const source = path.join(REPO_ROOT, skill);
      const link = path.join(dir, skill);
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
      } else say('conflict', `${agent.name}: ${link}`, `${state === 'occupied' ? 'a real directory exists' : 'links elsewhere'}; left untouched`);
    }
  }
}

if (!plan) {
  const manifest = path.join(process.env.NIGHTLY_EVOLUTION_HOME || path.join(home, '.config', 'nightly-evolution'), 'install.json');
  fs.mkdirSync(path.dirname(manifest), { recursive: true });
  fs.writeFileSync(manifest, `${JSON.stringify({ at: new Date().toISOString(), repo: REPO_ROOT, uninstall, agents: agents.map((a) => ({ id: a.id, targets: a.targets, coveredBy: a.coveredBy })), results }, null, 2)}\n`);
}
const conflicts = results.filter((r) => r.status === 'conflict').length;
process.stdout.write(`\n${skills.length} skill(s), ${agents.length} agent(s), ${conflicts} conflict(s).${plan ? ' Dry run: nothing changed.' : ''}\n`);
process.exitCode = conflicts ? 2 : 0;
