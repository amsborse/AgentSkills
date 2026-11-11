#!/usr/bin/env node
// night: the CLI behind /night. Deterministic orchestration only: it plans, isolates, delegates to
// agent CLIs, verifies independently and reports. It never pushes, merges, deploys or publishes.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nowIso, writeAtomic, fmtMs, commandExists } from '../../../nightly-evolution/scripts/lib/util.mjs';
import { paths, repoRoot, ensureLayout, loadConfig, loadState, saveState, writeDefaultConfig, lockHolder, event, TERMINAL } from './lib/state.mjs';
import { detectEnv } from './lib/env.mjs';
import { discoverSkills, allModes } from './lib/loops.mjs';
import { plan, CONTROL_WORDS, BUILD_WORDS, buildTask } from './lib/plan.mjs';
import { runChecks, measureMetrics } from './lib/evaluate.mjs';
import { availableAgents, agentEnv } from './lib/agents.mjs';
import { runNight, evalCommands } from './lib/supervisor.mjs';
import { renderReport, writeReport } from './lib/report.mjs';
import { watch } from './lib/watchdog.mjs';
import * as ws from './lib/workspace.mjs';

const SELF = fileURLToPath(import.meta.url);
const HELP = `night: autonomous, verified improvement loops on an isolated branch

  night run [mode] [objective...]   start a run (mode: auto, build, a loop mode, or free text)
      --detach                      run in the background with a watchdog
      --agent NAME  --max-iterations N  --hours H  --dry-run
  night status [--json]             what is running, the queue, the last results
  night stop [--now]                finish the current iteration and stop (--now: kill agents, revert)
  night resume [--detach]           continue an interrupted run
  night report                      write and print the morning report
  night plan [mode] [objective...]  show the prioritized plan without running anything
  night loops                       list loop skills and the modes they serve
  night init                        create .night/config.yaml with the defaults
  night baseline                    run the evaluation commands once and print the results
  night task add|list|skip ...      edit the queue of a planned or stopped run
  night watchdog [--once] [--interval S]
  night doctor                      check git, agents, evaluation commands and disk

Modes: ${'{modes}'}. Anything else is read as an objective.`;

function parseArgs(argv) {
  const flags = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { pos.push(...argv.slice(i + 1)); break; }
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      const valued = ['agent', 'max-iterations', 'hours', 'interval', 'priority', 'loop'].includes(k);
      flags[k] = v ?? (valued ? argv[++i] : true);
    } else pos.push(a);
  }
  return { flags, pos };
}

const print = (s = '') => process.stdout.write(`${s}\n`);

function modeAndObjective(pos, loops) {
  const modes = new Set([...allModes(loops), 'auto', ...BUILD_WORDS]);
  const [first, ...rest] = pos;
  if (first && modes.has(first)) return { mode: first, objective: rest.join(' ').trim() };
  const objective = pos.join(' ').trim();
  return { mode: objective ? null : 'auto', objective };
}

function detach(root, args) {
  const p = ensureLayout(root);
  const log = fs.openSync(path.join(p.logs, 'supervisor.log'), 'a');
  const sup = spawn(process.execPath, [SELF, ...args.filter((a) => a !== '--detach')], { cwd: root, detached: true, stdio: ['ignore', log, log], windowsHide: true });
  sup.unref();
  const wlog = fs.openSync(path.join(p.logs, 'watchdog.log'), 'a');
  const wd = spawn(process.execPath, [SELF, 'watchdog', '--initial-delay'], { cwd: root, detached: true, stdio: ['ignore', wlog, wlog], windowsHide: true });
  wd.unref();
  fs.closeSync(log);
  fs.closeSync(wlog);
  print(`night: supervisor started in the background (pid ${sup.pid}), watchdog pid ${wd.pid}. \`night status\` to follow, \`night stop\` to end.`);
}

