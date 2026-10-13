import fs from 'node:fs';
import path from 'node:path';
import { defaultBranch, git, listWorktrees } from './repo.mjs';
import { readJson, toPosix } from './util.mjs';

const exists = (...p) => fs.existsSync(path.join(...p));

function subdirs(root, rel) {
  const dir = path.join(root, rel);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
    .map((d) => `${rel}/${d.name}`);
}

function skillsIn(root) {
  const found = [];
  for (const base of ['.agents/skills', '.claude/skills', '.opencode/skills', '.cursor/skills']) {
    for (const dir of subdirs(root, base)) {
      const file = path.join(root, dir, 'SKILL.md');
      if (!fs.existsSync(file)) continue;
      const head = fs.readFileSync(file, 'utf8').slice(0, 1500);
      const name = /^name:\s*(.+)$/m.exec(head)?.[1]?.trim() ?? path.basename(dir);
      found.push({ name, path: `${dir}/SKILL.md` });
    }
  }
  return found;
}

/** Read-only inspection of a repository; the result seeds policy generation and reports. */
export function discover(repo) {
  const root = repo.main;
  const files = git(root, ['ls-files'], { allowFail: true }).stdout.split('\n').filter(Boolean);
  const byExt = {};
  for (const f of files) {
    const ext = path.extname(f).toLowerCase() || '(none)';
    byExt[ext] = (byExt[ext] || 0) + 1;
  }
  const languages = Object.entries(byExt)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([ext, count]) => ({ ext, count }));

  const pkg = readJson(path.join(root, 'package.json'), null);
  const packageManager = exists(root, 'pnpm-lock.yaml') ? 'pnpm' : exists(root, 'yarn.lock') ? 'yarn' : exists(root, 'package-lock.json') ? 'npm' : pkg ? 'npm' : null;

  const areas = ['apps', 'packages', 'modules', 'services', 'libs', 'tools'].flatMap((d) => subdirs(root, d));
  const pythonProjects = [root, ...areas.map((a) => path.join(root, a))]
    .filter((d) => fs.existsSync(path.join(d, 'pyproject.toml')) || fs.existsSync(path.join(d, 'requirements.txt')))
    .map((d) => toPosix(path.relative(root, d)) || '.');
  const venvs = pythonProjects
    .map((p) => [p, ['.venv/Scripts/python.exe', '.venv/bin/python'].find((v) => exists(root, p, v))])
    .filter(([, v]) => v)
    .map(([p, v]) => toPosix(path.join(p, v)));

  const playwrightConfigs = files.filter((f) => /(^|\/)playwright[^/]*\.config\.(ts|js|mjs)$/.test(f));
  const designReferences = files.filter((f) => /\.(png|jpe?g|webp)$/i.test(f) && /(^|\/)docs\//.test(f) && /(ui|design|screenshot|baseline|home|report)/i.test(f));
  const docs = ['AGENTS.md', 'CLAUDE.md', 'docs/ARCHITECTURE.md', 'docs/architecture.md', 'docs/DESIGN_SYSTEM.md', 'docs/DESIGN_PRINCIPLES.md', 'docs/FUTURE_SCOPE.md', 'docs/roadmap.md', 'docs/UI_QUALITY_WORKFLOW.md'].filter((d) => exists(root, d));
  const ci = subdirs(root, '.github').length ? files.filter((f) => f.startsWith('.github/workflows/')) : [];

  const gitignore = exists(root, '.gitignore') ? fs.readFileSync(path.join(root, '.gitignore'), 'utf8') : '';
  const worktreeHints = gitignore
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && /worktree/i.test(l));
  const worktrees = listWorktrees(root).map((w) => ({ path: toPosix(path.relative(root, w.path)) || '.', branch: w.branch }));

  const skills = skillsIn(root);
  const loops = skills.filter((s) => /night|loop|backlog|autopilot|watch/i.test(`${s.name} ${s.path}`));

  return {
    name: path.basename(root),
    root: toPosix(root),
    defaultBranch: defaultBranch(root),
    remote: git(root, ['remote', 'get-url', 'origin'], { allowFail: true }).stdout.trim() || null,
    trackedFiles: files.length,
    languages,
    node: pkg
      ? {
          packageManager,
          lockfile: ['pnpm-lock.yaml', 'yarn.lock', 'package-lock.json'].some((f) => exists(root, f)),
          scripts: Object.keys(pkg.scripts || {}),
          workspace: exists(root, 'pnpm-workspace.yaml') || Boolean(pkg.workspaces),
        }
      : null,
    python: pythonProjects.length ? { projects: pythonProjects, venvs } : null,
    areas,
    playwrightConfigs,
    designReferences,
    docs,
    ci,
    worktreeHints,
    worktrees,
    skills,
    loops,
    signals: {
      kriya: exists(root, 'kriya.config.json') || exists(root, 'modules/kriya'),
      viveka: exists(root, 'modules/viveka'),
      artha: exists(root, 'modules/artha'),
      ui: areas.some((a) => /web|ui|frontend|site|extension/i.test(a)) || exists(root, 'index.html'),
      docker: exists(root, 'docker-compose.yml') || exists(root, 'Dockerfile'),
    },
  };
}
