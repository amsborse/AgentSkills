// Repo-local night state: .night/ files, config, atomic writes, the run lock and the event log.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { nowIso, readJson, writeAtomic, appendJsonl, readJsonl, pidAlive } from '../../../../nightly-evolution/scripts/lib/util.mjs';
import { parseYaml, toYaml } from '../../../../nightly-evolution/scripts/lib/yaml.mjs';
import { runSync } from '../../../../nightly-evolution/scripts/lib/util.mjs';

export { nowIso, readJson, writeAtomic, appendJsonl, readJsonl, pidAlive };

export const TERMINAL = new Set(['done', 'stopped', 'failed']);

export const DEFAULT_PROTECTED = [
  '.night/**', '.git/**', '.github/**', '.gitlab-ci.yml', '.env', '.env.*', '**/.env', '**/.env.*',
  '**/*.pem', '**/*.key', '**/secrets/**', 'infra/**', 'terraform/**', '**/*.tf', 'k8s/**', 'helm/**',
  '**/migrations/**', 'Dockerfile', 'docker-compose*.yml', '.npmrc', '.pypirc',
];

export const DEFAULT_CONFIG = {
  version: 1,
  max_duration_hours: 8,
  max_iterations: 30,
  max_concurrent_agents: 3,
  max_retries_per_task: 2,
  max_stagnant_iterations: 3,
  token_budget: null,
  cost_budget_usd: null,
  require_verification: true,
  auto_revert_regressions: true,
  preserve_user_changes: true,
  allow_external_actions: false,
  agents: {
    order: ['claude', 'codex'],
    routing: { 'night-visual': 'codex', 'night-accessibility': 'codex', 'night-consistency': 'codex', 'night-docs': 'codex' },
    claude: {
      model: null,
      permission_mode: 'acceptEdits',
      max_budget_usd_per_task: null,
      allowed_tools: [
        'Read', 'Edit', 'Write', 'Glob', 'Grep', 'TodoWrite',
        'Bash(npm test:*)', 'Bash(npm run:*)', 'Bash(npx:*)', 'Bash(pnpm:*)', 'Bash(yarn:*)', 'Bash(node:*)',
        'Bash(python:*)', 'Bash(python3:*)', 'Bash(py:*)', 'Bash(pytest:*)', 'Bash(ruff:*)', 'Bash(uv run:*)',
        'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)', 'Bash(ls:*)', 'Bash(cat:*)',
      ],
      disallowed_tools: [
        'Bash(git push:*)', 'Bash(git commit:*)', 'Bash(git reset:*)', 'Bash(git checkout:*)', 'Bash(git switch:*)',
        'Bash(git merge:*)', 'Bash(git rebase:*)', 'Bash(git clean:*)', 'Bash(gh:*)', 'Bash(npm publish:*)',
        'Bash(curl:*)', 'Bash(wget:*)', 'WebFetch', 'WebSearch',
      ],
    },
    codex: { sandbox: 'workspace-write', effort: null, model: null },
    commands: {},
  },
  timeouts: { task_minutes: 45, stall_minutes: 12, evaluation_minutes: 30, finalize_minutes: 10, heartbeat_seconds: 20 },
  retry: { backoff_base_seconds: 30, backoff_max_seconds: 900 },
  evaluation: { commands: [], metrics: [], flaky_repeat: 2 },
  workspace: { dir: '../{repo}-night', setup: [], branch_prefix: 'night/' },
  resources: { min_free_disk_mb: 500 },
  protected_paths: DEFAULT_PROTECTED,
  instructions: [],
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
export function deepMerge(base, over) {
  if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(base[k]) ? deepMerge(base[k], v) : v;
  return out;
}

export function repoRoot(start = process.cwd()) {
  const r = runSync(['git', 'rev-parse', '--show-toplevel'], { cwd: start, allowFail: true });
  if (r.code !== 0) {
    const err = new Error(`not inside a git repository: ${start}`);
    err.code = 'NOREPO';
    throw err;
  }
  return path.resolve(r.stdout.trim());
}

export function paths(root) {
  const dir = path.join(root, '.night');
  return {
    root,
    dir,
    config: path.join(dir, 'config.yaml'),
    state: path.join(dir, 'state.json'),
    mission: path.join(dir, 'mission.md'),
    backlog: path.join(dir, 'backlog.md'),
    baseline: path.join(dir, 'baseline.json'),
    experiments: path.join(dir, 'experiments.jsonl'),
    failures: path.join(dir, 'failures.jsonl'),
    learnings: path.join(dir, 'learnings.md'),
    handoff: path.join(dir, 'handoff.md'),
    events: path.join(dir, 'logs', 'events.jsonl'),
    stop: path.join(dir, 'STOP'),
    lock: path.join(dir, 'supervisor.lock'),
    checkpoints: path.join(dir, 'checkpoints'),
    logs: path.join(dir, 'logs'),
    reports: path.join(dir, 'reports'),
    artifacts: path.join(dir, 'artifacts'),
  };
}

export function ensureLayout(root) {
  const p = paths(root);
  for (const d of [p.dir, p.checkpoints, p.logs, p.reports, p.artifacts]) fs.mkdirSync(d, { recursive: true });
  // Keep .night/ out of git without touching the user's .gitignore.
  const exclude = runSync(['git', 'rev-parse', '--git-path', 'info/exclude'], { cwd: root, allowFail: true }).stdout.trim();
  if (exclude) {
    const file = path.resolve(root, exclude);
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (!/^\/?\.night\/?$/m.test(text)) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.appendFileSync(file, `${text && !text.endsWith('\n') ? '\n' : ''}.night/\n`);
    }
  }
  if (!fs.existsSync(p.learnings)) writeAtomic(p.learnings, '# Learnings\n\nDurable lessons from night runs. The supervisor appends; edit freely.\n');
  return p;
}

