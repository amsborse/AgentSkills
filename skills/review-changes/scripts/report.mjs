#!/usr/bin/env node
// Rebuild report.html from ui.json (written by capture.mjs) and/or backend.json (change cards).
// node report.mjs --out <dir> [--ui <dir>/ui.json] [--backend backend.json] [--title "..."]
//   [--before-label main] [--after-label my-branch]
// Rejects backend cards whose confidence is not backed by evidence (exit 1).
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { renderReport, validateBackend } from './lib/review.mjs';

const { values: o } = parseArgs({
  options: {
    out: { type: 'string' }, ui: { type: 'string' }, backend: { type: 'string' },
    title: { type: 'string', default: 'Change review' },
    'before-label': { type: 'string', default: 'before' }, 'after-label': { type: 'string', default: 'after' },
  },
});
if (!o.out || (!o.ui && !o.backend)) {
  console.error('usage: node report.mjs --out <dir> [--ui ui.json] [--backend backend.json]');
  process.exit(1);
}
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const ui = o.ui ? read(o.ui) : null;
const backend = o.backend ? read(o.backend) : null;
if (backend) {
  const problems = validateBackend(backend);
  if (problems.length) {
    console.error(`backend cards rejected:\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
}
fs.mkdirSync(o.out, { recursive: true });
const file = path.join(path.resolve(o.out), 'report.html');
const generated = new Date().toISOString().slice(0, 16).replace('T', ' ');
fs.writeFileSync(file, renderReport({ title: o.title, base: o['before-label'], head: o['after-label'], generated, ui, backend }));
console.log(`report: ${file}`);
