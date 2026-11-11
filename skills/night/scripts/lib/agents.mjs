// Agent adapters. Each runs one iteration in a worktree and returns what happened, with the
// agent's NIGHT_RESULT treated as an unverified claim. Adapters: claude (Claude Code CLI),
// codex (codex-bridge), and any configured command (also how tests plug in a fake agent).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { commandExists, killTree, hash, expand, runSync, IS_WINDOWS } from '../../../../nightly-evolution/scripts/lib/util.mjs';

/** Git config that makes every push fail inside agent processes (nothing reaches a remote). */
export const PUSH_BLOCK_ENV = {
  GIT_CONFIG_COUNT: '2',
  GIT_CONFIG_KEY_0: 'url.night-push-blocked:///.pushInsteadOf',
  GIT_CONFIG_VALUE_0: '',
  GIT_CONFIG_KEY_1: 'remote.pushDefault',
  GIT_CONFIG_VALUE_1: 'night-blocked',
};

export function agentEnv(extra = {}) {
  const env = { ...process.env, ...PUSH_BLOCK_ENV, NIGHT_LOOP: '1', ...extra };
  // An inherited count would otherwise be overwritten silently; keep ours authoritative.
  for (const k of Object.keys(env)) if (/^GIT_CONFIG_(KEY|VALUE)_([2-9]|\d{2,})$/.test(k)) delete env[k];
  return env;
}

/** The last `NIGHT_RESULT: {json}` in the text, or null. */
export function parseNightResult(text) {
  const s = String(text || '');
  const at = s.lastIndexOf('NIGHT_RESULT:');
  if (at < 0) return null;
  const rest = s.slice(at + 'NIGHT_RESULT:'.length);
  const start = rest.indexOf('{');
  if (start < 0) return null;
  for (let end = rest.lastIndexOf('}'); end > start; end = rest.lastIndexOf('}', end - 1)) {
    try {
      const v = JSON.parse(rest.slice(start, end + 1));
      return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
    } catch { /* try a shorter span */ }
  }
  return null;
}

const quoteWin = (a) => (/^[\w./:=@\\-]+$/.test(a) ? a : `"${String(a).replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1')}"`);

/** Fingerprint of worktree activity: changes when files are edited. Cheap enough to poll. */
export function worktreeProbe(cwd) {
  const st = runSync(['git', 'status', '--porcelain', '--untracked-files=all'], { cwd, allowFail: true, timeoutMs: 30_000 }).stdout;
  let newest = 0;
  for (const line of st.split('\n').filter(Boolean).slice(0, 400)) {
    try { newest = Math.max(newest, fs.statSync(path.join(cwd, line.slice(3).replace(/^"|"$/g, ''))).mtimeMs); } catch { /* deleted */ }
  }
  return `${hash(st, 10)}:${Math.round(newest)}`;
}

/**
 * Spawn an agent process with stall detection. Activity is any output, a change in
 * `probe()`, or a change in the extra probe. No activity for stallMs kills the tree.
 */
export function spawnAgent(argv, { cwd, input, env, timeoutMs, stallMs, probe, probeEveryMs = 30_000, logFile, onActivity, onSpawn }) {
  return new Promise((resolve) => {
    const started = Date.now();
    let last = Date.now();
    let lastProbe = probe ? probe() : null;
    let stdout = '';
    let stderr = '';
    let reason = null;
    const log = logFile ? fs.createWriteStream(logFile, { flags: 'a' }) : null;
    const opts = { cwd, env, windowsHide: true, detached: !IS_WINDOWS, stdio: ['pipe', 'pipe', 'pipe'] };
    let child;
    try {
      child = IS_WINDOWS ? spawn(argv.map(quoteWin).join(' '), { ...opts, shell: true }) : spawn(argv[0], argv.slice(1), opts);
    } catch (error) {
      resolve({ code: 127, stdout: '', stderr: error.message, ms: 0, reason: 'spawn_failed' });
      return;
    }
    onSpawn?.(child.pid);
    const touch = () => { last = Date.now(); onActivity?.(); };
    const take = (which) => (d) => {
      const s = d.toString();
      if (which === 'out') stdout = (stdout + s).slice(-2_000_000); else stderr = (stderr + s).slice(-200_000);
      log?.write(s);
      touch();
    };
    child.stdout.on('data', take('out'));
    child.stderr.on('data', take('err'));
    child.stdin.on('error', () => {});
    if (input != null) child.stdin.end(input); else child.stdin.end();
    const stop = (why) => { if (!reason) { reason = why; killTree(child.pid); } };
    const timer = setInterval(() => {
      if (Date.now() - started > timeoutMs) return stop('timeout');
      if (probe && Date.now() - last > Math.min(probeEveryMs, stallMs / 2)) {
        const p = probe();
        if (p !== lastProbe) { lastProbe = p; touch(); }
      }
      if (Date.now() - last > stallMs) stop('stalled');
    }, Math.min(5_000, Math.max(250, Math.floor(stallMs / 4))));
    child.on('error', (error) => { stderr += error.message; reason = reason || 'spawn_failed'; });
    child.on('close', (code) => {
      clearInterval(timer);
      log?.end();
      resolve({ code: code ?? (reason ? 124 : 1), stdout, stderr, ms: Date.now() - started, reason });
    });
  });
}