export function loadConfig(root) {
  const p = paths(root);
  const text = fs.existsSync(p.config) ? fs.readFileSync(p.config, 'utf8') : '';
  const user = text.trim() ? parseYaml(text) : {};
  const config = deepMerge(DEFAULT_CONFIG, user || {});
  const problems = validateConfig(config);
  if (problems.length) {
    const err = new Error(`invalid .night/config.yaml: ${problems.join('; ')}`);
    err.code = 'BADCONFIG';
    throw err;
  }
  return config;
}

export function validateConfig(c) {
  const out = [];
  const posInt = (k) => { if (!(Number.isInteger(c[k]) && c[k] > 0)) out.push(`${k} must be a positive integer`); };
  for (const k of ['max_iterations', 'max_concurrent_agents', 'max_stagnant_iterations']) posInt(k);
  if (!(Number.isInteger(c.max_retries_per_task) && c.max_retries_per_task >= 0)) out.push('max_retries_per_task must be an integer >= 0');
  if (!(Number(c.max_duration_hours) > 0)) out.push('max_duration_hours must be > 0');
  for (const k of ['token_budget', 'cost_budget_usd']) if (c[k] != null && !(Number(c[k]) >= 0)) out.push(`${k} must be null or >= 0`);
  for (const k of ['require_verification', 'auto_revert_regressions', 'preserve_user_changes', 'allow_external_actions']) {
    if (typeof c[k] !== 'boolean') out.push(`${k} must be true or false`);
  }
  if (c.allow_external_actions) out.push('allow_external_actions: true is not supported; night runs never take external actions');
  if (!Array.isArray(c.agents?.order)) out.push('agents.order must be a list');
  for (const cmd of c.evaluation?.commands || []) if (!cmd?.name || !cmd?.run) out.push('each evaluation.commands entry needs name and run');
  return out;
}

export function writeDefaultConfig(root) {
  const p = paths(root);
  if (fs.existsSync(p.config)) return false;
  const { agents, protected_paths, ...rest } = DEFAULT_CONFIG;
  const header = '# Night loop config. Every key is optional; omitted keys use the defaults in\n'
    + '# skills/night/references/config.md. Budgets are estimates from agent-reported usage.\n';
  writeAtomic(p.config, header + toYaml({ ...rest, agents: { order: agents.order, routing: agents.routing } }));
  return true;
}

export function loadState(root) {
  return readJson(paths(root).state, null);
}

export function saveState(root, state) {
  state.updated_at = nowIso();
  writeAtomic(paths(root).state, `${JSON.stringify(state, null, 2)}\n`);
  return state;
}

export function event(root, type, data = {}) {
  appendJsonl(paths(root).events, { at: nowIso(), type, ...data });
}

export function acquireLock(root, label) {
  const file = paths(root).lock;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const mine = { pid: process.pid, host: os.hostname(), label, at: nowIso() };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(file, JSON.stringify(mine), { flag: 'wx' });
      return { file, release: () => { const held = readJson(file, null); if (held?.pid === process.pid) fs.rmSync(file, { force: true }); } };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const held = readJson(file, null);
      if (held && !(held.host === os.hostname() && !pidAlive(held.pid))) {
        const err = new Error(`a night supervisor already runs here (pid ${held.pid} on ${held.host}, since ${held.at})`);
        err.code = 'LOCKED';
        throw err;
      }
      fs.rmSync(file, { force: true });
    }
  }
  throw new Error('could not acquire the supervisor lock');
}

export function lockHolder(root) {
  const held = readJson(paths(root).lock, null);
  if (!held) return null;
  return { ...held, alive: held.host === os.hostname() ? pidAlive(held.pid) : null };
}
