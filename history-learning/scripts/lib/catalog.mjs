import fs from 'node:fs';
import path from 'node:path';
import { projectOf } from './projects.mjs';
import { HOME, isDir, readJson, stateDir, writeJson, writeText } from './util.mjs';

const frontmatter = (text) => {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const get = (k) => {
    const r = new RegExp(`^${k}:\\s*(?:>-?|\\|)?\\s*([\\s\\S]*?)(?=^\\w[\\w-]*:|$(?![\\s\\S]))`, 'm').exec(m?.[1] || '');
    return r ? r[1].replace(/\s+/g, ' ').replace(/^["']|["']$/g, '').trim() : '';
  };
  return { name: get('name'), description: get('description') };
};

const real = (p) => {
  try {
    return fs.realpathSync.native(p).toLowerCase();
  } catch {
    return p.toLowerCase();
  }
};

/**
 * Every skill and standing instruction file an agent on this machine can load, so proposals
 * improve what exists instead of duplicating it. Linked copies are collapsed by real path.
 */
export function buildCatalog() {
  const inv = readJson(path.join(stateDir(), 'inventory.json'), { sessions: [] });
  const projectRoots = new Set();
  for (const s of inv.sessions) {
    const p = projectOf(s.cwd);
    if (p.root && !p.name.startsWith('(') && fs.existsSync(path.join(p.root, '.git'))) projectRoots.add(p.root);
  }
  const skillRoots = [];
  for (const d of fs.readdirSync(HOME)) {
    if (/^\.claude(-[\w-]+)?$/.test(d)) skillRoots.push({ dir: path.join(HOME, d, 'skills'), scope: `global (${d})` });
  }
  skillRoots.push({ dir: path.join(HOME, '.codex', 'skills'), scope: 'global (.codex)' }, { dir: path.join(HOME, '.agents', 'skills'), scope: 'global (.agents)' }, { dir: path.join(HOME, '.cursor', 'skills'), scope: 'global (.cursor)' }, { dir: path.join(HOME, '.config', 'opencode', 'skills'), scope: 'global (opencode)' });
  for (const r of projectRoots) for (const sub of ['.agents/skills', '.claude/skills', '.cursor/skills', '.codex/skills']) skillRoots.push({ dir: path.join(r, sub), scope: `project:${path.basename(r)}` });

  const seen = new Set();
  const skills = [];
  const walk = (dir, scope, depth = 0) => {
    if (!isDir(dir) || depth > 3) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (!(e.isDirectory() || e.isSymbolicLink()) || e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const md = path.join(p, 'SKILL.md');
      if (fs.existsSync(md)) {
        const key = real(p);
        if (seen.has(key)) continue;
        seen.add(key);
        const text = fs.readFileSync(md, 'utf8');
        const fm = frontmatter(text);
        skills.push({ name: fm.name || e.name, description: fm.description.slice(0, 300), scope, path: p, lines: text.split('\n').length, linkedFrom: real(p) !== p.toLowerCase() ? real(p) : null });
      } else walk(p, scope, depth + 1);
    }
  };
  for (const r of skillRoots) walk(r.dir, r.scope);

  const instructions = [];
  const instr = (p, scope) => {
    if (fs.existsSync(p) && !seen.has(real(p))) {
      seen.add(real(p));
      instructions.push({ path: p, scope, lines: fs.readFileSync(p, 'utf8').split('\n').length });
    }
  };
  for (const d of fs.readdirSync(HOME)) if (/^\.claude(-[\w-]+)?$/.test(d)) instr(path.join(HOME, d, 'CLAUDE.md'), `global (${d})`);
  instr(path.join(HOME, '.codex', 'AGENTS.md'), 'global (.codex)');
  instr(path.join(HOME, '.config', 'opencode', 'AGENTS.md'), 'global (opencode)');
  for (const r of projectRoots) {
    for (const f of ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.cursorrules']) instr(path.join(r, f), `project:${path.basename(r)}`);
    const rules = path.join(r, '.cursor', 'rules');
    if (isDir(rules)) for (const f of fs.readdirSync(rules)) if (/\.mdc?$/.test(f)) instr(path.join(rules, f), `project:${path.basename(r)}`);
  }
  const catalog = { generatedAt: new Date().toISOString(), projectRoots: [...projectRoots], skills, instructions };
  writeJson(path.join(stateDir(), 'catalog.json'), catalog);
  const md = [
    '# Existing skills and instructions',
    '',
    `${skills.length} skills, ${instructions.length} instruction files.`,
    '',
    '| Skill | Scope | Lines | Description |',
    '| --- | --- | --- | --- |',
    ...skills.map((s) => `| ${s.name} | ${s.scope} | ${s.lines} | ${s.description.replace(/\|/g, '\\|').slice(0, 160)} |`),
    '',
    '| Instruction file | Scope | Lines |',
    '| --- | --- | --- |',
    ...instructions.map((i) => `| \`${i.path}\` | ${i.scope} | ${i.lines} |`),
  ].join('\n');
  writeText(path.join(stateDir(), 'reports', 'catalog.md'), md);
  return catalog;
}