const RATE = /usage limit|rate.?limit|\b429\b|overloaded|quota|credit balance is too low|limit reached/i;
const CONTEXT = /prompt is too long|context (window|length)|maximum context|too many tokens|compact/i;

function classify(proc, text, isError) {
  if (proc.reason === 'timeout') return 'timeout';
  if (proc.reason === 'stalled') return 'stalled';
  if (proc.reason === 'spawn_failed' || proc.code === 127 || /is not recognized as an internal|command not found|ENOENT/.test(proc.stderr)) return 'tool_failure';
  const all = `${text}\n${proc.stderr}`;
  if (isError || proc.code !== 0) {
    if (CONTEXT.test(all)) return 'context_exhausted';
    if (RATE.test(all)) return 'rate_limited';
    return 'crashed';
  }
  return null;
}

function claudeArgs(cfg, appendPrompt) {
  const args = ['claude', '-p', '--output-format', 'stream-json', '--verbose', '--no-session-persistence', '--permission-mode', cfg.permission_mode || 'acceptEdits'];
  if (cfg.allowed_tools?.length) args.push('--allowedTools', ...cfg.allowed_tools);
  if (cfg.disallowed_tools?.length) args.push('--disallowedTools', ...cfg.disallowed_tools);
  if (cfg.model) args.push('--model', cfg.model);
  if (cfg.max_budget_usd_per_task) args.push('--max-budget-usd', String(cfg.max_budget_usd_per_task));
  args.push('--append-system-prompt', appendPrompt);
  return args;
}

export const SYSTEM_APPEND = 'You are one iteration of an unattended night loop. Nobody will answer questions: decide, record the decision in NIGHT_RESULT, and continue. Never commit, push, merge, switch branches, deploy, publish or contact external services. End with the NIGHT_RESULT line.';

const ADAPTERS = {
  claude: {
    available: () => commandExists('claude'),
    async run({ prompt, cwd, env, timeoutMs, stallMs, logFile, config, onActivity, onSpawn }) {
      const proc = await spawnAgent(claudeArgs(config.agents.claude || {}, SYSTEM_APPEND), { cwd, input: prompt, env, timeoutMs, stallMs, probe: () => worktreeProbe(cwd), logFile, onActivity, onSpawn });
      let result = null;
      for (const line of proc.stdout.split('\n')) {
        if (!line.startsWith('{')) continue;
        try { const ev = JSON.parse(line); if (ev.type === 'result') result = ev; } catch { /* partial line */ }
      }
      const text = result?.result || '';
      const failure = classify(proc, `${text}\n${result?.subtype || ''}`, result ? result.is_error : proc.code !== 0);
      const u = result?.usage || {};
      return {
        agent: 'claude', ms: proc.ms, code: proc.code, failure, text,
        claim: parseNightResult(text),
        usage: { input_tokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0), output_tokens: u.output_tokens || 0 },
        cost_usd: typeof result?.total_cost_usd === 'number' ? result.total_cost_usd : null,
        detail: proc.stderr.slice(-800),
      };
    },
  },
  codex: {
    available: () => commandExists('codex-bridge'),
    async run({ prompt, promptFile, cwd, env, timeoutMs, stallMs, logFile, config, onActivity, onSpawn }) {
      const cfg = config.agents.codex || {};
      const argv = ['codex-bridge', 'run', '--cd', cwd, '--sandbox', cfg.sandbox || 'workspace-write', '--timeout', String(Math.floor(timeoutMs / 1000)), '--prompt-file', promptFile, '--kind', 'night'];
      if (cfg.model) argv.push('--model', cfg.model);
      if (cfg.effort) argv.push('--effort', cfg.effort);
      // codex-bridge prints only when the run ends, so activity comes from the worktree.
      const proc = await spawnAgent(argv, { cwd, env, timeoutMs: timeoutMs + 60_000, stallMs, probe: () => worktreeProbe(cwd), logFile, onActivity, onSpawn });
      let summary = null;
      try { summary = JSON.parse(proc.stdout.slice(proc.stdout.indexOf('{'))); } catch { /* not JSON */ }
      const text = summary?.lastMessage || '';
      let failure = classify(proc, `${text}\n${(summary?.errors || []).join('\n')}`, summary ? summary.status !== 'ok' : proc.code !== 0);
      if (summary?.status === 'timeout') failure = 'timeout';
      if (summary?.quotaExhausted) failure = 'rate_limited';
      const u = summary?.usage || {};
      return {
        agent: 'codex', ms: proc.ms, code: proc.code, failure, text, claim: parseNightResult(text),
        usage: { input_tokens: u.input_tokens || 0, output_tokens: (u.output_tokens || 0) + (u.reasoning_output_tokens || 0) },
        cost_usd: null, quota_exhausted: Boolean(summary?.quotaExhausted), run_id: summary?.runId || null,
        detail: (summary?.errors || []).join('; ').slice(0, 800) || proc.stderr.slice(-800),
      };
    },
  },
};

