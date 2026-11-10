#!/usr/bin/env node
// Validates skill structure against the Agent Skills spec as Claude Code, Codex and OpenCode
// apply it, checks the engine, runs the test suite, verifies installed links, and validates
// every registered repository policy.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO_ROOT, detectAgents, linkState, ownedRepoLink, skillDirs } from './lib/agents.mjs';
import { parseFrontmatter, listValue } from './lib/frontmatter.mjs';

const quick = process.argv.includes('--quick');
let failures = 0;
const ok = (msg) => process.stdout.write(`  ok    ${msg}\n`);
const bad = (msg) => {
  failures++;
  process.stdout.write(`  FAIL  ${msg}\n`);
};
const warn = (msg) => process.stdout.write(`  warn  ${msg}\n`);

const skills = skillDirs();
const skillData = [];
let descriptionChars = 0;
const aliases = new Map();
process.stdout.write('Skill structure\n');
for (const skill of skills) {
  const dir = path.join(REPO_ROOT, ...skill.split('/'));
  const text = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
  let fm;
  try {
    fm = parseFrontmatter(text);
  } catch (e) {
    bad(`${skill}: frontmatter does not parse: ${e.message}`);
    continue;
  }
  if (fm.name !== path.posix.basename(skill)) bad(`${skill}: name "${fm.name}" must equal the directory name`);
  else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fm.name) || fm.name.length > 64) bad(`${skill}: name must be lowercase-hyphenated, <= 64 chars`);
  else ok(`${skill}: name`);
  const d = String(fm.description || '');
  descriptionChars += d.length;
  if (!d || d.length > 1024) bad(`${skill}: description must be 1-1024 chars (has ${d.length})`);
  else ok(`${skill}: description (${d.length} chars)`);
  const allowed = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);
  const extra = Object.keys(fm).filter((k) => !allowed.has(k));
  if (extra.length) bad(`${skill}: non-portable frontmatter keys ${extra.join(', ')} (put them under metadata)`);
  if (fm.metadata && Object.values(fm.metadata).some((v) => typeof v !== 'string')) bad(`${skill}: metadata values must be strings`);
  const metadata = fm.metadata || {};
  const ownAliases = listValue(metadata.aliases);
  if (!ownAliases.length) bad(`${skill}: metadata.aliases is required`);
  for (const alias of ownAliases) {
    const key = alias.toLowerCase().trim();
    if (aliases.has(key)) bad(`${skill}: alias "${alias}" is also used by ${aliases.get(key)}`);
    else aliases.set(key, skill);
  }
  if (!['low', 'medium', 'high'].includes(metadata.risk)) bad(`${skill}: metadata.risk must be low, medium or high`);
  skillData.push({ skill, fm, metadata, text, dir });
  const lines = text.split('\n').length;
  if (lines > 500) bad(`${skill}: SKILL.md has ${lines} lines; keep it under 500 and move detail to supporting files`);
  else ok(`${skill}: SKILL.md ${lines} lines`);
  const refs = [...new Set([...text.matchAll(/(?:shared\/|styles\/|workflows\/)[A-Za-z0-9_./-]+\.md/g)].map((x) => x[0]))];
  const missing = refs.filter((r) => !fs.existsSync(path.resolve(REPO_ROOT, /^(shared|styles)\//.test(r) ? r : path.join(skill, r))));
  if (missing.length) bad(`${skill}: referenced files missing: ${missing.join(', ')}`);
  else ok(`${skill}: ${refs.length} supporting files present`);
}

for (const { skill, metadata } of skillData) for (const composed of listValue(metadata.composes)) {
  if (!skills.some((s) => path.posix.basename(s) === composed)) bad(`${skill}: composes unknown skill "${composed}"`);
}
const sharedDir = path.join(REPO_ROOT, 'shared');
if (fs.existsSync(sharedDir)) for (const entry of fs.readdirSync(sharedDir, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.md')) ok(`shared/${entry.name}: present`);
}
const stylesDir = path.join(REPO_ROOT, 'styles');
if (fs.existsSync(stylesDir)) {
  const styleFiles = fs.readdirSync(stylesDir).filter((f) => f.endsWith('.md') && f !== 'README.md');
  const index = fs.existsSync(path.join(stylesDir, 'README.md')) ? fs.readFileSync(path.join(stylesDir, 'README.md'), 'utf8') : '';
  if (!index) bad('styles/README.md: missing (the add-on index)');
  for (const f of styleFiles) {
    const body = fs.readFileSync(path.join(stylesDir, f), 'utf8');
    const sections = ['Material and tokens', 'Signature visual', 'Motion character', 'Performance', 'Accessibility', 'Anti-patterns', 'Verify'];
    const absent = sections.filter((s) => !body.includes(`## ${s}`));
    if (absent.length) bad(`styles/${f}: missing sections ${absent.join(', ')}`);
    else if (!index.includes(`\`${f}\``)) bad(`styles/${f}: not listed in styles/README.md`);
    else ok(`styles/${f}: add-on complete`);
  }
}
const portabilityFiles = [...skills.map((s) => path.join(REPO_ROOT, ...s.split('/'), 'SKILL.md'))];
if (fs.existsSync(sharedDir)) portabilityFiles.push(...fs.readdirSync(sharedDir).filter((f) => f.endsWith('.md')).map((f) => path.join(sharedDir, f)));
if (fs.existsSync(stylesDir)) portabilityFiles.push(...fs.readdirSync(stylesDir).filter((f) => f.endsWith('.md')).map((f) => path.join(stylesDir, f)));
for (const file of portabilityFiles) if (/~\/\.claude\/skills\//i.test(fs.readFileSync(file, 'utf8'))) bad(`${path.relative(REPO_ROOT, file)}: non-portable ~/.claude/skills/ path`);
process.stdout.write(`Description budget: ${descriptionChars} characters (~${Math.ceil(descriptionChars / 4)} tokens)\n`);
if (descriptionChars > 16000) bad(`skill descriptions exceed 16000 characters (${descriptionChars})`);
else ok('skill descriptions within 16000 character budget');
const registryCheck = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'build-registry.mjs'), '--check'], { cwd: REPO_ROOT, encoding: 'utf8' });
if (registryCheck.status === 0) ok('registry is up to date');
else if (registryCheck.error) bad(`registry check could not start: ${registryCheck.error.message}`);
else bad(`registry is out of date${registryCheck.stderr?.trim() ? `: ${registryCheck.stderr.trim()}` : ''}`);

process.stdout.write('\nEngine\n');
const scripts = [];
let syntaxFailures = 0;
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
  if (r.status !== 0) { syntaxFailures++; bad(`syntax: ${path.relative(REPO_ROOT, s)}: ${r.stderr?.split('\n')[0] || r.error?.message || 'node --check failed'}`); }
}
if (!syntaxFailures) ok(`${scripts.length} modules pass node --check`);
const bytes = scripts.map((s) => fs.readFileSync(s)).find((b) => b.length > 3 && b[1] === 0 && b[3] === 0);
if (bytes) bad('a module is UTF-16 encoded; Node requires UTF-8');

