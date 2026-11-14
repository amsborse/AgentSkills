#!/usr/bin/env node
// Blind before/after pairs for the improve-visuals judge.
//   pair  --before DIR --after DIR --out DIR [--seed N]
//         Copies matching PNGs as NNN-A.png / NNN-B.png in random order and writes pairs.md for
//         the judge. The answer key goes next to the folder (DIR.key.json), outside what the judge
//         reads. Screenshots on one side only are listed, not dropped silently.
//   tally --pairs DIR --verdicts FILE
//         Maps the judge's A/B verdicts back to before/after and prints the counts as JSON.
// Exit codes: 0 ok, 1 usage or input error, 2 nothing to compare.
import fs from 'node:fs';
import path from 'node:path';
import { planPairs, tally, renderPairsList } from './lib/pairs.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const opt = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const keyPath = (dir) => `${path.resolve(dir)}.key.json`;
const fail = (msg, code = 1) => {
  process.stderr.write(`blind-pairs: ${msg}\n`);
  process.exit(code);
};

function pngs(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.png$/i.test(e.name)) out.push(path.relative(dir, p).split(path.sep).join('/'));
    }
  };
  walk(dir);
  return out;
}

if (cmd === 'pair') {
  const before = opt('before'), after = opt('after'), out = opt('out');
  if (!before || !after || !out) fail('usage: pair --before DIR --after DIR --out DIR [--seed N]');
  for (const d of [before, after]) if (!fs.existsSync(d)) fail(`folder not found: ${d}`);
  const seed = opt('seed') !== undefined ? Number(opt('seed')) : Date.now() % 2147483647;
  if (!Number.isFinite(seed)) fail('--seed must be a number');
  const plan = planPairs(pngs(before), pngs(after), seed);
  if (!plan.pairs.length) fail('no screenshot exists on both sides; capture both with the same settings', 2);
  fs.mkdirSync(out, { recursive: true });
  for (const p of plan.pairs) {
    const src = (side) => path.join(side === 'before' ? before : after, ...p.rel.split('/'));
    fs.copyFileSync(src(p.a), path.join(out, `${p.id}-A.png`));
    fs.copyFileSync(src(p.a === 'before' ? 'after' : 'before'), path.join(out, `${p.id}-B.png`));
  }
  fs.writeFileSync(path.join(out, 'pairs.md'), renderPairsList(plan));
  fs.writeFileSync(keyPath(out), `${JSON.stringify(plan, null, 2)}\n`);
  process.stdout.write(`${plan.pairs.length} pairs in ${out}\n`);
  if (plan.beforeOnly.length) process.stderr.write(`only in before (not judged): ${plan.beforeOnly.join(', ')}\n`);
  if (plan.afterOnly.length) process.stderr.write(`only in after (not judged): ${plan.afterOnly.join(', ')}\n`);
} else if (cmd === 'tally') {
  const dir = opt('pairs'), file = opt('verdicts');
  if (!dir || !file) fail('usage: tally --pairs DIR --verdicts FILE');
  let key, verdicts;
  try {
    key = JSON.parse(fs.readFileSync(keyPath(dir), 'utf8'));
    verdicts = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    fail(e.message);
  }
  let result;
  try {
    result = tally(key, verdicts);
  } catch (e) {
    fail(e.message);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.counts.unknown) process.stderr.write(`${result.counts.unknown} pairs have no verdict: counted as unknown\n`);
} else {
  fail('usage: blind-pairs.mjs pair|tally ...');
}
