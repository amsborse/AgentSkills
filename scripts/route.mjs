#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const normalize = (text) => String(text || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean).map(stem).join(' ');
// Light stemming: "es" only after s/x/z/ch/sh (fixes, matches), otherwise a plain "s"
// (features -> feature, not featur), so singular and plural forms meet.
function stem(t) {
  if (t.length <= 4) return t;
  if (/(?:ss|x|z|ch|sh)es$/.test(t)) return t.slice(0, -2);
  return t.replace(/(?:ing|ed|s)$/, '');
}
const tokens = (v) => normalize(v).split(' ').filter(Boolean);

export function route(prompt, registry, opts = {}) {
  const p = tokens(prompt);
  if (!p.length) return { matches: [], ambiguous: false };
  const phrase = ` ${p.join(' ')} `;
  const found = [];
  for (const skill of registry?.skills || []) {
    let score = 0;
    const reasons = [];
    for (const alias of skill.aliases || []) {
      const a = tokens(alias);
      if (a.length && phrase.includes(` ${a.join(' ')} `)) { const points = 5 + a.length - 1; score += points; reasons.push(`alias "${alias}" (+${points})`); }
    }
    for (const token of tokens(skill.name)) if (p.includes(token)) { score += 2; reasons.push(`name token "${token}" (+2)`); }
    const matched = new Set();
    for (const keyword of skill.keywords || []) for (const token of tokens(keyword)) if (p.includes(token)) matched.add(token);
    for (const token of [...matched].sort()) { score++; reasons.push(`keyword "${token}" (+1)`); }
    if (score >= (opts.threshold ?? 3)) found.push({ name: skill.name, score, reasons });
  }
  found.sort((a, b) => b.score - a.score || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const matches = found.slice(0, opts.max ?? 3);
  return { matches, ambiguous: matches.length > 1 && matches[0].score - matches[1].score <= 1 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const prompt = args.find((a) => !a.startsWith('--')) || '';
  const threshold = args.includes('--threshold') ? Number(args[args.indexOf('--threshold') + 1]) : undefined;
  const max = args.includes('--max') ? Number(args[args.indexOf('--max') + 1]) : undefined;
  const registryPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'registry', 'skills.json');
  try {
    const result = route(prompt, JSON.parse(fs.readFileSync(registryPath, 'utf8')), { threshold, max });
    if (args.includes('--json')) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else if (!result.matches.length) process.stdout.write('no skill matched\n');
    else for (const m of result.matches) process.stdout.write(`${m.name} (score: ${m.score}; ${m.reasons.join(', ')})\n`);
  } catch { process.stdout.write('no skill matched\n'); }
}