function statusText(root) {
  const s = loadState(root);
  if (!s) return 'night: no run yet. Start one with `night run`.';
  const holder = lockHolder(root);
  const alive = holder?.alive ? `supervisor pid ${holder.pid} alive` : TERMINAL.has(s.status) ? 'supervisor exited' : 'supervisor NOT running (watchdog or `night resume` restarts it)';
  const count = (st) => s.tasks.filter((t) => t.status === st).length;
  const lines = [
    `${s.run_id}: ${s.status}${s.stop_reason ? ` (${s.stop_reason})` : ''}, phase ${s.phase}, ${alive}`,
    `mode ${s.mode}${s.objective ? `: ${s.objective}` : ''}; branch ${s.branch || 'none'} at ${String(s.head_sha || s.base_sha).slice(0, 8)}`,
    `iterations ${s.iterations}/${s.max_iterations}, stagnant ${s.stagnant}, restarts ${s.restarts || 0}; deadline ${s.deadline}; heartbeat ${s.heartbeat_at}`,
    `tasks: ${count('running')} running, ${count('pending')} pending, ${count('kept')} kept, ${count('blocked')} blocked, ${count('done')} done`,
  ];
  for (const t of s.tasks.filter((x) => x.status === 'running')) lines.push(`  running: ${t.title} (attempt ${t.attempts})`);
  for (const t of s.tasks.filter((x) => x.status === 'pending').sort((a, b) => b.priority - a.priority).slice(0, 5)) lines.push(`  next: ${t.title} (priority ${t.priority})`);
  for (const w of (s.warnings || []).slice(0, 6)) lines.push(`  warning: ${w}`);
  return lines.join('\n');
}

