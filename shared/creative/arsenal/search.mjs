#!/usr/bin/env node
// Search the Arsenal library before building UI, motion or visuals.
//   node search.mjs "crosshair cursor"            ranked matches with file:line and import line
//   node search.mjs --root <arsenal> "engraving"  explicit checkout (else ARSENAL_DIR, ~/arsenal)
//   node search.mjs --json "draw in"              machine-readable
//   node search.mjs --list                        every package and its exports
// Exits 2 when no Arsenal checkout is found, so a skill notices instead of silently building anew.
import { buildIndex, importHint, resolveArsenalRoot, search } from './lib/arsenal-index.mjs';

const args = process.argv.slice(2);
const rootIndex = args.indexOf('--root');
const explicitRoot = rootIndex >= 0 ? args.splice(rootIndex, 2)[1] : undefined;
const json = args.includes('--json');
const list = args.includes('--list');
const query = args.filter((arg) => !arg.startsWith('--')).join(' ');

const root = resolveArsenalRoot({ root: explicitRoot });
if (!root) {
  process.stderr.write('arsenal: no checkout found. Pass --root <dir>, set ARSENAL_DIR, or link ~/arsenal to it.\n');
  process.exit(2);
}
const items = buildIndex(root);

if (list) {
  const byPackage = new Map();
  for (const item of items) {
    if (item.type === 'readme') continue;
    byPackage.set(item.package, [...(byPackage.get(item.package) || []), item]);
  }
  if (json) {
    process.stdout.write(`${JSON.stringify({ root, packages: Object.fromEntries(byPackage) }, null, 2)}\n`);
  } else {
    for (const [pkg, entries] of byPackage) {
      const names = entries.filter((entry) => entry.type !== 'package').map((entry) => entry.name);
      process.stdout.write(`${pkg}: ${names.join(', ') || '(no exports)'}\n`);
    }
  }
  process.exit(0);
}

if (!query) {
  process.stderr.write('usage: search.mjs [--root dir] [--json] <query> | --list\n');
  process.exit(1);
}

const hits = search(items, query);
if (json) {
  const out = { root, query, hits: hits.map((hit) => ({ ...hit, import: importHint(hit) })) };
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
} else if (!hits.length) {
  process.stdout.write(`No Arsenal match for "${query}" in ${root}. Build it, then register it (shared/creative/arsenal.md).\n`);
} else {
  for (const hit of hits) {
    process.stdout.write(`${hit.type.padEnd(7)} ${hit.package}  ${hit.name}  ${hit.file}:${hit.line}\n`);
    if (hit.summary) process.stdout.write(`        ${hit.summary.slice(0, 160)}\n`);
    process.stdout.write(`        ${importHint(hit)}\n`);
  }
}
