// Detect the repository and environment: stack, evaluation commands, signals and agents.
import fs from 'node:fs';
import path from 'node:path';
import { runSync, commandExists, readJson } from '../../../../nightly-evolution/scripts/lib/util.mjs';

const exists = (...p) => fs.existsSync(path.join(...p));

export function trackedFiles(dir) {
  const r = runSync(['git', 'ls-files', '--cached', '--others', '--exclude-standard'], { cwd: dir, allowFail: true });
  return r.code === 0 ? r.stdout.split('\n').filter(Boolean) : [];
}

function pythonFor(dir) {
  for (const v of ['.venv/Scripts/python.exe', '.venv/bin/python', 'venv/Scripts/python.exe', 'venv/bin/python']) if (exists(dir, v)) return v;
  if (commandExists('python')) return 'python';
  if (commandExists('python3')) return 'python3';
  if (commandExists('py')) return 'py -3';
  return null;
}

function hasPytest(python, dir) {
  if (!python) return false;
  const argv = python === 'py -3' ? ['py', '-3'] : [python.includes('/') ? path.join(dir, python) : python];
  return runSync([...argv, '-c', 'import pytest'], { cwd: dir, allowFail: true, timeoutMs: 30_000 }).code === 0;
}

/**
 * Evaluation commands the supervisor runs itself, detected from the stack when the config
 * names none. Each is { name, run, kind } where kind is tests | lint | typecheck | build | check.
 */
export function detectEvaluation(dir, files = trackedFiles(dir)) {
  const out = [];
  const pkg = readJson(path.join(dir, 'package.json'), null);
  if (pkg) {
    const pm = exists(dir, 'pnpm-lock.yaml') ? 'pnpm' : exists(dir, 'yarn.lock') ? 'yarn' : 'npm';
    const scripts = pkg.scripts || {};
    const runScript = (s) => (pm === 'npm' ? (s === 'test' ? 'npm test' : `npm run ${s}`) : `${pm} ${s}`);
    if (scripts.test && !/no test specified/.test(scripts.test)) out.push({ name: 'test', run: runScript('test'), kind: 'tests' });
    for (const [s, kind] of [['typecheck', 'typecheck'], ['lint', 'lint'], ['build', 'build']]) if (scripts[s]) out.push({ name: s, run: runScript(s), kind });
  }
  if (!out.some((c) => c.kind === 'tests') && files.some((f) => /(^|\/)[^/]+\.test\.m?js$/.test(f) && !f.includes('node_modules/'))) {
    out.push({ name: 'node-test', run: 'node --test', kind: 'tests' });
  }
  const pyFiles = files.filter((f) => f.endsWith('.py'));
  if (pyFiles.length) {
    const python = pythonFor(dir);
    const testFiles = pyFiles.filter((f) => /(^|\/)(test_[^/]+|[^/]+_test)\.py$/.test(f));
    const configured = exists(dir, 'pytest.ini') || exists(dir, 'conftest.py') || (exists(dir, 'pyproject.toml') && /\[tool\.pytest/.test(fs.readFileSync(path.join(dir, 'pyproject.toml'), 'utf8')));
    if (python && (testFiles.length || configured)) {
      out.push(hasPytest(python, dir)
        ? { name: 'pytest', run: `${python} -m pytest -q`, kind: 'tests' }
        : { name: 'unittest', run: `${python} -m unittest discover -s ${testFiles[0]?.includes('/') ? testFiles[0].split('/')[0] : '.'} -p "test*.py"`, kind: 'tests' });
    }
    if (exists(dir, 'ruff.toml') || (exists(dir, 'pyproject.toml') && /\[tool\.ruff/.test(fs.readFileSync(path.join(dir, 'pyproject.toml'), 'utf8')))) {
      if (commandExists('ruff')) out.push({ name: 'ruff', run: 'ruff check .', kind: 'lint' });
    }
  }
  return out;
}

const FRONTEND_DEPS = /^(react|react-dom|vue|svelte|@sveltejs\/kit|next|nuxt|vite|@angular\/core|solid-js|astro|preact|lit)$/;
const BACKEND_DEPS = /^(express|fastify|koa|hono|@nestjs\/core|flask|django|fastapi)$/;

export function detectEnv(dir) {
  const files = trackedFiles(dir);
  const pkg = readJson(path.join(dir, 'package.json'), null);
  const deps = pkg ? Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }) : [];
  const pyReq = ['requirements.txt', 'pyproject.toml'].filter((f) => exists(dir, f)).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const evaluation = detectEvaluation(dir, files);
  const frontend = deps.some((d) => FRONTEND_DEPS.test(d)) || files.some((f) => /\.(html|jsx|tsx|vue|svelte|css)$/.test(f) && !f.startsWith('node_modules/'));
  const backend = deps.some((d) => BACKEND_DEPS.test(d)) || /\b(flask|django|fastapi|sqlalchemy)\b/i.test(pyReq) || files.some((f) => f.endsWith('.py'));
  const todos = runSync(['git', 'grep', '-I', '-c', '-E', '\\b(TODO|FIXME|HACK|XXX)\\b', '--', '.', ':!*.md', ':!*.lock', ':!*lock.json'], { cwd: dir, allowFail: true });
  const todoCount = todos.code === 0 ? todos.stdout.split('\n').filter(Boolean).reduce((n, l) => n + Number(l.split(':').pop() || 0), 0) : 0;
  const dirty = runSync(['git', 'status', '--porcelain', '--untracked-files=normal'], { cwd: dir, allowFail: true }).stdout.split('\n').filter((l) => l && !/^\?\? \.night\//.test(l));
  const signals = new Set();
  if (evaluation.some((c) => c.kind === 'tests')) signals.add('has-tests');
  else signals.add('no-tests');
  if (frontend) signals.add('frontend');
  if (backend) signals.add('backend');
  if (files.some((f) => f.endsWith('.py'))) signals.add('python');
  if (pkg) signals.add('node');
  if (files.some((f) => /^readme(\.md)?$/i.test(f) || f.startsWith('docs/'))) signals.add('docs');
  else signals.add('no-docs');
  if (todoCount) signals.add('todos');
  if (pkg || pyReq) signals.add('deps');
  if (files.some((f) => f.startsWith('.github/workflows/'))) signals.add('ci');
  if (files.some((f) => /(^|\/)SKILL\.md$/.test(f))) signals.add('skills');
  if (dirty.length) signals.add('dirty-tree');
  if (files.some((f) => /(^|\/)playwright[^/]*\.config\.(ts|js|mjs)$/.test(f))) signals.add('playwright');
  if (evaluation.some((c) => c.kind === 'lint')) signals.add('lint');
  return {
    root: dir,
    name: path.basename(dir),
    files: files.length,
    languages: [...new Set(files.map((f) => path.extname(f).toLowerCase()).filter(Boolean))].slice(0, 12),
    node: pkg ? { name: pkg.name || null, scripts: Object.keys(pkg.scripts || {}) } : null,
    python: files.some((f) => f.endsWith('.py')),
    evaluation,
    todos: todoCount,
    dirty,
    signals: [...signals].sort(),
    platform: process.platform,
    node_version: process.version,
  };
}
