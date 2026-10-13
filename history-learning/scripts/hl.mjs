#!/usr/bin/env node
// history-learning CLI. Reads agent conversation stores read-only, keeps every artifact in a
// private state directory outside any repository, and never calls a model itself.
import fs from 'node:fs';
import path from 'node:path';
import { SOURCE_IDS } from './lib/adapters/index.mjs';
import { buildCatalog } from './lib/catalog.mjs';
import { clusterEvidence, loadClusters, saveClusters } from './lib/cluster.mjs';
import { enabledSources, loadConsent, updateConsent } from './lib/consent.mjs';
import { buildDigest, markSynthesized } from './lib/digest.mjs';
import { allEvidence, extract } from './lib/extract.mjs';
import { buildInventory, coverageReport } from './lib/inventory.mjs';
import { learningReport } from './lib/report.mjs';
import { ruleSupport, writeEvidence } from './lib/support.mjs';
import { parseArgs, readJson, stateDir, writeJson, writeText } from './lib/util.mjs';

const USAGE = `Usage: hl <command> [options]

Discovery (metadata only, no consent needed)
  inventory                       scan every store; write inventory.json + reports/coverage.md
  catalog                         list existing skills and instruction files (dedupe target)

Consent (everything starts disabled)
  consent                         show what is enabled
  consent --enable a,b --disable c   sources: ${SOURCE_IDS.join(', ')}
  consent --model allow|deny [--budget <tokens>]   allow a reviewing agent to read digests
  consent --redact "term1,term2"  extra terms to redact (client names, codenames, ...)

Learning (local, deterministic, incremental)
  extract [--full] [--limit n]    redacted signal statements from consented sources
  cluster                         deduplicate into clusters with confidence levels
  digest [--budget n] [--all]     budgeted per-category digest for a reviewing agent
  learn                           inventory + extract + cluster + digest (changed sessions only)
  evidence <cluster-id>           every redacted statement behind one cluster
  mark <cluster-id,...>|--digest  record clusters as synthesized (skipped by the next digest)
  support [--write]               recompute each proposed rule's sessions and confidence from
                                  its clusters; --write puts a counts-only evidence.md in each
                                  proposal's path
  report                          reports/learning.md: coverage, extraction, clusters, proposals
  forget [--source s]             delete derived evidence (all or one source); history untouched
  status                          state summary

State directory: ${stateDir()} (override with HISTORY_LEARNING_HOME)`;

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0] || 'help';
const out = (s) => process.stdout.write(`${s}\n`);
const err = (s) => process.stderr.write(`${s}\n`);
const list = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

