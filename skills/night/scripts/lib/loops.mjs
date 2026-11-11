// Loop discovery: any skill whose frontmatter has metadata.night-loop is a loop.
// See ../../references/loop-interface.md. Adding a loop is adding a folder; nothing here changes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, listValue } from '../../../../scripts/lib/frontmatter.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const NIGHT_SKILL_DIR = path.resolve(HERE, '..', '..');
export const REQUIRED_SECTIONS = ['Activation', 'Workflow', 'Evaluation', 'Stop conditions', 'Examples'];

export function searchRoots(repo, { home = os.homedir(), catalog = path.dirname(NIGHT_SKILL_DIR) } = {}) {
  const roots = [];
  if (repo) roots.push({ dir: path.join(repo, '.claude', 'skills'), origin: 'repo' }, { dir: path.join(repo, '.agents', 'skills'), origin: 'repo' });
  roots.push({ dir: catalog, origin: 'catalog' });
  if (home) roots.push({ dir: path.join(home, '.claude', 'skills'), origin: 'user' }, { dir: path.join(home, '.agents', 'skills'), origin: 'user' });
  return roots;
}

export function sectionsOf(body) {
  return [...body.matchAll(/^## +(.+?)\s*$/gm)].map((m) => m[1]);
}

export function readSkill(file, origin) {
  const text = fs.readFileSync(file, 'utf8');
  const fm = parseFrontmatter(text);
  const meta = fm.metadata || {};
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const skill = {
    name: String(fm.name || path.basename(path.dirname(file))),
    description: String(fm.description || ''),
    path: file,
    dir: path.dirname(file),
    origin,
    composes: listValue(meta.composes),
    risk: String(meta.risk || 'medium'),
  };
  if (meta['night-loop'] === undefined) return { ...skill, loop: false };
  const sections = sectionsOf(body);
  const minutes = Number(meta['night-minutes']);
  return {
    ...skill,
    loop: true,
    modes: listValue(meta['night-loop']),
    writes: String(meta['night-writes'] || 'code') === 'report' ? 'report' : 'code',
    minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : 25,
    signals: listValue(meta['night-signals']),
    keep_rule: ['tests-up', 'failures-down', 'metric-up'].includes(String(meta['night-keep'])) ? String(meta['night-keep']) : 'no-regression',
    missing_sections: REQUIRED_SECTIONS.filter((s) => !sections.includes(s)),
  };
}

/** Every skill visible from `repo`, first name wins, with loops flagged. Broken skills are reported, not hidden. */
export function discoverSkills(repo, opts = {}) {
  const seen = new Map();
  const errors = [];
  for (const { dir, origin } of searchRoots(repo, opts)) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, e.name, 'SKILL.md');
      if (!fs.existsSync(file)) continue;
      try {
        const s = readSkill(file, origin);
        if (!seen.has(s.name)) seen.set(s.name, s);
      } catch (error) {
        errors.push({ path: file, error: error.message });
      }
    }
  }
  const skills = [...seen.values()];
  return { loops: skills.filter((s) => s.loop), skills: skills.filter((s) => !s.loop), errors };
}

export function loopsForMode(loops, mode) {
  return loops.filter((l) => l.modes.includes(mode));
}

export function allModes(loops) {
  return [...new Set(loops.flatMap((l) => l.modes))].sort();
}
