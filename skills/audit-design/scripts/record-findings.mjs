#!/usr/bin/env node
// Append creative findings to the ledger that night-evolve-skills reads, or summarize it.
//   record-findings.mjs --report .visual/after/report.json --skill revamp-ui [--technique magnetic-hover] [--outcome open]
//   record-findings.mjs --kind success --skill add-interactions --note "spring press feedback approved by owner"
//   record-findings.mjs --summary [--min 2] [--json]
// Ledger: $CREATIVE_LEDGER or ~/.agent-skills/creative/findings.jsonl (override with --ledger).
import fs from 'node:fs';
import path from 'node:path';
import { defaultLedger, entriesFromReport, manualEntry, parseLedger, patterns } from './lib/ledger.mjs';

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d = null) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };

function fail(msg) { process.stderr.write(`record-findings: ${msg}\n`); process.exit(1); }

if (flag('help') || !argv.length) {
  process.stdout.write(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 6).map((l) => l.replace(/^\/\/ ?/, '')).join('\n') + '\n');
  process.exit(argv.length ? 0 : 1);
}

const ledger = opt('ledger', defaultLedger());

if (flag('summary')) {
  if (!fs.existsSync(ledger)) fail(`no ledger at ${ledger}`);
  const { entries, errors } = parseLedger(fs.readFileSync(ledger, 'utf8'));
  for (const e of errors) process.stderr.write(`record-findings: ${ledger} ${e}\n`);
  const found = patterns(entries, Number(opt('min', 2)));
  if (flag('json')) process.stdout.write(`${JSON.stringify({ ledger, entries: entries.length, patterns: found }, null, 2)}\n`);
  else {
    process.stdout.write(`${entries.length} entries in ${ledger}; ${found.length} repeated pattern(s)\n`);
    for (const p of found) process.stdout.write(`- ${p.skill} ${p.kind} ${p.check}: ${p.count}x (${p.open} open) e.g. ${p.examples[0]}\n`);
  }
  process.exit(errors.length ? 2 : 0);
}

let entries;
try {
  if (opt('report')) {
    const file = opt('report');
    if (!fs.existsSync(file)) fail(`report not found: ${file}`);
    entries = entriesFromReport(JSON.parse(fs.readFileSync(file, 'utf8')), { skill: opt('skill'), technique: opt('technique'), outcome: opt('outcome', 'open') });
  } else {
    entries = [manualEntry({ kind: opt('kind'), skill: opt('skill'), note: opt('note'), technique: opt('technique'), outcome: opt('outcome', 'open') })];
  }
} catch (e) { fail(e.message); }

fs.mkdirSync(path.dirname(ledger), { recursive: true });
fs.appendFileSync(ledger, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
process.stdout.write(`recorded ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} in ${ledger}\n`);
