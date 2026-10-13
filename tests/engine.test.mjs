import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseYaml, toYaml } from '../nightly-evolution/scripts/lib/yaml.mjs';
import { formatJson, globToRegExp, matchesAny, pathsOverlap, inWindow, nightDate, parseWindow } from '../nightly-evolution/scripts/lib/util.mjs';
import { compare, relatedTests } from '../nightly-evolution/scripts/lib/measure.mjs';
import { fingerprint, findSimilar } from '../nightly-evolution/scripts/lib/memory.mjs';
import { generatePolicy, loadPolicy, validatePolicy, deepMerge, DEFAULTS } from '../nightly-evolution/scripts/lib/policy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVOLVE = path.join(ROOT, 'nightly-evolution', 'scripts', 'evolve.mjs');

test('yaml round-trips the policy subset', () => {
  const value = {
    version: 1,
    repo: { name: 'x', default_branch: 'main' },
    list: ['a', 'b: c', '#hash', 'true'],
    checks: [{ name: 'typecheck', run: 'pnpm typecheck', when: ['**/*.ts'], timeout_minutes: 15 }],
    empty: [],
    nested: { deep: { n: 1.5, b: false, z: null } },
    long: ['one long item that pushes this list past the inline width limit', 'another long item here'],
  };
  assert.deepEqual(parseYaml(toYaml(value)), value);
});

test('yaml parses comments, flow lists and block scalars', () => {
  const doc = parseYaml(`# header
a: 1 # trailing
b: [x, "y, z", 3]
c:
  - name: one
    run: echo "#not a comment"
  - plain
d: |
  line1
  line2
e: {k: v, n: 2}
`);
  assert.equal(doc.a, 1);
  assert.deepEqual(doc.b, ['x', 'y, z', 3]);
  assert.deepEqual(doc.c, [{ name: 'one', run: 'echo "#not a comment"' }, 'plain']);
  assert.equal(doc.d, 'line1\nline2\n');
  assert.deepEqual(doc.e, { k: 'v', n: 2 });
});

test('globs match like gitignore', () => {
  assert.ok(matchesAny('apps/web/src/a.tsx', ['**/*.tsx']));
  assert.ok(matchesAny('.env.local', ['.env*']));
  assert.ok(matchesAny('packages/db/migrations/001.sql', ['**/migrations/**']));
  assert.ok(matchesAny('deploy/run.sh', ['deploy']));
  assert.ok(!matchesAny('src/deployer.ts', ['deploy']));
  assert.ok(globToRegExp('nightly/*').test('nightly/evolution-2026-10-13'));
  assert.ok(pathsOverlap('apps/web/src', 'apps/web/src/a.ts'));
  assert.ok(!pathsOverlap('apps/web', 'apps/webhooks'));
  assert.ok(matchesAny('apps/web/src/a.tsx', ['**/*.{ts,tsx}']));
  assert.ok(matchesAny('docker-compose.repair.yml', ['docker-compose*.{yml,yaml}']));
  assert.ok(!matchesAny('apps/web/src/a.css', ['**/*.{ts,tsx}']));
});

test('window handles overnight ranges', () => {
  assert.deepEqual(parseWindow('22:00-07:00'), { start: 1320, end: 420 });
  const at = (h) => Object.assign(new Date(), {}) && new Date(2026, 0, 1, h, 0);
  assert.ok(inWindow('22:00-07:00', at(23)));
  assert.ok(inWindow('22:00-07:00', at(3)));
  assert.ok(!inWindow('22:00-07:00', at(12)));
});

test('a night is named after the evening its window opened', () => {
  assert.equal(nightDate('22:00-07:00', new Date(2026, 0, 2, 3, 0)), '2026-01-01');
  assert.equal(nightDate('22:00-07:00', new Date(2026, 0, 2, 23, 0)), '2026-01-02');
  assert.equal(nightDate('22:00-07:00', new Date(2026, 0, 2, 12, 0)), '2026-01-02');
  assert.equal(nightDate('01:00-05:00', new Date(2026, 0, 2, 3, 0)), '2026-01-02');
});

