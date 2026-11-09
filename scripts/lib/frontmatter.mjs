import { parseYaml } from '../../nightly-evolution/scripts/lib/yaml.mjs';

export function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) throw new Error('SKILL.md must start with YAML frontmatter');
  const value = parseYaml(match[1]);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('frontmatter must be a map');
  return value;
}

export function listValue(value) {
  return String(value ?? '').split(',').map((v) => v.trim()).filter(Boolean);
}
