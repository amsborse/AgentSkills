// Worktrees for a night run. The user's checkout is never touched: a run branch gets its own
// worktree, and each concurrent lane is a detached worktree synced to the run head. Reverts undo
// exactly one task: they restore tracked files from the task's checkpoint and delete only the
// untracked files the task created. No `reset --hard`, no `clean`.
import fs from 'node:fs';
import path from 'node:path';
import { runSync, run, expand, localDate, nowIso, writeJson, readJson } from '../../../../nightly-evolution/scripts/lib/util.mjs';

const g = (cwd, args, opts = {}) => runSync(['git', ...args], { cwd, allowFail: true, timeoutMs: 120_000, ...opts });
const out = (cwd, args) => g(cwd, args).stdout.trim();
const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);
/**
 * Paths from a git listing, NUL-separated (`-z`) so names with spaces, quotes or non-ASCII
 * characters come back literally instead of C-quoted. Diffs pass `--no-renames` so a rename is a
 * deletion plus an addition and both sides are seen.
 */
export const gitPaths = (cwd, [cmd, ...rest]) => g(cwd, ['-c', 'core.quotePath=false', cmd, '-z', ...rest]).stdout.split('\0').filter(Boolean);
const changedSince = (cwd, sha, cached = false) => gitPaths(cwd, ['diff', ...(cached ? ['--cached'] : []), '--no-renames', '--name-only', sha, '--']);

export function slug(text, max = 32) {
  return String(text || 'run').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '') || 'run';
}

export function workspaceRoot(root, config) {
  return path.resolve(root, expand(config.workspace?.dir || '../{repo}-night', { repo: path.basename(root) }));
}