async function runExtract() {
  const stats = await extract({ full: !!args.full, limit: args.limit ? Number(args.limit) : Infinity, log: err });
  out(`extract: ${stats.sessions} sessions read, ${stats.skippedUnchanged} unchanged, ${stats.turns} turns, ${stats.duplicateTurns} duplicate turns, ${stats.statements} statements`);
  out(`redactions: ${Object.entries(stats.redactions).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
  return stats;
}

function runCluster() {
  const res = clusterEvidence(allEvidence(enabledSources()));
  saveClusters(res);
  const by = {};
  for (const c of res.clusters) by[c.confidence.level] = (by[c.confidence.level] || 0) + 1;
  out(`cluster: ${res.clusters.length} clusters (${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(', ')}); ${res.templates} automated prompt templates dropped (${res.droppedTemplateStatements} statements)`);
  return res;
}

function runDigest() {
  const consent = loadConsent();
  if (!consent.model.allowed) throw new Error('model review is not consented; run `hl consent --model allow --budget <tokens>` first');
  const budget = Math.min(Number(args.budget) || consent.model.maxDigestTokens, consent.model.maxDigestTokens);
  const cl = loadClusters();
  if (!cl) throw new Error('no clusters; run `hl cluster` first');
  const d = buildDigest({ clusters: cl.clusters, evidence: allEvidence(enabledSources()), budget, includeKnown: !!args.all });
  out(`digest: ${d.included}/${d.eligible} eligible clusters, ~${d.used}/${budget} tokens, ${d.files.length} files in ${path.join(stateDir(), 'digest')}`);
  return d;
}

async function main() {
  switch (cmd) {
    case 'inventory': {
      const t = Date.now();
      err('Scanning stores (read-only, metadata only)');
      const inv = await buildInventory({ log: err });
      const unique = inv.sessions.filter((s) => !s.duplicateOf && s.status === 'ok');
      out(`${inv.sessions.length} session records, ${unique.length} unique readable, ${((Date.now() - t) / 1000).toFixed(1)}s`);
      out(`Report: ${path.join(stateDir(), 'reports', 'coverage.md')}`);
      break;
    }
    case 'catalog': {
      const c = buildCatalog();
      out(`${c.skills.length} skills, ${c.instructions.length} instruction files -> ${path.join(stateDir(), 'reports', 'catalog.md')}`);
      break;
    }
    case 'consent': {
      const change = args.enable || args.disable || args.model || args.budget !== undefined || args.redact;
      const c = change ? updateConsent({ enable: list(args.enable), disable: list(args.disable), model: args.model, budget: args.budget, redact: list(args.redact) }) : loadConsent();
      out(`sources enabled: ${enabledSources(c).join(', ') || 'none'}`);
      out(`model review: ${c.model.allowed ? `allowed, digest budget ${c.model.maxDigestTokens} tokens` : 'not allowed'}`);
      out(`extra redaction terms: ${c.redactTerms.length}`);
      break;
    }
    case 'extract':
      await runExtract();
      break;
    case 'cluster':
      runCluster();
      break;
    case 'digest':
      runDigest();
      break;
    case 'learn': {
      const inv = await buildInventory({ log: () => {} });
      out(`inventory: ${inv.sessions.length} session records`);
      await runExtract();
      runCluster();
      if (loadConsent().model.allowed) runDigest();
      else out('digest: skipped (model review not consented)');
      break;
    }
    case 'evidence': {
      const id = args._[1];
      const c = loadClusters()?.clusters.find((x) => x.id === id);
      if (!c) throw new Error(`no cluster ${id}`);
      const byId = new Map(allEvidence(enabledSources()).map((r) => [r.id, r]));
      out(`${c.id} ${c.category} ${c.confidence.level} (${c.confidence.basis}) sessions ${c.sessions} scope ${c.scope}`);
      for (const mid of c.members) {
        const r = byId.get(mid);
        if (r) out(`- [${r.ts?.slice(0, 10)} ${r.agent} ${r.project}${r.durable ? ' durable' : ''}${r.temporary ? ' temporary' : ''}] ${r.text}`);
      }
      break;
    }
    case 'mark': {
      const cl = loadClusters();
      const ids = args.digest ? readJson(path.join(stateDir(), 'digest', 'included.json'), []) : list(args._[1]);
      markSynthesized(ids, cl.clusters);
      out(`marked ${ids.length} clusters as synthesized`);
      break;
    }
    case 'support': {
      const skills = ruleSupport();
      let problems = 0;
      for (const s of skills) {
        out(`${s.action} ${s.skill} (${s.scope})`);
        for (const r of s.rules) {
          const p = r.support;
          const flags = [p.overstated ? `OVERSTATED (stated ${r.confidence})` : '', p.missing.length ? `MISSING ${p.missing.join(',')}` : ''].filter(Boolean);
          problems += flags.length;
          out(`  ${p.computed.level.padEnd(12)} s=${String(p.sessions).padEnd(3)} projects=${p.projects} agents=${p.agents.length} ${r.id || r.text.slice(0, 60)} ${flags.join(' ')}`);
        }
      }
      if (args.write) for (const f of writeEvidence(skills, (s) => s.path)) out(`wrote ${f}`);
      if (problems) {
        err(`${problems} rule(s) overstate confidence or cite unknown clusters`);
        process.exitCode = 1;
      }
      break;
    }
    case 'report': {
      const file = path.join(stateDir(), 'reports', 'learning.md');
      writeText(file, learningReport());
      const inv = readJson(path.join(stateDir(), 'inventory.json'));
      if (inv) {
        const processed = new Set(Object.keys(readJson(path.join(stateDir(), 'processed.json'), {})));
        writeText(path.join(stateDir(), 'reports', 'coverage.md'), coverageReport(inv, processed));
      }
      out(`Report: ${file}`);
      break;
    }
    case 'forget': {
      const dir = stateDir();
      if (args.source) {
        const src = String(args.source);
        fs.rmSync(path.join(dir, 'evidence', `${src}.jsonl`), { force: true });
        const processed = readJson(path.join(dir, 'processed.json'), {});
        const inv = readJson(path.join(dir, 'inventory.json'), { sessions: [] });
        const keys = new Set(inv.sessions.filter((s) => s.sourceId === src).map((s) => `${s.source}|${s.id}`));
        for (const k of Object.keys(processed)) if (keys.has(k)) delete processed[k];
        writeJson(path.join(dir, 'processed.json'), processed);
        const owners = readJson(path.join(dir, 'turn-keys.json'), {});
        for (const [k, v] of Object.entries(owners)) if (keys.has(v)) delete owners[k];
        writeJson(path.join(dir, 'turn-keys.json'), owners);
        out(`forgot evidence from ${src}; run \`hl cluster\` to rebuild clusters`);
      } else {
        for (const f of ['evidence', 'digest', 'reports', 'proposals', 'clusters.json', 'processed.json', 'turn-keys.json', 'synthesized.json', 'proposals.json', 'inventory.json', 'catalog.json']) fs.rmSync(path.join(dir, f), { recursive: true, force: true });
        out(`deleted all derived data in ${dir} (consent.json kept); conversation history was never modified`);
      }
      break;
    }
    case 'status': {
      const c = loadConsent();
      const inv = readJson(path.join(stateDir(), 'inventory.json'));
      const processed = readJson(path.join(stateDir(), 'processed.json'), {});
      const cl = loadClusters();
      out(`state: ${stateDir()}`);
      out(`inventory: ${inv ? `${inv.sessions.length} records at ${inv.generatedAt}` : 'none'}`);
      out(`sources enabled: ${enabledSources(c).join(', ') || 'none'}; model review: ${c.model.allowed ? `allowed (${c.model.maxDigestTokens} tokens)` : 'not allowed'}`);
      out(`processed sessions: ${Object.keys(processed).length}`);
      out(`clusters: ${cl ? `${cl.clusters.length} at ${cl.generatedAt}` : 'none'}`);
      break;
    }
    default:
      out(USAGE);
  }
}

main().catch((e) => {
  err(`hl: ${e.message}`);
  process.exitCode = 1;
});
