// Detect the repository and environment: stack, evaluation commands, stage, domain signals and agents.
import fs from 'node:fs';
import path from 'node:path';
import { runSync, commandExists, readJson } from '../../../../nightly-evolution/scripts/lib/util.mjs';

const exists = (...p) => fs.existsSync(path.join(...p));
const readText = (...p) => { try { return fs.readFileSync(path.join(...p), 'utf8'); } catch { return ''; } };

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
    const pm = exists(dir, 'pnpm-lock.yaml') ? 'pnpm'
      : exists(dir, 'yarn.lock') ? 'yarn'
        : (exists(dir, 'bun.lock') || exists(dir, 'bun.lockb')) && commandExists('bun') ? 'bun'
          : 'npm';
    const scripts = pkg.scripts || {};
    const runScript = (s) => (pm === 'npm' ? (s === 'test' ? 'npm test' : `npm run ${s}`) : pm === 'bun' ? `bun run ${s}` : `${pm} ${s}`);
    if (scripts.test && !/no test specified/.test(scripts.test)) out.push({ name: 'test', run: runScript('test'), kind: 'tests' });
    for (const [s, kind] of [['typecheck', 'typecheck'], ['lint', 'lint'], ['build', 'build']]) if (scripts[s]) out.push({ name: s, run: runScript(s), kind });
    if (!out.some((c) => c.kind === 'typecheck') && exists(dir, 'tsconfig.json') && (exists(dir, 'node_modules/.bin/tsc') || exists(dir, 'node_modules/.bin/tsc.cmd'))) {
      out.push({ name: 'typecheck', run: 'npx --no-install tsc --noEmit', kind: 'typecheck' });
    }
    if (!out.some((c) => c.kind === 'tests') && files.some((f) => /^vitest\.config\.(ts|js|mjs|mts)$/.test(f)) && (exists(dir, 'node_modules/.bin/vitest') || exists(dir, 'node_modules/.bin/vitest.cmd'))) {
      out.push({ name: 'vitest', run: 'npx --no-install vitest run', kind: 'tests' });
    }
  }
  if (!out.some((c) => c.kind === 'tests') && files.some((f) => /(^|\/)[^/]+\.test\.m?js$/.test(f) && !f.includes('node_modules/'))) {
    out.push({ name: 'node-test', run: 'node --test', kind: 'tests' });
  }
  if ((exists(dir, 'deno.json') || exists(dir, 'deno.jsonc')) && commandExists('deno')) {
    if (files.some((f) => /([._-]test)\.(ts|tsx|js|mjs)$/.test(f))) out.push({ name: 'deno-test', run: 'deno test', kind: 'tests' });
  }
  const pyFiles = files.filter((f) => f.endsWith('.py'));
  if (pyFiles.length) {
    const python = pythonFor(dir);
    const testFiles = pyFiles.filter((f) => /(^|\/)(test_[^/]+|[^/]+_test)\.py$/.test(f));
    const pyproj = readText(dir, 'pyproject.toml');
    const configured = exists(dir, 'pytest.ini') || exists(dir, 'conftest.py') || /\[tool\.pytest/.test(pyproj);
    if (testFiles.length || configured) {
      if (exists(dir, 'uv.lock') && commandExists('uv') && (!python || !hasPytest(python, dir))) {
        out.push({ name: 'pytest', run: 'uv run pytest -q', kind: 'tests' });
      } else if (python) {
        out.push(hasPytest(python, dir)
          ? { name: 'pytest', run: `${python} -m pytest -q`, kind: 'tests' }
          : { name: 'unittest', run: `${python} -m unittest discover -s ${testFiles[0]?.includes('/') ? testFiles[0].split('/')[0] : '.'} -p "test*.py"`, kind: 'tests' });
      }
    }
    if ((exists(dir, 'ruff.toml') || /\[tool\.ruff/.test(pyproj)) && commandExists('ruff')) {
      out.push({ name: 'ruff', run: 'ruff check .', kind: 'lint' });
    }
    if ((exists(dir, 'mypy.ini') || /\[tool\.mypy/.test(pyproj)) && commandExists('mypy')) {
      out.push({ name: 'mypy', run: 'mypy .', kind: 'typecheck' });
    }
  }
  if (exists(dir, 'Cargo.toml') && commandExists('cargo')) {
    const rsFiles = files.filter((f) => f.endsWith('.rs'));
    const hasRsTests = rsFiles.some((f) => f.startsWith('tests/') || /#\[(?:cfg\(test\)|test|tokio::test)\]/.test(readText(dir, f)));
    if (hasRsTests) out.push({ name: 'cargo-test', run: 'cargo test --quiet', kind: 'tests' });
    out.push({ name: 'cargo-check', run: 'cargo check --quiet', kind: 'build' });
  }
  if (exists(dir, 'go.mod') && commandExists('go')) {
    if (files.some((f) => f.endsWith('_test.go'))) out.push({ name: 'go-test', run: 'go test ./...', kind: 'tests' });
    if (files.some((f) => f.endsWith('.go'))) out.push({ name: 'go-vet', run: 'go vet ./...', kind: 'lint' });
  }
  if (files.some((f) => /\.(sln|csproj)$/.test(f)) && !exists(dir, 'ProjectSettings/ProjectVersion.txt') && commandExists('dotnet')) {
    if (files.some((f) => /Tests?\.(csproj|cs)$/.test(f))) out.push({ name: 'dotnet-test', run: 'dotnet test --nologo -v q', kind: 'tests' });
    else out.push({ name: 'dotnet-build', run: 'dotnet build --nologo -v q', kind: 'build' });
  }
  if (exists(dir, 'Package.swift') && commandExists('swift')) {
    if (files.some((f) => f.startsWith('Tests/'))) out.push({ name: 'swift-test', run: 'swift test', kind: 'tests' });
    else out.push({ name: 'swift-build', run: 'swift build', kind: 'build' });
  }
  if (exists(dir, 'project.godot') && commandExists('godot')) {
    out.push({ name: 'godot-check', run: 'godot --headless --quit', kind: 'build' });
  }
  return out;
}

/**
 * Safe starter checks `night bootstrap` can write to .night/config.yaml for a Stage-0 / prototype
 * repository that has no test suite or build script yet. Never used silently without bootstrap.
 */
export function detectBootstrapEvaluation(dir, files = trackedFiles(dir)) {
  const existing = detectEvaluation(dir, files);
  if (existing.length) return existing;
  const out = [];
  if (files.some((f) => /\.(m?js|cjs)$/.test(f) && !f.startsWith('node_modules/'))) {
    out.push({
      name: 'js-syntax',
      kind: 'build',
      run: 'node -e "const fs=require(\'fs\'),cp=require(\'child_process\');const files=cp.execFileSync(\'git\',[\'ls-files\',\'*.js\',\'*.mjs\',\'*.cjs\'],{encoding:\'utf8\'}).split(/\\r?\\n/).filter(f=>f&&!f.startsWith(\'node_modules/\'));for(const f of files){if(!fs.existsSync(f))continue;const r=cp.spawnSync(process.execPath,[\'--check\',f],{stdio:\'inherit\'});if(r.status!==0)process.exit(r.status||1);}"',
    });
  }
  if (files.some((f) => f.endsWith('.py'))) {
    const python = pythonFor(dir);
    if (python) out.push({ name: 'py-compile', run: `${python} -m compileall -q .`, kind: 'build' });
  }
  if (files.some((f) => f.endsWith('.json') && !f.startsWith('node_modules/'))) {
    out.push({
      name: 'json-syntax',
      kind: 'lint',
      run: 'node -e "const fs=require(\'fs\'),cp=require(\'child_process\');for(const f of cp.execFileSync(\'git\',[\'ls-files\',\'*.json\'],{encoding:\'utf8\'}).split(/\\r?\\n/).filter(Boolean)){if(fs.existsSync(f))JSON.parse(fs.readFileSync(f,\'utf8\'));}"',
    });
  }
  return out;
}

const FRONTEND_DEPS = /^(react|react-dom|vue|svelte|@sveltejs\/kit|next|nuxt|vite|@angular\/core|solid-js|astro|preact|lit|remix|@remix-run\/react)$/;
const BACKEND_DEPS = /^(express|fastify|koa|hono|@nestjs\/core|flask|django|fastapi|@trpc\/server|elysia)$/;
const FULLSTACK_DEPS = /^(next|nuxt|@sveltejs\/kit|astro|remix|@remix-run\/node|@supabase\/supabase-js|convex|firebase)$/;
const SAAS_DEPS = /^(stripe|@stripe\/stripe-js|@clerk\/nextjs|@clerk\/backend|next-auth|better-auth|lucia|@workos-inc\/node|posthog-js|posthog-node|resend|@prisma\/client|drizzle-orm|bullmq|inngest|@trigger\.dev\/sdk|@lemonsqueezy\/lemonsqueezy\.js|paddle-sdk)$/;
const GAME_DEPS = /^(phaser|pixi\.js|@pixi\/core|kaboom|kaplay|excalibur|babylonjs|@babylonjs\/core|playcanvas|littlejsengine|rot-js|matter-js|planck|@dimforge\/rapier2d|@dimforge\/rapier3d|howler|zzfx)$/;
const AI_DEPS = /^(openai|@anthropic-ai\/sdk|@google\/genai|@google\/generative-ai|ai|@ai-sdk\/openai|@ai-sdk\/anthropic|langchain|@langchain\/core|llamaindex|ollama|@modelcontextprotocol\/sdk)$/;

export function detectEnv(dir) {
  const files = trackedFiles(dir);
  const pkg = readJson(path.join(dir, 'package.json'), null);
  const deps = pkg ? Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }) : [];
  const pyReq = ['requirements.txt', 'pyproject.toml'].filter((f) => exists(dir, f)).map((f) => readText(dir, f)).join('\n');
  const cargoToml = exists(dir, 'Cargo.toml') ? readText(dir, 'Cargo.toml') : '';
  const goMod = exists(dir, 'go.mod') ? readText(dir, 'go.mod') : '';
  const evaluation = detectEvaluation(dir, files);

  const frontend = deps.some((d) => FRONTEND_DEPS.test(d)) || files.some((f) => /\.(html|jsx|tsx|vue|svelte|css)$/.test(f) && !f.startsWith('node_modules/'));
  const backend = deps.some((d) => BACKEND_DEPS.test(d))
    || /\b(flask|django|fastapi|sqlalchemy|uvicorn|celery)\b/i.test(pyReq)
    || /\b(axum|actix-web|rocket|warp|tonic)\b/i.test(cargoToml)
    || /\b(gin-gonic|gofiber|labstack\/echo|go-chi)\b/i.test(goMod)
    || files.some((f) => f.endsWith('.py') || /(^|\/)(api|server|routes|controllers)\//.test(f));

  const game = exists(dir, 'project.godot')
    || exists(dir, 'ProjectSettings/ProjectVersion.txt')
    || exists(dir, 'conf.lua')
    || files.some((f) => /\.(uproject|godot|tscn|gd|unity)$/.test(f))
    || deps.some((d) => GAME_DEPS.test(d))
    || /\b(pygame|arcade|pyxel|panda3d|ursina)\b/i.test(pyReq)
    || /\b(bevy|macroquad|ggez|fyrox|rapier2d|rapier3d)\b/i.test(cargoToml)
    || /\b(ebiten|raylib-go)\b/i.test(goMod)
    || (deps.includes('three') && files.some((f) => /(^|\/)(game|player|enemy|enemies|level|levels|spawner|hud|collider)\b/i.test(f)));

  const saas = !game && (frontend || backend) && (
    deps.some((d) => SAAS_DEPS.test(d))
    || (deps.some((d) => FULLSTACK_DEPS.test(d)) && files.some((f) => /(^|\/)(auth|billing|stripe|webhook|tenant|org|workspace|onboarding|pricing|subscription|dashboard|admin)\b/i.test(f)))
    || /\b(stripe|celery|allauth|authlib|sqlmodel|alembic)\b/i.test(pyReq)
  );

  const ai = deps.some((d) => AI_DEPS.test(d))
    || /\b(openai|anthropic|google-genai|langchain|llamaindex|litellm|ollama|fastmcp)\b/i.test(pyReq);

  const todos = runSync(['git', 'grep', '-I', '-c', '-E', '\\b(TODO|FIXME|HACK|XXX)\\b', '--', '.', ':!*.md', ':!*.lock', ':!*lock.json'], { cwd: dir, allowFail: true });
  const todoCount = todos.code === 0 ? todos.stdout.split('\n').filter(Boolean).reduce((n, l) => n + Number(l.split(':').pop() || 0), 0) : 0;
  const dirty = runSync(['git', 'status', '--porcelain', '--untracked-files=normal'], { cwd: dir, allowFail: true }).stdout.split('\n').filter((l) => l && !/^\?\? \.night\//.test(l));

  const hasTests = evaluation.some((c) => c.kind === 'tests');
  const hasCi = files.some((f) => f.startsWith('.github/workflows/') || f === '.gitlab-ci.yml');
  const hasStaticGates = evaluation.some((c) => c.kind === 'lint' || c.kind === 'typecheck' || c.kind === 'build');

  const signals = new Set();
  if (hasTests) signals.add('has-tests');
  else signals.add('no-tests');
  if (frontend) signals.add('frontend');
  if (backend) signals.add('backend');
  if (game) signals.add('game');
  if (saas) signals.add('saas');
  if (ai) signals.add('ai');
  if (files.some((f) => f.endsWith('.py'))) signals.add('python');
  if (pkg) signals.add('node');
  if (exists(dir, 'Cargo.toml')) signals.add('rust');
  if (exists(dir, 'go.mod')) signals.add('go');
  if (files.some((f) => /\.(sln|csproj)$/.test(f))) signals.add('dotnet');
  if (exists(dir, 'Package.swift')) signals.add('swift');
  if (exists(dir, 'project.godot')) signals.add('godot');
  if (exists(dir, 'Dockerfile') || files.some((f) => /^docker-compose/.test(f))) signals.add('docker');
  if (exists(dir, 'pnpm-workspace.yaml') || exists(dir, 'turbo.json') || Array.isArray(pkg?.workspaces)) signals.add('monorepo');
  if (files.some((f) => /^readme(\.md)?$/i.test(f) || f.startsWith('docs/'))) signals.add('docs');
  else signals.add('no-docs');
  if (todoCount) signals.add('todos');
  if (pkg || pyReq || cargoToml || goMod) signals.add('deps');
  if (hasCi) signals.add('ci');
  if (files.some((f) => /(^|\/)SKILL\.md$/.test(f))) signals.add('skills');
  if (dirty.length) signals.add('dirty-tree');
  if (files.some((f) => /(^|\/)playwright[^/]*\.config\.(ts|js|mjs)$/.test(f))) signals.add('playwright');
  if (evaluation.some((c) => c.kind === 'lint')) signals.add('lint');

  const stage = !hasTests && !hasStaticGates && files.length < 10 ? 'seed'
    : !hasTests ? 'prototype'
      : !hasCi || !hasStaticGates ? 'mvp'
        : 'production';
  signals.add(`stage-${stage}`);

  return {
    root: dir,
    name: path.basename(dir),
    stage,
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
