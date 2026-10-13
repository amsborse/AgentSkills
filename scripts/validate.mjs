#!/usr/bin/env node
// Validates skill structure against the Agent Skills spec as Claude Code, Codex and OpenCode
// apply it, checks the engine, runs the test suite, verifies installed links, and validates
// every registered repository policy.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO_ROOT, detectAgents, linkState, skillDirs } from './lib/agents.mjs';
import { parseYaml } from '../nightly-evolution/scripts/lib/yaml.mjs';

const quick = process.argv.includes('--quick');
let failures = 0;
const ok = (msg) => process.stdout.write(`  ok    ${msg}\n`);
const bad = (msg) => {
  failures++;
  process.stdout.write(`  FAIL  ${msg}\n`);
};
const warn = (msg) => process.stdout.write(`  warn  ${msg}\n`);

process.stdout.write('Skill structure\n');
for (const skill of skillDirs()) {
  const dir = path.join(REPO_ROOT, skill);
  const text = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!m) {
    bad(`${skill}: SKILL.md must start with YAML frontmatter`);
    continue;
  }
  let fm;
  try {
    fm = parseYaml(m[1]);
  } catch (e) {
    bad(`${skill}: frontmatter does not parse: ${e.message}`);
    continue;
  }
  if (fm.name !== skill) bad(`${skill}: name "${fm.name}" must equal the directory name`);
  else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fm.name) || fm.name.length > 64) bad(`${skill}: name must be lowercase-hyphenated, <= 64 chars`);
  else ok(`${skill}: name`);
  const d = String(fm.description || '');
  if (!d || d.length > 1024) bad(`${skill}: description must be 1-1024 chars (has ${d.length})`);
  else ok(`${skill}: description (${d.length} chars)`);
  const allowed = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);
  const extra = Object.keys(fm).filter((k) => !allowed.has(k));
  if (extra.length) bad(`${skill}: non-portable frontmatter keys ${extra.join(', ')} (put them under metadata)`);
  if (fm.metadata && Object.values(fm.metadata).some((v) => typeof v !== 'string')) bad(`${skill}: metadata values must be strings`);
  const lines = text.split('\n').length;
  if (lines > 500) bad(`${skill}: SKILL.md has ${lines} lines; keep it under 500 and move detail to supporting files`);
  else ok(`${skill}: SKILL.md ${lines} lines`);
  const refs = [...new Set([...text.matchAll(/`([a-z0-9-]+\.md)`/g)].map((x) => x[1]))].filter((r) => r !== 'SKILL.md' && !/^[A-Z]/.test(r));
  const missing = refs.filter((r) => !fs.existsSync(path.join(dir, r)));
  if (missing.length) bad(`${skill}: referenced files missing: ${missing.join(', ')}`);
  else ok(`${skill}: ${refs.length} supporting files present`);
}

process.stdout.write('\nEngine\n');
const scripts = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory() && !['node_modules', '.git'].includes(e.name)) walk(p);
    else if (e.isFile() && /\.mjs$/.test(e.name)) scripts.push(p);
  }
};
walk(REPO_ROOT);
for (const s of scripts) {
  const r = spawnSync(process.execPath, ['--check', s], { encoding: 'utf8' });
  if (r.status !== 0) bad(`syntax: ${path.relative(REPO_ROOT, s)}: ${r.stderr.split('\n')[0]}`);
}
ok(`${scripts.length} modules pass node --check`);
const bytes = scripts.map((s) => fs.readFileSync(s)).find((b) => b.length > 3 && b[1] === 0 && b[3] === 0);
if (bytes) bad('a module is UTF-16 encoded; Node requires UTF-8');

if (!quick) {
  process.stdout.write('\nTests\n');
  const t = spawnSync(process.execPath, ['--test', 'tests/*.test.mjs'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const summary = `${t.stdout}`.split('\n').filter((l) => /^ℹ (tests|pass|fail)/.test(l)).join(', ');
  if (t.status === 0) ok(`node --test: ${summary}`);
  else bad(`node --test failed: ${summary}\n${t.stdout.split('\n').filter((l) => /✖|not ok|Error/.test(l)).slice(0, 20).join('\n')}`);
}

process.stdout.write('\nInstallation\n');
for (const agent of detectAgents()) {
  if (agent.coveredBy) {
    const allOk = skillDirs().every((s) => linkState(path.join(agent.coveredBy, s), path.join(REPO_ROOT, s)) === 'ok');
    (allOk ? ok : bad)(`${agent.name}: discovers skills via ${agent.coveredBy}`);
    continue;
  }
  for (const dir of agent.targets) {
    for (const s of skillDirs()) {
      const link = path.join(dir, s);
      const state = linkState(link, path.join(REPO_ROOT, s));
      if (state === 'ok' && fs.existsSync(path.join(link, 'SKILL.md'))) ok(`${agent.name}: ${link}`);
      else if (state === 'missing') bad(`${agent.name}: ${link} not installed (run scripts/install.sh)`);
      else warn(`${agent.name}: ${link} is ${state}; installer leaves it untouched`);
    }
  }
}

process.stdout.write('\nRepository policies\n');
const home = process.env.NIGHTLY_EVOLUTION_HOME || path.join(os.homedir(), '.config', 'nightly-evolution');
let repos = {};
try {
  repos = JSON.parse(fs.readFileSync(path.join(home, 'repos.json'), 'utf8')).repos;
} catch {
  warn('no registered repositories yet (run `evolve init --repo <path>`)');
}
for (const main of Object.keys(repos)) {
  if (!fs.existsSync(main)) {
    warn(`${main}: registered but missing`);
    continue;
  }
  const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'nightly-evolution', 'scripts', 'evolve.mjs'), 'validate', '--repo', main], { encoding: 'utf8' });
  let res = {};
  try {
    res = JSON.parse(r.stdout);
  } catch {
    res = { ok: false, errors: [r.stderr.trim()] };
  }
  if (res.ok) ok(`${repos[main].name}: ${main}/.evolution/policy.yaml${res.warnings?.length ? ` (${res.warnings.length} warnings)` : ''}`);
  else bad(`${repos[main].name}: ${(res.errors || []).join('; ')}`);
}

process.stdout.write(`\n${failures ? `${failures} failure(s)` : 'All checks passed'}\n`);
process.exitCode = failures ? 1 : 0;
