import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { nowIso, pidAlive, readJson, runSync, toPosix, writeJson } from './util.mjs';

export function git(cwd, args, opts = {}) {
  return runSync(['git', ...args], { cwd, ...opts });
}

export function gitOut(cwd, args) {
  return git(cwd, args).stdout.trim();
}

/** Resolve the main checkout (even from inside a linked worktree) and the .evolution layout. */
export function resolveRepo(start = process.cwd()) {
  const top = git(start, ['rev-parse', '--show-toplevel'], { allowFail: true });
  if (top.code !== 0) throw new Error(`${start} is not inside a Git repository`);
  const commonDir = path.resolve(start, gitOut(start, ['rev-parse', '--path-format=absolute', '--git-common-dir']));
  if (path.basename(commonDir) !== '.git') throw new Error(`Unsupported repository layout (common dir ${commonDir})`);
  const main = path.dirname(commonDir);
  const evoDir = path.join(main, '.evolution');
  return {
    main,
    top: path.resolve(top.stdout.trim()),
    commonDir,
    evoDir,
    policyFile: path.join(evoDir, 'policy.yaml'),
    baselinesFile: path.join(evoDir, 'baselines.json'),
    historyFile: path.join(evoDir, 'history.jsonl'),
    // Volatile state lives in the git dir: repo formatters and linters never walk it.
    stateDir: path.join(commonDir, 'evolution'),
  };
}

export function defaultBranch(cwd, remote = 'origin') {
  const head = git(cwd, ['symbolic-ref', '--quiet', `refs/remotes/${remote}/HEAD`], { allowFail: true });
  if (head.code === 0) return head.stdout.trim().replace(`refs/remotes/${remote}/`, '');
  for (const b of ['main', 'master', 'trunk']) {
    if (git(cwd, ['rev-parse', '--verify', '--quiet', `refs/heads/${b}`], { allowFail: true }).code === 0) return b;
  }
  return gitOut(cwd, ['branch', '--show-current']) || 'main';
}

export function headSha(cwd) {
  return gitOut(cwd, ['rev-parse', 'HEAD']);
}

export function isClean(cwd) {
  return gitOut(cwd, ['status', '--porcelain', '--untracked-files=normal']) === '';
}

export function changedFiles(cwd, fromSha, toRef = 'HEAD') {
  const out = gitOut(cwd, ['diff', '--name-only', `${fromSha}..${toRef}`]);
  return out ? out.split('\n').map((s) => s.trim()).filter(Boolean) : [];
}

export function commitsSince(cwd, fromSha) {
  const out = gitOut(cwd, ['log', '--format=%H%x09%s', `${fromSha}..HEAD`]);
  return out
    ? out.split('\n').map((l) => {
        const [sha, ...subject] = l.split('\t');
        return { sha, subject: subject.join('\t') };
      })
    : [];
}

export function listWorktrees(cwd) {
  const out = gitOut(cwd, ['worktree', 'list', '--porcelain']);
  const items = [];
  let cur = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) {
      cur = { path: path.resolve(line.slice(9)) };
      items.push(cur);
    } else if (cur && line.startsWith('branch ')) cur.branch = line.slice(7).replace('refs/heads/', '');
    else if (cur && line.startsWith('HEAD ')) cur.head = line.slice(5);
    else if (cur && line === 'prunable') cur.prunable = true;
  }
  return items;
}

/** Add `entries` to .git/info/exclude so local evolution state never dirties `git status`. */
export function ensureExcluded(repo, entries) {
  const file = path.join(repo.commonDir, 'info', 'exclude');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const have = new Set(current.split(/\r?\n/).map((l) => l.trim()));
  const missing = entries.filter((e) => !have.has(e));
  if (!missing.length) return [];
  const prefix = current && !current.endsWith('\n') ? '\n' : '';
  fs.appendFileSync(file, `${prefix}# nightly-evolution local state\n${missing.join('\n')}\n`);
  return missing;
}

export function isTracked(cwd, file) {
  return git(cwd, ['ls-files', '--error-unmatch', toPosix(file)], { allowFail: true }).code === 0;
}

// ---- night state -----------------------------------------------------------------------

export function stateFile(repo, nightId) {
  return path.join(repo.stateDir, `night-${nightId}.json`);
}

export function loadNight(repo, nightId) {
  return readJson(stateFile(repo, nightId), null);
}

export function saveNight(repo, state) {
  state.updatedAt = nowIso();
  writeJson(stateFile(repo, state.night), state);
}

/** The most recent unfinished (non-dry-run) night, if any. */
export function activeNight(repo, { includeDryRun = false } = {}) {
  if (!fs.existsSync(repo.stateDir)) return null;
  const files = fs
    .readdirSync(repo.stateDir)
    .filter((f) => /^night-.+\.json$/.test(f))
    .sort()
    .reverse();
  for (const f of files) {
    const s = readJson(path.join(repo.stateDir, f), null);
    if (!s || s.phase === 'done' || s.phase === 'abandoned') continue;
    if (s.dryRun && !includeDryRun) continue;
    return s;
  }
  return null;
}

export function listNights(repo) {
  if (!fs.existsSync(repo.stateDir)) return [];
  return fs
    .readdirSync(repo.stateDir)
    .filter((f) => /^night-.+\.json$/.test(f))
    .sort()
    .map((f) => readJson(path.join(repo.stateDir, f), null))
    .filter(Boolean);
}

// ---- process lock ----------------------------------------------------------------------

const LOCK_STALE_MS = 3 * 60 * 60_000;

/**
 * Exclusive lock for one engine invocation. A lock is stale when its process is gone on this
 * host or it is older than three hours; a live owner is never stolen.
 */
export function acquireLock(repo, label) {
  const file = path.join(repo.stateDir, 'engine.lock');
  fs.mkdirSync(repo.stateDir, { recursive: true });
  const mine = { pid: process.pid, host: os.hostname(), label, at: nowIso() };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(file, JSON.stringify(mine), { flag: 'wx' });
      return { file, release: () => fs.rmSync(file, { force: true }) };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const held = readJson(file, null);
      const age = held ? Date.now() - Date.parse(held.at) : Infinity;
      const stale = !held || age > LOCK_STALE_MS || (held.host === os.hostname() && !pidAlive(held.pid));
      if (!stale) {
        const err = new Error(`Another nightly-evolution command holds the lock (${held.label}, pid ${held.pid}, since ${held.at})`);
        err.code = 'LOCKED';
        throw err;
      }
      fs.rmSync(file, { force: true });
    }
  }
  throw new Error('Could not acquire engine lock');
}
