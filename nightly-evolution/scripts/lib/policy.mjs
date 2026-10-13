import fs from 'node:fs';
import { parseYaml, toYaml } from './yaml.mjs';

/** Improvement dimensions and the supporting instruction file that covers each. */
export const DIMENSIONS = {
  performance: 'performance.md',
  code_quality: 'optimization.md',
  architecture: 'architecture.md',
  ui_ux: 'visual-design.md',
  modernization: 'research.md',
  security: 'security.md',
  reliability: 'reliability.md',
  ai_efficiency: 'optimization.md',
  cost: 'optimization.md',
  developer_experience: 'optimization.md',
  creative: 'creativity.md',
  product_intelligence: 'creativity.md',
};

export const METRIC_KINDS = ['duration', 'regex', 'json', 'exit', 'size', 'duplication', 'loc', 'http'];

const DEFAULT_PROTECTED = [
  '.env*',
  '**/*.pem',
  '**/*.key',
  '**/secrets/**',
  '**/credentials*',
  '**/migrations/**',
  '**/*.tfstate',
  '.evolution/**',
];

export const DEFAULTS = {
  version: 1,
  schedule: { window: '22:00-07:00', finalize_before_end_minutes: 45 },
  worktree: { dir: '../{repo}-worktrees', setup: [] },
  budgets: { max_experiments: 6, max_accepted: 4, max_tick_minutes: 10, max_attempt_minutes: 45 },
  ai: { paid_allowed: false, max_paid_usd: 0, max_tokens: 800000 },
  priorities: {
    performance: 3,
    code_quality: 3,
    architecture: 2,
    ui_ux: 2,
    modernization: 2,
    security: 4,
    reliability: 4,
    ai_efficiency: 2,
    cost: 2,
    developer_experience: 3,
    creative: 2,
    product_intelligence: 2,
  },
  focus: [],
  checks: [],
  metrics: [],
  survey: { commands: [], hotspot_days: 30 },
  ui: { viewport: [1440, 900], pages: [], references: [], max_diff_ratio: 0.02 },
  protected_paths: DEFAULT_PROTECTED,
  conflicts: { open_prs: true, other_worktrees: true, ignore_branches: [], commands: [] },
  pr: { enabled: true, push: true, draft: true, labels: [] },
  instructions: [],
};

function isObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

export function deepMerge(base, over) {
  if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(base[k]) ? deepMerge(base[k], v) : v;
  return out;
}

export function validatePolicy(p) {
  const errors = [];
  const warnings = [];
  if (p.version !== 1) errors.push(`version must be 1 (got ${p.version})`);
  if (!p.repo?.default_branch) errors.push('repo.default_branch is required');
  if (!/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(String(p.schedule?.window).replace(/\s/g, ''))) errors.push('schedule.window must look like 22:00-07:00');
  for (const k of Object.keys(p.priorities || {})) {
    if (!(k in DIMENSIONS)) warnings.push(`priorities.${k} is not a known dimension (${Object.keys(DIMENSIONS).join(', ')})`);
    const v = p.priorities[k];
    if (!(Number.isFinite(v) && v >= 0 && v <= 5)) errors.push(`priorities.${k} must be 0-5`);
  }
  const names = new Set();
  for (const [i, c] of (p.checks || []).entries()) {
    if (!c?.name || !c?.run) errors.push(`checks[${i}] needs name and run`);
    if (names.has(c?.name)) errors.push(`duplicate check/metric name ${c.name}`);
    names.add(c?.name);
  }
  for (const [i, m] of (p.metrics || []).entries()) {
    if (!m?.name) errors.push(`metrics[${i}] needs a name`);
    if (names.has(m?.name)) errors.push(`duplicate check/metric name ${m.name}`);
    names.add(m?.name);
    if (!METRIC_KINDS.includes(m?.kind)) errors.push(`metrics.${m?.name}: kind must be one of ${METRIC_KINDS.join(', ')}`);
    if (['duration', 'regex', 'json', 'exit'].includes(m?.kind) && !m.run) errors.push(`metrics.${m.name}: kind ${m.kind} needs run`);
    if (m?.kind === 'regex' && !m.pattern) errors.push(`metrics.${m.name}: regex needs pattern`);
    if (m?.kind === 'size' && !m.path) errors.push(`metrics.${m.name}: size needs path`);
    if (m?.kind === 'http' && !m.url) errors.push(`metrics.${m.name}: http needs url`);
    if (m?.better && !['lower', 'higher'].includes(m.better)) errors.push(`metrics.${m.name}: better must be lower|higher`);
  }
  if (!Array.isArray(p.instructions) || p.instructions.some((s) => typeof s !== 'string')) errors.push('instructions must be a list of strings');
  if (p.ai?.paid_allowed !== true && Number(p.ai?.max_paid_usd) > 0) warnings.push('ai.max_paid_usd > 0 has no effect while ai.paid_allowed is false');
  return { errors, warnings };
}