test('a repo policy can add protected paths but never drop the baseline', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-policy-'));
  const policyFile = path.join(dir, 'policy.yaml');
  fs.writeFileSync(policyFile, 'version: 1\nrepo:\n  default_branch: main\nprotected_paths: ["deploy/**"]\ninstructions: ["Never send email."]\n');
  const { policy } = loadPolicy({ policyFile });
  assert.ok(policy.protected_paths.includes('deploy/**'));
  assert.ok(policy.protected_paths.includes('.env*'));
  assert.deepEqual(policy.instructions, ['Never send email.']);
  fs.writeFileSync(policyFile, 'version: 1\nrepo:\n  default_branch: main\ninstructions: "not a list"\n');
  assert.throws(() => loadPolicy({ policyFile }), /instructions must be a list/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('related tests follow the changed modules', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-related-'));
  for (const f of ['apps/api/app/store.py', 'apps/api/tests/test_store.py', 'apps/api/tests/test_store_cache.py', 'apps/api/tests/test_other.py', 'web/src/feed.ts', 'web/src/feed.test.ts']) {
    fs.mkdirSync(path.dirname(path.join(repo, f)), { recursive: true });
    fs.writeFileSync(path.join(repo, f), '');
  }
  sh(repo, 'git', 'init', '-q');
  sh(repo, 'git', 'add', '.');
  assert.deepEqual(relatedTests(repo, ['apps/api/app/store.py'], 'apps/api'), ['tests/test_store.py', 'tests/test_store_cache.py']);
  assert.deepEqual(relatedTests(repo, ['apps/api/tests/test_other.py', 'web/src/feed.ts'], 'apps/api'), ['tests/test_other.py']);
  assert.deepEqual(relatedTests(repo, ['web/src/feed.ts']), ['web/src/feed.test.ts']);
  assert.deepEqual(relatedTests(repo, ['README.md']), []);
  fs.rmSync(repo, { recursive: true, force: true });
});

test('formatJson matches the Prettier layout', () => {
  assert.equal(formatJson({}), '{}\n');
  assert.equal(formatJson({ a: [1440, 900], b: {}, c: [] }), '{\n  "a": [1440, 900],\n  "b": {},\n  "c": []\n}\n');
  assert.equal(formatJson({ a: [{ x: 1 }] }), '{\n  "a": [\n    {\n      "x": 1\n    }\n  ]\n}\n');
  const long = Array.from({ length: 8 }, (_, i) => `some/long/path/${i}.ts`);
  assert.match(formatJson({ files: long }), /"files": \[\n {4}"some\/long\/path\/0\.ts",\n/);
});

test('compare respects direction and tolerance', () => {
  const m = (value) => ({ value, ok: true });
  assert.equal(compare({ better: 'lower', tolerance_pct: 10 }, m(100), m(80)).verdict, 'improved');
  assert.equal(compare({ better: 'lower', tolerance_pct: 10 }, m(100), m(105)).verdict, 'neutral');
  assert.equal(compare({ better: 'lower', tolerance_pct: 10 }, m(100), m(120)).verdict, 'regressed');
  assert.equal(compare({ better: 'higher', tolerance_pct: 5 }, m(50), m(60)).verdict, 'improved');
  assert.equal(compare({}, m(null), m(3)).verdict, 'unknown');
});

test('memory dedupes by fingerprint and similar titles', () => {
  const a = { dimension: 'performance', title: 'Cache feed queries in the API layer', files: ['api/feed.ts'] };
  const history = [{ kind: 'experiment', verdict: 'rejected', ...a, fingerprint: fingerprint(a) }];
  assert.equal(findSimilar(history, a)[0].match, 'fingerprint');
  assert.ok(findSimilar(history, { dimension: 'performance', title: 'Cache the feed queries in API layer' }).length);
  assert.equal(findSimilar(history, { dimension: 'security', title: 'Rotate tokens' }).length, 0);
  assert.equal(findSimilar([{ kind: 'library', library: 'zod', title: 'zod' }], { library: 'Zod' })[0].match, 'library');
});

test('generated policy validates', () => {
  const profile = { name: 'demo', defaultBranch: 'main', node: { packageManager: 'pnpm', scripts: ['test', 'build', 'typecheck'] }, python: null, areas: ['apps/web'], playwrightConfigs: [], designReferences: [], loops: [], worktreeHints: [], signals: { ui: true } };
  const policy = deepMerge(DEFAULTS, parseYaml(toYaml(generatePolicy(profile))));
  assert.deepEqual(validatePolicy(policy).errors, []);
});

// ---- end-to-end lifecycle in a throwaway repository ------------------------------------

function sh(cwd, ...argv) {
  const r = spawnSync(argv[0], argv.slice(1), { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${argv.join(' ')}: ${r.stderr || r.stdout}`);
  return r.stdout.trim();
}

function evolve(repo, ...args) {
  const r = spawnSync(process.execPath, [EVOLVE, ...args, '--repo', repo], { encoding: 'utf8', env: { ...process.env, NIGHTLY_EVOLUTION_HOME: path.join(repo, '..', 'home') } });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch {
    // non-JSON output
  }
  return { code: r.status, json, stdout: r.stdout, stderr: r.stderr };
}

test('full night lifecycle: tick, triage, reject+revert, accept, finish', { timeout: 120_000 }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-'));
  const repo = path.join(tmp, 'demo');
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  sh(repo, 'git', 'init', '-q', '-b', 'main');
  sh(repo, 'git', 'config', 'user.email', 't@example.com');
  sh(repo, 'git', 'config', 'user.name', 'Test');
  const dupBlock = Array.from({ length: 8 }, (_, i) => `  const value${i} = compute(${i}) + offset;`).join('\n');
  fs.writeFileSync(path.join(repo, 'src', 'a.js'), `export function a() {\n${dupBlock}\n}\n`);
  fs.writeFileSync(path.join(repo, 'src', 'b.js'), `export function b() {\n${dupBlock}\n}\n`);
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ name: 'demo', scripts: { test: 'node -e "process.exit(require(\'fs\').existsSync(\'BROKEN\')?1:0)"' } }));
  sh(repo, 'git', 'add', '.');
  sh(repo, 'git', 'commit', '-qm', 'init');

  const init = evolve(repo, 'init');
  assert.equal(init.code, 0, init.stderr);
  assert.ok(init.json.created.includes('policy.yaml'));
  assert.equal(sh(repo, 'git', 'status', '--porcelain'), '', '.evolution must not dirty the checkout');
  assert.equal(evolve(repo, 'init').json.created.length, 0, 'init is idempotent');
  // No package manager lockfile -> no setup; keep the test fast.
  assert.equal(evolve(repo, 'validate').code, 0);

  const t1 = evolve(repo, 'tick', '--force', '--agent', 'test');
  assert.equal(t1.code, 0, t1.stderr);
  assert.equal(t1.json.action, 'triage', JSON.stringify(t1.json));
  const night = t1.json.night;
  const status = evolve(repo, 'status').json;
  const wt = status.night.worktree;
  assert.ok(fs.existsSync(wt));
  assert.ok(!path.resolve(wt).startsWith(path.resolve(repo) + path.sep), 'worktree lives outside the checkout');
  assert.match(status.night.branch, /^nightly\/evolution-\d{4}-\d{2}-\d{2}$/);
  assert.ok(fs.readFileSync(t1.json.read[0], 'utf8').includes('Duplication'));

  // Candidate 1 will regress tests -> must be rejected and reverted.
  assert.equal(evolve(repo, 'candidate', 'add', '--dimension', 'reliability', '--title', 'Break the build on purpose', '--files', 'BROKEN,src/c.js', '--impact', '1').json.added, true);
  // Candidate 2 removes duplication -> measurable improvement.
  assert.equal(evolve(repo, 'candidate', 'add', '--dimension', 'code_quality', '--title', 'Extract shared compute block', '--files', 'src', '--metrics', 'duplication_pct', '--impact', '5', '--confidence', '5', '--cost', '1').json.added, true);
  const dup = evolve(repo, 'candidate', 'add', '--dimension', 'code_quality', '--title', 'Extract shared compute block', '--files', 'src');
  assert.equal(dup.json.added, false, 'duplicate candidate refused');
  assert.equal(evolve(repo, 'triage', 'done').code, 0);

  const t2 = evolve(repo, 'tick', '--agent', 'test');
  assert.equal(t2.json.action, 'implement');
  assert.equal(t2.json.candidate.id, 'c2', 'highest score first');
  assert.equal(evolve(repo, 'tick', '--agent', 'other').json.action, 'wait', 'another agent cannot take over a live attempt');

  fs.writeFileSync(path.join(wt, 'src', 'shared.js'), `export function shared() {\n${dupBlock}\n}\n`);
  fs.writeFileSync(path.join(wt, 'src', 'a.js'), "import { shared } from './shared.js';\nexport const a = shared;\n");
  fs.writeFileSync(path.join(wt, 'src', 'b.js'), "import { shared } from './shared.js';\nexport const b = shared;\n");
  sh(wt, 'git', 'add', '.');
  sh(wt, 'git', 'commit', '-qm', 'Extract shared compute block');
  const v2 = evolve(repo, 'verify', 'c2');
  assert.equal(v2.json.ok, true, JSON.stringify(v2.json));
  assert.equal(v2.json.comparisons.duplication_pct.verdict, 'improved');
  assert.equal(evolve(repo, 'experiment', 'accept', 'c2', '--evidence', 'duplication down').json.status, 'accepted');

  const t3 = evolve(repo, 'tick', '--agent', 'test');
  assert.equal(t3.json.candidate.id, 'c1');
  const startSha = sh(wt, 'git', 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(wt, 'BROKEN'), 'x');
  fs.writeFileSync(path.join(wt, 'src', 'c.js'), 'export const c = 1;\n');
  sh(wt, 'git', 'add', '.');
  sh(wt, 'git', 'commit', '-qm', 'break');
  const v1 = evolve(repo, 'verify', 'c1');
  assert.equal(v1.json.ok, false);
  assert.ok(v1.json.failures.some((f) => /unit-tests failed/.test(f)), JSON.stringify(v1.json.failures));
  assert.equal(evolve(repo, 'experiment', 'reject', 'c1', '--reason', 'tests fail').json.status, 'rejected');
  assert.equal(sh(wt, 'git', 'rev-parse', 'HEAD'), startSha, 'rejected experiment reverted');
  assert.ok(!fs.existsSync(path.join(wt, 'BROKEN')));

  const fin = evolve(repo, 'finish', '--no-push');
  assert.equal(fin.json.done, true, JSON.stringify(fin.json));
  const report = fs.readFileSync(fin.json.report, 'utf8');
  assert.match(report, /Extract shared compute block/);
  assert.match(report, /Failed experiments[\s\S]*tests fail/);
  assert.match(report, /duplication_pct/);
  assert.ok(!fs.existsSync(wt), 'worktree removed after finishing');
  assert.equal(sh(repo, 'git', 'branch', '--list', `nightly/evolution-${night}`).length > 0, true, 'branch with accepted work is kept');

  const history = fs.readFileSync(path.join(repo, '.evolution', 'history.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(history.map((h) => `${h.kind}:${h.verdict}`), ['experiment:accepted', 'experiment:rejected', 'run:finished']);
  assert.deepEqual(fs.readdirSync(path.join(repo, '.evolution')).sort(), ['baselines.json', 'history.jsonl', 'policy.yaml'], 'only durable files in the checkout');
  const baselines = fs.readFileSync(path.join(repo, '.evolution', 'baselines.json'), 'utf8');
  assert.equal(baselines, formatJson(JSON.parse(baselines)), 'baselines stay in formatter-stable layout');
  assert.equal(evolve(repo, 'tick').json.action, 'idle', 'a finished night stays finished');

  const dry = evolve(repo, 'dry-run');
  assert.equal(dry.json.ok, true, JSON.stringify(dry.json));
  assert.equal(fs.readFileSync(path.join(repo, '.evolution', 'history.jsonl'), 'utf8').trim().split('\n').length, 3, 'dry runs never touch real history');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("tonight's branch started by another process is never adopted", { timeout: 60_000 }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-foreign-'));
  const repo = path.join(tmp, 'demo');
  fs.mkdirSync(repo, { recursive: true });
  sh(repo, 'git', 'init', '-q', '-b', 'main');
  sh(repo, 'git', 'config', 'user.email', 't@example.com');
  sh(repo, 'git', 'config', 'user.name', 'Test');
  fs.writeFileSync(path.join(repo, 'a.js'), 'export const a = 1;\n');
  sh(repo, 'git', 'add', '.');
  sh(repo, 'git', 'commit', '-qm', 'init');
  assert.equal(evolve(repo, 'init').code, 0);
  const branch = `nightly/evolution-${nightDate('22:00-07:00')}`;
  sh(repo, 'git', 'branch', branch);
  sh(repo, 'git', 'worktree', 'add', '-q', path.join(tmp, 'other-agent'), branch);
  fs.writeFileSync(path.join(tmp, 'other-agent', 'wip.js'), 'work in progress\n');

  const t = evolve(repo, 'tick', '--force', '--agent', 'test');
  assert.equal(t.code, 0, t.stderr);
  assert.equal(t.json.action, 'idle', JSON.stringify(t.json));
  assert.match(t.json.why, /was not started by this engine/);
  assert.ok(!evolve(repo, 'status').json.night, 'no night state created');
  assert.ok(fs.existsSync(path.join(tmp, 'other-agent', 'wip.js')), "the other agent's work is untouched");
  sh(repo, 'git', 'worktree', 'remove', '--force', path.join(tmp, 'other-agent'));
  sh(repo, 'git', 'branch', '-D', branch);

  sh(repo, 'git', 'worktree', 'add', '-q', '-b', 'nightly/evolution-1999-01-01', path.join(tmp, 'other-date'));
  const t2 = evolve(repo, 'tick', '--force', '--agent', 'test');
  assert.equal(t2.json.action, 'idle', 'a differently dated evolution by another process also blocks a second run');
  assert.match(t2.json.why, /nightly\/evolution-1999-01-01/);
  sh(repo, 'git', 'worktree', 'remove', '--force', path.join(tmp, 'other-date'));
  fs.rmSync(tmp, { recursive: true, force: true });
});