export const head = (cwd) => out(cwd, ['rev-parse', 'HEAD']);
export const untracked = (cwd) => gitPaths(cwd, ['ls-files', '--others', '--exclude-standard']);
export const currentBranch = (cwd) => { const b = out(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']); return b && b !== 'HEAD' ? b : null; };
export const dirtyFiles = (cwd) => gitPaths(cwd, ['status', '--porcelain', '--no-renames', '--untracked-files=all']).map((l) => l.slice(3));

function branchExists(root, branch) {
  return g(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]).code === 0;
}

/** A fresh run branch name that does not exist yet. */
export function runBranch(root, config, label) {
  const base = `${config.workspace?.branch_prefix || 'night/'}${localDate()}-${slug(label)}`;
  let name = base;
  for (let i = 2; branchExists(root, name); i++) name = `${base}-${i}`;
  return name;
}

async function setup(dir, config, logDir) {
  const results = [];
  for (const cmd of config.workspace?.setup || []) {
    const r = await run(cmd, { cwd: dir, timeoutMs: 20 * 60_000, logFile: logDir ? path.join(logDir, `setup-${Date.now()}.log`) : undefined });
    results.push({ cmd, code: r.code, ms: r.ms });
    if (r.code !== 0) {
      const err = new Error(`workspace setup failed in ${dir}: ${cmd} exited ${r.code}: ${r.stderr.slice(-400) || r.stdout.slice(-400)}`);
      err.code = 'SETUP';
      throw err;
    }
  }
  return results;
}

/** Create (or reuse on resume) the run worktree on a new branch from `baseSha`. */
export async function createRunWorktree(root, { dir, branch, baseSha, config, logDir }) {
  if (fs.existsSync(path.join(dir, '.git'))) return { dir, reused: true, setup: [] };
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const r = g(root, ['worktree', 'add', '-b', branch, dir, baseSha]);
  if (r.code !== 0) throw new Error(`git worktree add failed: ${r.stderr}`);
  return { dir, reused: false, setup: await setup(dir, config, logDir) };
}

/** A detached lane worktree at `sha`. Reused lanes must be clean (the supervisor reverts first). */
export async function ensureLane(root, { dir, sha, config, logDir }) {
  if (!fs.existsSync(path.join(dir, '.git'))) {
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    const r = g(root, ['worktree', 'add', '--detach', dir, sha]);
    if (r.code !== 0) throw new Error(`git worktree add (lane) failed: ${r.stderr}`);
    await setup(dir, config, logDir);
    return dir;
  }
  syncLane(dir, sha);
  return dir;
}

export function syncLane(dir, sha) {
  const dirty = dirtyFiles(dir);
  if (dirty.length) throw new Error(`lane ${dir} is not clean (${dirty.slice(0, 3).join(', ')}); refusing to move it`);
  const r = g(dir, ['checkout', '--quiet', '--detach', sha]);
  if (r.code !== 0) throw new Error(`lane checkout failed: ${r.stderr}`);
}

/** Snapshot before a task: the commit and the untracked files that already exist. */
export function checkpoint(dir, file, extra = {}) {
  const cp = { sha: head(dir), untracked: untracked(dir), dir, at: nowIso(), ...extra };
  if (file) writeJson(file, cp);
  return cp;
}

/** Remote-tracking refs and their shas, for spotting a push made behind the supervisor's back. */
export const remoteRefs = (cwd) => g(cwd, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/remotes']).stdout;

export const readCheckpoint = (file) => readJson(file, null);

/**
 * Undo everything since the checkpoint in this worktree only: agent commits (mixed reset keeps
 * the files so they can be restored by path), tracked edits, and new untracked files.
 */
export function revertTo(dir, cp) {
  const undone = { commits: 0, restored: [], removed: [] };
  if (!fs.existsSync(dir)) return undone;
  const pick = out(dir, ['rev-parse', '--git-path', 'CHERRY_PICK_HEAD']);
  if (pick && fs.existsSync(path.resolve(dir, pick))) g(dir, ['cherry-pick', '--abort']);
  const now = head(dir);
  if (now !== cp.sha) {
    undone.commits = Number(out(dir, ['rev-list', '--count', `${cp.sha}..${now}`])) || 0;
    const r = g(dir, ['reset', '--quiet', '--mixed', cp.sha]);
    if (r.code !== 0) throw new Error(`could not move ${dir} back to ${cp.sha}: ${r.stderr}`);
  }
  const tracked = [...new Set([...changedSince(dir, cp.sha), ...changedSince(dir, cp.sha, true)])];
  const inBase = new Set(gitPaths(dir, ['ls-tree', '-r', '--name-only', cp.sha]));
  const restore = tracked.filter((f) => inBase.has(f));
  for (let i = 0; i < restore.length; i += 100) {
    const r = g(dir, ['restore', '--source', cp.sha, '--staged', '--worktree', '--', ...restore.slice(i, i + 100)]);
    if (r.code !== 0) throw new Error(`git restore failed in ${dir}: ${r.stderr}`);
  }
  undone.restored = restore;
  // Files added to the index that did not exist at the checkpoint: unstage, then delete below.
  const addedToIndex = tracked.filter((f) => !inBase.has(f));
  if (addedToIndex.length) g(dir, ['rm', '--cached', '--quiet', '--force', '--', ...addedToIndex]);
  const before = new Set(cp.untracked || []);
  for (const f of untracked(dir)) {
    if (before.has(f)) continue;
    fs.rmSync(path.join(dir, f), { force: true });
    undone.removed.push(f);
  }
  for (const f of addedToIndex) if (fs.existsSync(path.join(dir, f))) { fs.rmSync(path.join(dir, f), { force: true }); undone.removed.push(f); }
  pruneEmptyDirs(dir, undone.removed);
  return undone;
}

function pruneEmptyDirs(root, files) {
  const dirs = [...new Set(files.map((f) => path.dirname(f)).filter((d) => d && d !== '.'))].sort((a, b) => b.length - a.length);
  for (let d of dirs) {
    while (d && d !== '.') {
      const abs = path.join(root, d);
      try { if (fs.readdirSync(abs).length) break; fs.rmdirSync(abs); } catch { break; }
      d = path.dirname(d);
    }
  }
}

/** If the agent committed anyway, fold its commits back into the working tree (files kept). */
export function uncommit(dir, sha) {
  if (head(dir) === sha) return 0;
  const n = Number(out(dir, ['rev-list', '--count', `${sha}..HEAD`])) || 0;
  const r = g(dir, ['reset', '--quiet', '--mixed', sha]);
  if (r.code !== 0) throw new Error(`could not fold agent commits in ${dir}: ${r.stderr}`);
  return n;
}

/** Save the task's whole change (new files included) as a patch for morning review. */
export function savePatch(dir, sha, file) {
  const fresh = untracked(dir);
  if (fresh.length) g(dir, ['add', '--intent-to-add', '--', ...fresh]);
  const r = g(dir, ['diff', '--binary', sha, '--']);
  if (!r.stdout.trim()) return null;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${r.stdout}\n`);
  return file;
}

/** Commit the task's changes by path (never `add -A` of the whole tree). Returns the new sha. */
export function commitTask(dir, { files, message }) {
  // Start from an index equal to HEAD so only the listed files are committed, whatever the agent
  // staged itself (`git mv`, `git add`). This resets the index only; files on disk are untouched.
  const unstage = g(dir, ['reset', '--quiet']);
  if (unstage.code !== 0) throw new Error(`could not clear the index in ${dir}: ${unstage.stderr}`);
  const exists = files.filter((f) => fs.existsSync(path.join(dir, f)));
  const gone = files.filter((f) => !fs.existsSync(path.join(dir, f)));
  for (let i = 0; i < exists.length; i += 100) {
    const r = g(dir, ['add', '--', ...exists.slice(i, i + 100)]);
    if (r.code !== 0) throw new Error(`git add failed: ${r.stderr}`);
  }
  if (gone.length) g(dir, ['rm', '--cached', '--quiet', '--ignore-unmatch', '--', ...gone]);
  const ident = out(dir, ['config', 'user.email']) ? [] : ['-c', 'user.name=night-loop', '-c', 'user.email=night-loop@localhost'];
  const r = runSync(['git', ...ident, 'commit', '--quiet', '-F', '-'], { cwd: dir, allowFail: true, input: message, timeoutMs: 10 * 60_000 });
  if (r.code !== 0) {
    const err = new Error(`git commit failed (a commit hook may have rejected it): ${(r.stderr || r.stdout).slice(-600)}`);
    err.code = 'COMMIT';
    throw err;
  }
  return head(dir);
}

export function commitMessage(task, claim, runId) {
  const subject = `night(${task.loop || task.mode}): ${String(claim?.summary || task.title).split('\n')[0]}`.slice(0, 72);
  const body = [task.title !== subject ? task.title : '', claim?.hypothesis ? `Hypothesis: ${claim.hypothesis}` : ''].filter(Boolean).join('\n');
  return `${subject}\n\n${body ? `${body}\n\n` : ''}Night-Run: ${runId}\nNight-Task: ${task.id}\n`;
}

/** Bring a lane commit into the run worktree. A conflict aborts cleanly and reports it. */
export function integrate(runDir, sha) {
  const before = head(runDir);
  const r = g(runDir, ['cherry-pick', '--allow-empty', sha]);
  if (r.code === 0) return { ok: true, before, after: head(runDir) };
  g(runDir, ['cherry-pick', '--abort']);
  return { ok: false, conflict: /conflict/i.test(r.stdout + r.stderr), before, detail: (r.stderr || r.stdout).slice(-600) };
}

/** Drop the last integrated commit from the run branch (our own commit; refuses if files are dirty). */
export function dropLast(runDir, toSha) {
  const r = g(runDir, ['reset', '--quiet', '--keep', toSha]);
  if (r.code !== 0) throw new Error(`could not drop the integrated commit: ${r.stderr}`);
}

/** Remove lane worktrees this run created. The run worktree stays for review. */
export function removeLanes(root, laneDirs) {
  const removed = [];
  for (const dir of laneDirs) {
    if (!fs.existsSync(dir)) continue;
    if (dirtyFiles(dir).length) continue; // keep anything unexpected for a human to look at
    if (g(root, ['worktree', 'remove', dir]).code === 0) removed.push(dir);
  }
  g(root, ['worktree', 'prune']);
  return removed;
}

export function freeDiskMb(dir) {
  try {
    const s = fs.statfsSync(dir);
    return Math.floor((s.bavail * s.bsize) / 1024 / 1024);
  } catch {
    return null;
  }
}
