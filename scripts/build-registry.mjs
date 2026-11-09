#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, listValue } from './lib/frontmatter.mjs';
import { skillDirs } from './lib/agents.mjs';

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const check = args.includes('--check');
const rootIndex = args.indexOf('--root');
const root = path.resolve(rootIndex >= 0 ? args[rootIndex + 1] : scriptRoot);
const registryRoot = path.join(root, 'registry');
// Same skill set the installer links: skills/* plus the root skills kept for outside callers.
const skills = skillDirs(root).map((rel) => {
  const name = path.posix.basename(rel);
  const dir = path.join(root, ...rel.split('/'));
  const fm = parseFrontmatter(fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8'));
  const workflowsDir = path.join(dir, 'workflows');
  // A workflow is a .md file or a folder of files (unslop/, cinematic-plate/).
  const workflows = fs.existsSync(workflowsDir) ? fs.readdirSync(workflowsDir, { withFileTypes: true }).filter((e) => e.isDirectory() || e.name.endsWith('.md')).map((e) => `${rel}/workflows/${e.name}`).sort() : [];
  const metadata = fm.metadata || {};
  return {
    name: String(fm.name || name), path: `skills/${name}`, description: String(fm.description || ''),
    aliases: listValue(metadata.aliases), keywords: listValue(metadata.keywords), composes: listValue(metadata.composes),
    requires: listValue(metadata.requires).map((capability) => ({ capability: capability.replace(/\?$/, ''), optional: capability.endsWith('?') })),
    risk: String(metadata.risk || ''), workflows,
  };
});
const capabilities = {};
for (const skill of skills) for (const req of skill.requires) {
  const entry = capabilities[req.capability] ||= { requiredBy: [], optionalFor: [] };
  entry[req.optional ? 'optionalFor' : 'requiredBy'].push(skill.name);
}
for (const entry of Object.values(capabilities)) { entry.requiredBy.sort(); entry.optionalFor.sort(); }
const orderedCapabilities = Object.fromEntries(Object.entries(capabilities).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
const outputs = new Map([
  [path.join(registryRoot, 'skills.json'), `${JSON.stringify({ version: 1, skills }, null, 2)}\n`],
  [path.join(registryRoot, 'capabilities.json'), `${JSON.stringify({ version: 1, capabilities: orderedCapabilities }, null, 2)}\n`],
]);
let drift = false;
for (const [file, content] of outputs) {
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (current !== content) {
    if (check) { drift = true; process.stderr.write(`out of date: ${path.relative(root, file)}\n`); }
    else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); }
  }
}
if (drift) process.exitCode = 1;