export function loadPolicy(repo) {
  if (!fs.existsSync(repo.policyFile)) {
    const err = new Error(`No policy at ${repo.policyFile}. Run: evolve init`);
    err.code = 'NO_POLICY';
    throw err;
  }
  const raw = parseYaml(fs.readFileSync(repo.policyFile, 'utf8'));
  const policy = deepMerge(DEFAULTS, raw);
  // A repo may add protected paths but can never drop the safety baseline.
  policy.protected_paths = [...new Set([...DEFAULT_PROTECTED, ...(policy.protected_paths || [])])];
  const { errors, warnings } = validatePolicy(policy);
  if (errors.length) throw new Error(`Invalid ${repo.policyFile}:\n- ${errors.join('\n- ')}`);
  return { policy, warnings };
}

/** Build a starting policy from what discovery actually found in the repository. */
export function generatePolicy(profile) {
  const scripts = new Set(profile.node?.scripts || []);
  const pm = profile.node?.packageManager || 'npm';
  const runScript = (s) => (pm === 'npm' ? `npm run ${s}` : `${pm} ${s}`);
  const checks = [];
  const metrics = [];
  const codeGlobs = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.mjs', '**/*.jsx'];

  if (scripts.has('typecheck')) checks.push({ name: 'typecheck', run: runScript('typecheck'), when: codeGlobs, timeout_minutes: 15 });
  if (scripts.has('lint')) checks.push({ name: 'lint', run: runScript('lint'), when: [...codeGlobs, '**/*.css', '**/*.json'], timeout_minutes: 15 });
  if (scripts.has('test')) {
    checks.push({ name: 'unit-tests', run: runScript('test'), when: codeGlobs, timeout_minutes: 30 });
    metrics.push({ name: 'unit_test_ms', kind: 'duration', run: runScript('test'), better: 'lower', tolerance_pct: 25 });
  }
  if (scripts.has('build')) metrics.push({ name: 'build_ms', kind: 'duration', run: runScript('build'), better: 'lower', tolerance_pct: 20 });
  for (const venv of profile.python?.venvs || []) {
    const project = venv.replace(/\/\.venv\/.*$/, '');
    checks.push({
      name: `pytest-${project.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root'}`,
      run: `"{main}/${venv}" -m pytest -q`,
      cwd: project,
      when: [`${project === '.' ? '' : `${project}/`}**/*.py`],
      timeout_minutes: 30,
    });
  }

  const sourceGlobs = profile.areas.length ? profile.areas.map((a) => `${a}/**`) : ['src/**'];
  metrics.push(
    { name: 'duplication_pct', kind: 'duplication', paths: sourceGlobs, better: 'lower', tolerance_pct: 2, quick: true },
    { name: 'source_loc', kind: 'loc', paths: sourceGlobs, better: 'lower', tolerance_pct: 5, gate: false, quick: true },
  );

  const priorities = { ...DEFAULTS.priorities };
  if (profile.signals.ui) priorities.ui_ux = 3;
  if (profile.signals.kriya || profile.signals.viveka) {
    priorities.ai_efficiency = 4;
    priorities.reliability = 5;
  }

  const survey = { commands: [], hotspot_days: 30 };
  if (pm === 'pnpm') survey.commands.push({ name: 'dependency-audit', run: 'pnpm audit --json', timeout_minutes: 5, dimension: 'security' });
  else if (pm === 'npm' && profile.node) survey.commands.push({ name: 'dependency-audit', run: 'npm audit --json', timeout_minutes: 5, dimension: 'security' });

  const pwDir = profile.playwrightConfigs[0]?.includes('/') ? profile.playwrightConfigs[0].replace(/\/[^/]+$/, '') : '.';
  // A worktree inside the checkout is only safe where the repo already ignores it.
  const worktreeDir = profile.worktreeHints.some((h) => /^\/?\.worktrees\/?$/.test(h)) ? '.worktrees' : '../{repo}-worktrees';
  const install = { pnpm: 'pnpm install --frozen-lockfile --prefer-offline', npm: 'npm ci --prefer-offline', yarn: 'yarn install --frozen-lockfile' };
  const setup = profile.node?.lockfile ? [install[pm]] : [];

  return {
    version: 1,
    repo: { name: profile.name, default_branch: profile.defaultBranch, remote: 'origin' },
    schedule: { window: DEFAULTS.schedule.window, finalize_before_end_minutes: 45, host_loops: profile.loops.map((l) => l.path) },
    worktree: { dir: worktreeDir, setup },
    budgets: { ...DEFAULTS.budgets },
    ai: { ...DEFAULTS.ai, routing_policy: profile.signals.viveka ? 'modules/viveka' : null },
    priorities,
    focus: profile.areas.slice(0, 16).map((a) => ({ area: a, paths: [`${a}/**`], goals: [] })),
    checks,
    metrics,
    survey,
    ui: { viewport: [1440, 900], playwright_from: pwDir, serve: null, pages: [], references: profile.designReferences.slice(0, 12), max_diff_ratio: 0.02 },
    protected_paths: DEFAULT_PROTECTED,
    conflicts: { ...DEFAULTS.conflicts },
    pr: { ...DEFAULTS.pr, base: profile.defaultBranch },
    instructions: [],
  };
}

export function policyToYaml(policy, header = []) {
  const lines = [
    '# Nightly Evolution policy (shared skill: nightly-evolution).',
    '# Edit freely; `evolve validate` checks it. Unknown keys are ignored.',
    ...header.map((h) => `# ${h}`),
    '',
  ];
  return `${lines.join('\n')}${toYaml(policy)}`;
}
