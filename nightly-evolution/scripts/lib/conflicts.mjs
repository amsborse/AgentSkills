import path from 'node:path';
import { git, listWorktrees } from './repo.mjs';
import { commandExists, expand, matchesAny, pathsOverlap, run, runSync, toPosix } from './util.mjs';

/**
 * Paths that other in-flight work already owns: files changed in open pull requests and in
 * other worktrees (Kriya task candidates, night-loop fixes, human branches). Evolution must not
 * edit them, so its PR never conflicts with work that is already under way.
 */
export async function lockedPaths(repo, policy, { ownWorktree, base }) {
  const locked = new Map();
  const add = (file, owner) => {
    const f = toPosix(file);
    if (!locked.has(f)) locked.set(f, owner);
  };
  const ignore = policy.conflicts.ignore_branches || [];
  const notes = [];

  if (policy.conflicts.other_worktrees) {
    for (const wt of listWorktrees(repo.main)) {
      if (wt.prunable || path.resolve(wt.path) === path.resolve(ownWorktree || '') || path.resolve(wt.path) === path.resolve(repo.main)) continue;
      if (wt.branch && matchesAny(wt.branch, ignore)) continue;
      const owner = `worktree ${toPosix(path.relative(repo.main, wt.path)) || wt.path} (${wt.branch || 'detached'})`;
      const status = git(wt.path, ['status', '--porcelain'], { allowFail: true });
      for (const line of status.stdout.split('\n').filter(Boolean)) add(line.slice(3).replace(/^"|"$/g, '').split(' -> ').pop(), owner);
      const mb = git(wt.path, ['merge-base', 'HEAD', base], { allowFail: true });
      if (mb.code === 0) {
        const diff = git(wt.path, ['diff', '--name-only', `${mb.stdout.trim()}..HEAD`], { allowFail: true });
        for (const f of diff.stdout.split('\n').filter(Boolean)) add(f, owner);
      }
    }
    // Uncommitted work in the main checkout belongs to whoever is working there.
    const mainStatus = git(repo.main, ['status', '--porcelain'], { allowFail: true });
    for (const line of mainStatus.stdout.split('\n').filter(Boolean)) add(line.slice(3).replace(/^"|"$/g, '').split(' -> ').pop(), 'main checkout (uncommitted)');
  }

  if (policy.conflicts.open_prs && commandExists('gh')) {
    const res = runSync(['gh', 'pr', 'list', '--state', 'open', '--limit', '50', '--json', 'number,headRefName,files'], { cwd: repo.main, allowFail: true, timeoutMs: 60_000 });
    if (res.code === 0) {
      for (const pr of JSON.parse(res.stdout || '[]')) {
        if (matchesAny(pr.headRefName, ignore)) continue;
        for (const f of pr.files || []) add(f.path, `PR #${pr.number} (${pr.headRefName})`);
      }
    } else notes.push(`open PR scan skipped: ${res.stderr.split('\n')[0]}`);
  }

  for (const c of policy.conflicts.commands || []) {
    const res = await run(expand(c.run, { main: repo.main }), { cwd: repo.main, timeoutMs: Number(c.timeout_minutes || 2) * 60_000 });
    if (res.code !== 0) {
      notes.push(`conflict command ${c.name} failed (${res.code}); treating its paths as unknown`);
      continue;
    }
    for (const f of res.stdout.split('\n').map((s) => s.trim()).filter(Boolean)) add(f, c.name);
  }
  return { paths: Object.fromEntries(locked), notes };
}

export function overlaps(files, locked) {
  const hits = [];
  for (const f of files) {
    for (const [p, owner] of Object.entries(locked)) {
      if (pathsOverlap(f, p)) hits.push({ file: f, lockedBy: owner, path: p });
    }
  }
  return hits;
}

export function protectedHits(files, policy) {
  return files.filter((f) => matchesAny(f, policy.protected_paths || []));
}