if (!quick) {
  process.stdout.write('\nTests\n');
  const t = spawnSync(process.execPath, ['--test', 'tests/*.test.mjs'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const summary = `${t.stdout}`.split('\n').filter((l) => /^ℹ (tests|pass|fail)/.test(l)).join(', ');
  if (t.status === 0) ok(`node --test: ${summary}`);
  else bad(`node --test failed: ${summary}\n${t.stdout.split('\n').filter((l) => /✖|not ok|Error/.test(l)).slice(0, 20).join('\n')}`);
}

process.stdout.write('\nPrivacy (this repository is public)\n');
{
  const { makeRedactor } = await import('../history-learning/scripts/lib/redact.mjs');
  const redact = makeRedactor();
  const blocking = ['PRIVATE_KEY', 'JWT', 'API_KEY', 'URL_CREDENTIALS', 'BEARER', 'EMAIL', 'HOME', 'USERNAME'];
  const listing = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: REPO_ROOT, encoding: 'utf8' });
  if (listing.status !== 0) bad(`could not enumerate repository files for privacy check${listing.error ? `: ${listing.error.message}` : ''}`);
  const files = (listing.stdout || '').split('\n').filter((f) => f && !/\.(png|jpe?g|gif|webp|ico)$/i.test(f));
  let leaks = 0;
  for (const f of files) {
    let text;
    try {
      text = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
    } catch {
      continue;
    }
    const hits = redact(text.replace(/\b[\w.+-]+@(example\.(com|org)|users\.noreply\.github\.com|corp\.io)\b/g, '')).hits;
    // Test fixtures carry deliberately fake credentials to prove they are redacted.
    const found = blocking.filter((k) => hits[k] && !(f.startsWith('tests/') && !['HOME', 'USERNAME'].includes(k)));
    if (found.length) {
      leaks++;
      bad(`${f}: ${found.map((k) => `${k} x${hits[k]}`).join(', ')}`);
    }
  }
  if (listing.status === 0 && !leaks) ok(`${files.length} files free of credentials, emails, home paths and the local username`);
}

process.stdout.write('\nInstallation\n');
for (const agent of detectAgents(process.env.AGENT_SKILLS_HOME_OVERRIDE || os.homedir())) {
  for (const dir of [...agent.targets, ...(agent.migrated || [])]) {
    let entries = [];
    try { entries = fs.readdirSync(dir); } catch {}
    const stale = entries.filter((name) => ownedRepoLink(path.join(dir, name)) && !(agent.targets.includes(dir) && skills.some((s) => path.basename(s) === name)));
    if (stale.length) warn(`${agent.name}: stale repo links in ${dir}: ${stale.join(', ')}`);
  }
  if (agent.coveredBy) {
    const allOk = skillDirs().every((s) => linkState(path.join(agent.coveredBy, path.basename(s)), path.join(REPO_ROOT, ...s.split('/'))) === 'ok');
    (allOk ? ok : bad)(`${agent.name}: discovers skills via ${agent.coveredBy}`);
    continue;
  }
  for (const dir of agent.targets) {
    for (const s of skillDirs()) {
      const link = path.join(dir, path.basename(s));
      const state = linkState(link, path.join(REPO_ROOT, ...s.split('/')));
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
    res = { ok: false, errors: [r.stderr?.trim() || r.error?.message || 'policy validation could not start'] };
  }
  if (res.ok) ok(`${repos[main].name}: ${main}/.evolution/policy.yaml${res.warnings?.length ? ` (${res.warnings.length} warnings)` : ''}`);
  else bad(`${repos[main].name}: ${(res.errors || []).join('; ')}`);
}

process.stdout.write(`\n${failures ? `${failures} failure(s)` : 'All checks passed'}\n`);
process.exitCode = failures ? 1 : 0;
