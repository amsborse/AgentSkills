#!/usr/bin/env node
// Installs the shared working rules (RULES.md) into each agent's global instruction file.
// Idempotent: adds one marked block per file, replaces it on re-run, removes it with --uninstall.
// Never edits text outside the marked block.
//
//   node install-defaults.mjs            install or refresh
//   node install-defaults.mjs --dry-run  show what would change
//   node install-defaults.mjs --uninstall
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BEGIN = '<!-- claude-defaults:begin -->';
const END = '<!-- claude-defaults:end -->';

const toSlash = (p) => p.split(path.sep).join('/');

// Each target: a global instruction file and the block to put in it.
// Claude Code's @-import works reliably with a home-relative path (~/agent-skills/...) and not with
// paths that contain spaces. Use that form when the same file is reachable through ~/agent-skills.
export function importPath(rules, home) {
  const abs = path.resolve(rules);
  const repoRoot = path.resolve(HERE, '..');
  const rel = path.relative(repoRoot, abs);
  const viaHome = path.join(home, 'agent-skills', rel);
  try {
    if (!rel.startsWith('..') && fs.existsSync(viaHome) && fs.realpathSync(viaHome) === fs.realpathSync(abs)) {
      return '~/' + toSlash(path.join('agent-skills', rel));
    }
  } catch { /* fall through to the absolute path */ }
  return toSlash(abs);
}

export function targets(env = process.env, home = os.homedir(), rules = path.join(HERE, 'RULES.md')) {
  const rulesPath = importPath(rules, home);
  const claudeHome = env.CLAUDE_HOME || path.join(home, '.claude');
  const codexHome = env.CODEX_HOME || path.join(home, '.codex');
  return [
    {
      id: 'claude',
      file: path.join(claudeHome, 'CLAUDE.md'),
      // Claude Code loads @-imports from its global memory file.
      block: `Shared working rules (ELI5 replies, aliases QQ/ACC/DRY, token habits): @${rulesPath}`,
      requireDir: claudeHome,
    },
    {
      id: 'codex',
      file: path.join(codexHome, 'AGENTS.md'),
      block: `Shared working rules: read ${toSlash(path.resolve(rules))} before starting work and follow it (plain-English replies, aliases QQ/ACC/DRY, token habits).`,
      requireDir: codexHome,
    },
  ];
}

export function wrap(block) {
  return `${BEGIN}\n${block}\n${END}`;
}

// Returns the new file text for a target. Pure, so it can be tested without touching disk.
export function applyBlock(existing, block, { remove = false } = {}) {
  const pattern = new RegExp(`${BEGIN}[\\s\\S]*?${END}\\n?`);
  const hasBlock = pattern.test(existing);
  // Also drop the blank line this script added before the block, so uninstall restores the original text.
  const withLead = new RegExp(`\\n?${BEGIN}[\\s\\S]*?${END}\\n?`);
  if (remove) return hasBlock ? existing.replace(withLead, '') : existing;
  const wrapped = wrap(block) + '\n';
  if (hasBlock) return existing.replace(pattern, wrapped);
  const sep = existing.length === 0 || existing.endsWith('\n') ? '' : '\n';
  return existing + sep + (existing.length ? '\n' : '') + wrapped;
}

export function run(argv, opts = {}) {
  const env = opts.env || process.env;
  const home = opts.home || os.homedir();
  const dryRun = argv.includes('--dry-run');
  const uninstall = argv.includes('--uninstall');
  const log = opts.log || ((s) => console.log(s));
  const results = [];
  for (const t of targets(env, home, opts.rules)) {
    const exists = fs.existsSync(t.file);
    if (!exists && uninstall) { results.push({ id: t.id, status: 'absent' }); continue; }
    if (!exists && !fs.existsSync(t.requireDir)) { results.push({ id: t.id, status: 'skipped (agent not installed)' }); continue; }
    const before = exists ? fs.readFileSync(t.file, 'utf8') : '';
    const after = applyBlock(before, t.block, { remove: uninstall });
    if (after === before) { results.push({ id: t.id, status: 'unchanged' }); continue; }
    if (!dryRun) {
      fs.mkdirSync(path.dirname(t.file), { recursive: true });
      if (exists) fs.writeFileSync(t.file + '.bak-claude-defaults', before);
      fs.writeFileSync(t.file, after);
    }
    results.push({ id: t.id, status: (dryRun ? 'would ' : '') + (uninstall ? 'remove block' : 'write block'), file: t.file });
  }
  for (const r of results) log(`${r.id}: ${r.status}${r.file ? ' ' + r.file : ''}`);
  return results;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { run(process.argv.slice(2)); }
  catch (err) { console.error('install-defaults: ' + err.message); process.exit(1); }
}
