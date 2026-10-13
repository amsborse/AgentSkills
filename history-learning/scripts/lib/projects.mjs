import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HOME } from './util.mjs';

const cache = new Map();
const roots = new Set();
const norm = (p) => path.resolve(p).replace(/[\\/]+$/, '');
const TEMP = [os.tmpdir(), process.env.TEMP, process.env.TMP].filter(Boolean).map((p) => norm(p).toLowerCase());

/** Resolves a linked worktree's `.git` file back to the main checkout. */
function mainOfWorktree(dir) {
  try {
    const m = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(path.join(dir, '.git'), 'utf8'));
    if (!m) return dir;
    const gitdir = path.resolve(dir, m[1].trim());
    const i = gitdir.replace(/\\/g, '/').lastIndexOf('/.git/worktrees/');
    return i >= 0 ? gitdir.slice(0, i) : dir;
  } catch {
    return dir;
  }
}

function gitRoot(start) {
  for (let d = start; d && d !== path.dirname(d); d = path.dirname(d)) {
    if (norm(d) === norm(HOME)) return null;
    try {
      return fs.statSync(path.join(d, '.git')).isFile() ? mainOfWorktree(d) : d;
    } catch {}
  }
  return null;
}

const MARKERS = ['package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'requirements.txt', 'pom.xml', 'build.gradle'];

/** Without git, the outermost folder carrying a project manifest (monorepo root over packages). */
function markerRoot(start) {
  let top = null;
  for (let d = start; d && d !== path.dirname(d); d = path.dirname(d)) {
    if (norm(d).toLowerCase() === norm(HOME).toLowerCase()) break;
    if (MARKERS.some((m) => fs.existsSync(path.join(d, m)))) top = d;
  }
  return top;
}

/** Worktree layouts used on this machine: `<repo>/.<tool>/worktrees/<x>` and `<repo>-worktrees/<x>`. */
function worktreeParent(p) {
  const m = /^(.*?)[\\/]\.[\w-]+[\\/]worktrees(?:[\\/]|$)/i.exec(p) || /^(.*?)-worktrees(?:[\\/]|$)/i.exec(p);
  return m ? m[1] : null;
}

/** `Sutra-artha-gateway` next to a `Sutra` checkout is a task clone of Sutra. */
function siblingBase(root) {
  const base = path.basename(root);
  let best = null;
  try {
    for (const e of fs.readdirSync(path.dirname(root), { withFileTypes: true })) {
      if (!e.isDirectory() || e.name === base || !base.toLowerCase().startsWith(`${e.name.toLowerCase()}-`)) continue;
      if (fs.existsSync(path.join(path.dirname(root), e.name, '.git')) && (!best || e.name.length > best.length)) best = e.name;
    }
  } catch {}
  return best ? path.join(path.dirname(root), best) : root;
}

/**
 * Maps a working directory or file path to `{ name, root }`, collapsing subdirectories,
 * linked worktrees and task clones onto their repository so one project is counted once.
 * Paths that no longer exist resolve to the first missing folder below the nearest survivor.
 */
export function projectOf(input) {
  if (!input) return { name: '(unknown)', root: null };
  let key;
  try {
    key = norm(decodeURIComponent(String(input).replace(/^file:\/\/\/?/, '').replace(/^\/([a-z]:)/i, '$1')));
  } catch {
    key = norm(String(input));
  }
  if (cache.has(key)) return cache.get(key);
  const lower = key.toLowerCase();
  const inTemp = TEMP.some((t) => lower === t || lower.startsWith(`${t}${path.sep}`)) || /[\\/](tmp|temp)[\\/]/i.test(key);
  const start = worktreeParent(key) || key;
  let existing = start;
  let missing = null;
  while (!fs.existsSync(existing)) {
    const up = path.dirname(existing);
    if (up === existing) break;
    missing = path.basename(existing);
    existing = up;
  }
  if (fs.existsSync(existing) && fs.statSync(existing).isFile()) existing = path.dirname(existing);
  const git = gitRoot(existing);
  let res;
  if (!git && inTemp) res = { name: '(temp)', root: null };
  else {
    const root = norm(siblingBase(norm(git || markerRoot(existing) || (missing ? path.join(existing, missing) : existing))));
    res = root.toLowerCase() === norm(HOME).toLowerCase() || /^[a-z]:\\?$/i.test(root) ? { name: '(home)', root } : { name: path.basename(root), root };
  }
  if (res.root) roots.add(res.root);
  cache.set(key, res);
  return res;
}

const slugify = (p) => p.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

/**
 * Cursor's project folders are lossy slugs of the workspace path. Match them against
 * repository roots seen elsewhere and their sibling folders; fall back to the slug tail.
 */
export function projectFromSlug(slug) {
  const s = slug.toLowerCase();
  const candidates = new Set(roots);
  for (const r of roots) {
    try {
      for (const e of fs.readdirSync(path.dirname(r), { withFileTypes: true })) if (e.isDirectory()) candidates.add(path.join(path.dirname(r), e.name));
    } catch {}
  }
  let best = null;
  for (const c of candidates) {
    const cs = slugify(c);
    if ((s === cs || s.startsWith(`${cs}-`)) && (!best || cs.length > slugify(best).length)) best = c;
  }
  if (best) return projectOf(best);
  if (/^\d+$/.test(slug)) return { name: '(no workspace)', root: null };
  return { name: slug.replace(/^.*?Projects-Projects-/i, '').replace(/^[a-z]-/i, ''), root: null };
}

/** Most common project among many candidate paths (tool-call arguments, file URIs). */
export function dominantProject(paths) {
  const counts = new Map();
  for (const p of paths) {
    if (!/^[A-Za-z]:[\\/][^\\/]+[\\/]/.test(p) || !fs.existsSync(p.slice(0, 3))) continue;
    const r = projectOf(p);
    if (r.name.startsWith('(')) continue;
    counts.set(r.name, (counts.get(r.name) || 0) + 1);
  }
  const best = [...counts].sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : '(unknown)';
}