async function main() {
  const [cmd = 'help', ...rest] = process.argv.slice(2);
  const { flags, pos } = parseArgs(rest);
  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    let modes = 'auto, build';
    try { modes = [...new Set(['auto', 'build', ...allModes(discoverSkills(repoRoot()).loops)])].join(', '); } catch { /* outside a repo */ }
    print(HELP.replace('{modes}', modes));
    return 0;
  }
  const root = repoRoot();
  if (!root) throw Object.assign(new Error('not inside a git repository'), { code: 'NOREPO' });

  switch (cmd) {
    case 'init': {
      ensureLayout(root);
      print(writeDefaultConfig(root) ? `night: wrote ${path.relative(root, paths(root).config)}` : 'night: .night/config.yaml already exists; left unchanged');
      return 0;
    }
    case 'loops': {
      const { loops, errors } = discoverSkills(root);
      for (const l of loops) print(`${l.name.padEnd(22)} modes: ${l.modes.join(', ').padEnd(24)} writes: ${l.writes.padEnd(6)} keep: ${l.keep_rule}  (${l.origin})${l.missing_sections.length ? `  MISSING: ${l.missing_sections.join(', ')}` : ''}`);
      for (const e of errors) print(`error: ${e.path}: ${e.error}`);
      return errors.length ? 1 : 0;
    }
    case 'plan': {
      const { loops, skills } = discoverSkills(root);
      const env = detectEnv(root);
      const { mode, objective } = modeAndObjective(pos, loops);
      const { tasks, warnings } = plan({ mode, objective, loops, skills, env });
      if (flags.json) { print(JSON.stringify({ mode, objective, tasks, warnings }, null, 2)); return 0; }
      print(`Plan for ${mode || 'objective'}${objective ? `: ${objective}` : ''} (Priority = Impact x Confidence x RiskReduction / Effort x ExecutionCost)`);
      for (const t of tasks) {
        const s = t.scores;
        print(`- ${String(t.priority).padStart(5)}  ${t.title}  [${s.impact}x${s.confidence}x${s.risk_reduction} / ${s.effort}x${s.execution_cost}]`);
        for (const [k, v] of Object.entries(t.basis || {})) print(`         ${k}: ${v}`);
      }
      for (const w of warnings) print(`warning: ${w}`);
      return tasks.length ? 0 : 1;
    }
    case 'baseline':
    case 'evaluate': {
      const config = loadConfig(root);
      const p = ensureLayout(root);
      const checks = evalCommands(config, detectEnv(root));
      if (!checks.length) { print('night: no evaluation command found; set evaluation.commands in .night/config.yaml'); return 1; }
      const dir = path.join(p.logs, 'manual');
      fs.mkdirSync(dir, { recursive: true });
      const res = await runChecks(checks, root, { timeoutMs: config.timeouts.evaluation_minutes * 60_000, logDir: dir, repeat: Number(flags.repeat) || 1, env: agentEnv() });
      const metrics = await measureMetrics(config.evaluation.metrics, root, dir);
      for (const c of res) print(`${c.ok ? 'PASS' : c.missing_tool ? 'MISSING' : 'FAIL'} ${c.name} (${fmtMs(c.ms)})${c.counts ? ` ${JSON.stringify(c.counts)}` : ''}  ${c.run}`);
      for (const [k, m] of Object.entries(metrics)) print(`metric ${k}: ${m.value ?? 'unknown'}`);
      return res.every((c) => c.ok) ? 0 : 1;
    }
    case 'run': {
      if (flags.detach) { detach(root, ['run', ...rest]); return 0; }
      const { loops } = discoverSkills(root);
      const { mode, objective } = modeAndObjective(pos, loops);
      if (CONTROL_WORDS.includes(mode)) return main2(mode);
      const s = await runNight(root, { mode, objective, agent: flags.agent, maxIterations: flags['max-iterations'], hours: flags.hours, dryRun: Boolean(flags['dry-run']) });
      print(flags['dry-run'] ? `night: dry run planned ${s.tasks.length} task(s); \`night run\` to start` : `night: ${s.status} (${s.stop_reason}) after ${s.iterations} iteration(s). Report: ${s.report ? path.relative(root, s.report) : 'none'}`);
      if (!flags['dry-run'] && s.report) print(`\n${fs.readFileSync(s.report, 'utf8')}`);
      return s.status === 'failed' ? 1 : 0;
    }
    case 'resume': {
      if (flags.detach) { detach(root, ['resume', ...rest]); return 0; }
      const s = await runNight(root, { resume: true, fromWatchdog: Boolean(flags['from-watchdog']) });
      print(`night: ${s.status} (${s.stop_reason}) after ${s.iterations} iteration(s). Report: ${s.report ? path.relative(root, s.report) : 'none'}`);
      return s.status === 'failed' ? 1 : 0;
    }
    case 'stop': {
      const p = ensureLayout(root);
      const s = loadState(root);
      if (!s || TERMINAL.has(s.status)) { print('night: nothing is running'); return 0; }
      writeAtomic(p.stop, flags.now ? 'now\n' : 'graceful\n');
      event(root, 'stop_requested', { run_id: s.run_id, now: Boolean(flags.now) });
      const holder = lockHolder(root);
      if (!holder?.alive) {
        s.status = 'stopped';
        s.stop_reason = 'stop_requested';
        s.ended_at = nowIso();
        saveState(root, s);
        fs.rmSync(p.stop, { force: true });
        writeReport(root);
        print('night: the supervisor was not running; marked the run stopped and wrote the report');
      } else print(flags.now ? 'night: stopping now: agents are killed and their changes reverted' : 'night: will stop after the current iteration');
      return 0;
    }
    case 'status': {
      if (flags.json) { print(JSON.stringify({ state: loadState(root), lock: lockHolder(root) }, null, 2)); return 0; }
      print(statusText(root));
      return 0;
    }
    case 'report': {
      if (!loadState(root)) { print(renderReport(root)); return 0; }
      const { file, text } = writeReport(root);
      print(text);
      print(`\n(written to ${path.relative(root, file)})`);
      return 0;
    }
    case 'watchdog': {
      const config = loadConfig(root);
      if (flags['initial-delay']) await new Promise((r) => setTimeout(r, 15_000));
      const v = await watch(root, { once: Boolean(flags.once), intervalSeconds: Number(flags.interval) || Math.max(15, config.timeouts.heartbeat_seconds * 2) });
      return v.action === 'give_up' ? 1 : 0;
    }
    case 'task': {
      const s = loadState(root);
      const [sub, ...words] = pos;
      if (!s) { print('night: no run; `night run --dry-run` plans one'); return 1; }
      if (sub === 'list' || !sub) {
        for (const t of s.tasks) print(`${t.id}  [${t.status}]  ${t.priority}  ${t.title}`);
        return 0;
      }
      if (lockHolder(root)?.alive) { print('night: a supervisor is running; stop it before editing the queue'); return 1; }
      if (sub === 'skip') {
        const t = s.tasks.find((x) => x.id === words[0]);
        if (!t) { print(`night: no task ${words[0]}`); return 1; }
        t.status = 'skipped';
        saveState(root, s);
        print(`night: skipped ${t.id}`);
        return 0;
      }
      if (sub === 'add') {
        const text = words.join(' ').trim();
        if (!text) { print('night: task add needs a description'); return 1; }
        const { loops, skills } = discoverSkills(root);
        const env = detectEnv(root);
        const loop = flags.loop && loops.find((l) => l.name === flags.loop || l.modes.includes(flags.loop));
        const t = loop ? plan({ mode: loop.modes[0], objective: text, loops: [loop], skills, env }).tasks[0] : buildTask(text, { signals: env.signals, evaluation: env.evaluation }, skills.find((x) => x.name === 'build-feature'));
        if (flags.priority) { t.priority = Number(flags.priority); t.basis.override = 'priority set by the owner'; }
        t.created_by = 'owner';
        s.tasks.push(t);
        saveState(root, s);
        print(`night: added ${t.id} (priority ${t.priority})`);
        return 0;
      }
      print(`night: unknown task command ${sub}`);
      return 1;
    }
    case 'doctor': return doctor(root);
    default: {
      // `night <mode> ...` and `night <free text>` behave like `night run ...`.
      process.argv.splice(2, 0, 'run');
      return main();
    }
  }
}