function commandAdapter(name, def) {
  return {
    available: () => true,
    async run({ prompt, promptFile, cwd, env, timeoutMs, stallMs, logFile, onActivity, onSpawn }) {
      const line = expand(def.run, { prompt_file: promptFile, cwd });
      const argv = IS_WINDOWS ? ['cmd', '/d', '/s', '/c', line] : ['sh', '-c', line];
      const proc = await new Promise((resolve) => {
        // Run through the shell as written; spawnAgent would re-quote it.
        const started = Date.now();
        let out = '';
        let err = '';
        let reason = null;
        let last = Date.now();
        let lastProbe = worktreeProbe(cwd);
        const child = spawn(argv[0], argv.slice(1), { cwd, env, windowsHide: true, detached: !IS_WINDOWS, windowsVerbatimArguments: IS_WINDOWS });
        onSpawn?.(child.pid);
        const log = logFile ? fs.createWriteStream(logFile, { flags: 'a' }) : null;
        const take = (which) => (d) => { const s = d.toString(); if (which) out += s; else err += s; log?.write(s); last = Date.now(); onActivity?.(); };
        child.stdout.on('data', take(true));
        child.stderr.on('data', take(false));
        child.stdin.end(prompt);
        child.stdin.on('error', () => {});
        const timer = setInterval(() => {
          if (Date.now() - started > timeoutMs) { reason = 'timeout'; killTree(child.pid); return; }
          const p = worktreeProbe(cwd);
          if (p !== lastProbe) { lastProbe = p; last = Date.now(); onActivity?.(); }
          if (Date.now() - last > stallMs) { reason = 'stalled'; killTree(child.pid); }
        }, Math.min(5_000, Math.max(200, Math.floor(stallMs / 4))));
        child.on('error', (e) => { err += e.message; reason = reason || 'spawn_failed'; });
        child.on('close', (code) => { clearInterval(timer); log?.end(); resolve({ code: code ?? 124, stdout: out, stderr: err, ms: Date.now() - started, reason }); });
      });
      let usage = { input_tokens: 0, output_tokens: 0 };
      let cost = null;
      const u = /^NIGHT_USAGE:\s*(\{.*\})\s*$/m.exec(proc.stdout);
      if (u) { try { const j = JSON.parse(u[1]); usage = { input_tokens: j.input_tokens || 0, output_tokens: j.output_tokens || 0 }; cost = j.cost_usd ?? null; } catch { /* ignore */ } }
      return { agent: name, ms: proc.ms, code: proc.code, failure: classify(proc, proc.stdout, proc.code !== 0), text: proc.stdout.slice(-20_000), claim: parseNightResult(proc.stdout), usage, cost_usd: cost, detail: proc.stderr.slice(-800) };
    },
  };
}

export function adapters(config) {
  const out = { ...ADAPTERS };
  for (const [name, def] of Object.entries(config.agents?.commands || {})) if (def?.run) out[name] = commandAdapter(name, def);
  return out;
}

/** Agents in preference order that exist on this machine. NIGHT_AGENTS (comma list) overrides the order. */
export function availableAgents(config, envOverride = process.env.NIGHT_AGENTS) {
  const all = adapters(config);
  const order = envOverride ? envOverride.split(',').map((s) => s.trim()).filter(Boolean) : [...(config.agents?.order || []), ...Object.keys(config.agents?.commands || {})];
  return [...new Set(order)].filter((n) => all[n]?.available());
}

/** The agent for a task: routing by loop, then the first available, skipping ones marked down. */
export function pickAgent(task, config, { available, down = new Set(), forced } = {}) {
  const usable = (available || availableAgents(config)).filter((n) => !down.has(n));
  if (forced) return usable.includes(forced) ? forced : null;
  const routed = task.loop && config.agents?.routing?.[task.loop];
  if (routed && usable.includes(routed)) return routed;
  return usable[0] || null;
}

export function tempPromptFile(dir, taskId, prompt) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${taskId}-${Date.now()}.prompt.md`);
  fs.writeFileSync(file, prompt);
  return file;
}

export const _test = { quoteWin, classify, os };