function main2(word) {
  process.argv.splice(2, process.argv.length, word);
  return main();
}

function doctor(root) {
  let bad = 0;
  const line = (ok, msg) => { if (!ok) bad++; print(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); };
  const warn = (msg) => print(`warn ${msg}`);
  line(commandExists('git'), 'git is installed');
  let config;
  try { config = loadConfig(root); line(true, 'config is valid'); } catch (e) { line(false, e.message); return 1; }
  const agents = availableAgents(config);
  line(agents.length > 0, `agents available: ${agents.join(', ') || 'none (install claude or codex-bridge, or set agents.commands)'}`);
  const env = detectEnv(root);
  const checks = evalCommands(config, env);
  if (checks.length) line(true, `evaluation: ${checks.map((c) => c.run).join(' | ')}`); else warn('no evaluation command: code changes will stay inconclusive');
  if (env.dirty.length) warn(`${env.dirty.length} uncommitted change(s) in this checkout; runs start from HEAD and never touch them`);
  const free = ws.freeDiskMb(root);
  line(free == null || free >= config.resources.min_free_disk_mb, `free disk: ${free ?? 'unknown'} MB`);
  const { loops, errors } = discoverSkills(root);
  line(!errors.length, `loop skills: ${loops.length}${errors.length ? `, ${errors.length} failed to load` : ''}`);
  for (const l of loops) if (l.missing_sections.length) warn(`${l.name} lacks sections: ${l.missing_sections.join(', ')}`);
  print(`workspace: ${ws.workspaceRoot(root, config)}`);
  return bad ? 1 : 0;
}

main().then((code) => { process.exitCode = code; }).catch((error) => {
  process.stderr.write(`night: ${error.message}\n`);
  if (!['LOCKED', 'NORUN', 'NOREPO', 'BADCONFIG'].includes(error.code)) process.stderr.write(`${error.stack}\n`);
  process.exitCode = error.code === 'LOCKED' ? 3 : 1;
});
