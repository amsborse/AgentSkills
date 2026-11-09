import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Skills that stay at the repository root because scripts outside this repository
// (night loops) call them by path; they are installed under the same names.
export const ROOT_SKILLS = ['nightly-evolution', 'history-learning'];

export function skillDirs(root = REPO_ROOT) {
  const skills = path.join(root, 'skills');
  const nested = isDir(skills)
    ? fs.readdirSync(skills, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(skills, d.name, 'SKILL.md')))
      .map((d) => path.posix.join('skills', d.name))
    : [];
  const top = ROOT_SKILLS.filter((name) => fs.existsSync(path.join(root, name, 'SKILL.md')));
  return [...nested, ...top].sort((a, b) => path.posix.basename(a).localeCompare(path.posix.basename(b)));
}

function onPath(cmd) {
  const probe = process.platform === 'win32' ? spawnSync('where', [cmd], { encoding: 'utf8' }) : spawnSync('sh', ['-c', `command -v ${cmd}`], { encoding: 'utf8' });
  return probe.status === 0;
}

const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

/**
 * Agents installed on this machine and the user-level skill directories each one reads.
 * `targets` are where links get created; `coveredBy` means another agent's directory is
 * already read by this one, so a second copy would only create a duplicate skill name.
 */
export function detectAgents(home = os.homedir(), env = process.env) {
  const agents = [];

  const claudeProfiles = new Set();
  if (env.CLAUDE_CONFIG_DIR) claudeProfiles.add(path.resolve(env.CLAUDE_CONFIG_DIR));
  if (isDir(path.join(home, '.claude'))) claudeProfiles.add(path.join(home, '.claude'));
  for (const d of fs.existsSync(home) ? fs.readdirSync(home) : []) {
    if (!/^\.claude-[\w-]+$/.test(d)) continue;
    const p = path.join(home, d);
    // Account profiles (CLAUDE_CONFIG_DIR targets) carry their own settings; skip unrelated dirs.
    if (isDir(p) && (fs.existsSync(path.join(p, 'settings.json')) || fs.existsSync(path.join(p, '.claude.json')))) claudeProfiles.add(p);
  }
  if (claudeProfiles.size || onPath('claude')) {
    const targets = [];
    const skipped = [];
    for (const p of claudeProfiles) {
      const isDefault = path.resolve(p) === path.join(home, '.claude');
      // Non-default profiles only get the skill when they already opted into user skills.
      if (isDefault || isDir(path.join(p, 'skills')) || path.resolve(p) === path.resolve(env.CLAUDE_CONFIG_DIR || '')) targets.push(path.join(p, 'skills'));
      else skipped.push(`${p} (profile has no skills/ directory)`);
    }
    if (!targets.length) targets.push(path.join(home, '.claude', 'skills'));
    agents.push({ id: 'claude-code', name: 'Claude Code', present: true, targets, skipped });
  }

  const codexHome = env.CODEX_HOME ? path.resolve(env.CODEX_HOME) : path.join(home, '.codex');
  const sharedAgents = path.join(home, '.agents', 'skills');
  if (isDir(codexHome) || fs.existsSync(sharedAgents) || onPath('codex')) agents.push({ id: 'agents', name: 'Agents (Codex, Cursor, Gemini)', present: true, targets: [sharedAgents], migrated: [path.join(codexHome, 'skills')] });

  const claudeDefault = path.join(home, '.claude', 'skills');
  const claudeTargets = agents.find((a) => a.id === 'claude-code')?.targets || [];
  const opencodeConfig = env.XDG_CONFIG_HOME ? path.join(env.XDG_CONFIG_HOME, 'opencode') : path.join(home, '.config', 'opencode');
  if (isDir(opencodeConfig) || onPath('opencode')) {
    const readsClaude = !env.OPENCODE_DISABLE_CLAUDE_CODE && !env.OPENCODE_DISABLE_CLAUDE_CODE_SKILLS;
    if (readsClaude && claudeTargets.includes(claudeDefault)) agents.push({ id: 'opencode', name: 'OpenCode', present: true, targets: [], coveredBy: claudeDefault });
    else agents.push({ id: 'opencode', name: 'OpenCode', present: true, targets: [path.join(opencodeConfig, 'skills')] });
  }

  if (isDir(path.join(home, '.cursor'))) {
    const covered = claudeTargets.includes(claudeDefault) ? claudeDefault : agents.some((a) => a.id === 'agents') ? sharedAgents : null;
    agents.push(covered ? { id: 'cursor', name: 'Cursor', present: true, targets: [], coveredBy: covered } : { id: 'cursor', name: 'Cursor', present: true, targets: [path.join(home, '.cursor', 'skills')] });
  }
  return agents;
}

export function linkState(link, source) {
  let st;
  try {
    st = fs.lstatSync(link);
  } catch {
    return 'missing';
  }
  const real = (p) => {
    try {
      return fs.realpathSync.native(p).toLowerCase();
    } catch {
      return null;
    }
  };
  if (st.isSymbolicLink() || (process.platform === 'win32' && st.isDirectory() && real(link) !== path.resolve(link).toLowerCase())) {
    return real(link) === real(source) ? 'ok' : 'foreign-link';
  }
  return 'occupied';
}

export function createLink(link, source) {
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(source, link, process.platform === 'win32' ? 'junction' : 'dir');
}

export function removeLink(link) {
  try {
    fs.unlinkSync(link);
  } catch {
    fs.rmdirSync(link);
  }
}

const comparable = (p) => {
  const resolved = path.resolve(p);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
};

export function repoLinkTarget(link, root = REPO_ROOT) {
  let st;
  try { st = fs.lstatSync(link); } catch { return false; }
  if (!(st.isSymbolicLink() || (process.platform === 'win32' && st.isDirectory() && (() => {
    try { return comparable(fs.realpathSync.native(link)) !== comparable(link); } catch { return true; }
  })()))) return false;
  let target;
  try { target = fs.realpathSync.native(link); } catch {
    // Dangling links still expose their intended target through readlink.
    try { target = path.resolve(path.dirname(link), fs.readlinkSync(link)); } catch { return false; }
  }
  const base = comparable(root);
  const dest = comparable(target);
  return dest === base || dest.startsWith(`${base}${path.sep}`);
}

// A link the installer owns: it points into this checkout and at a skill folder (one with a
// SKILL.md), or it dangles there (a skill that was renamed or removed). A user's own link to
// some other folder of the checkout (docs/, a script dir) is not ours and is never pruned.
export function ownedRepoLink(link, root = REPO_ROOT) {
  if (!repoLinkTarget(link, root)) return false;
  let target;
  try { target = fs.realpathSync.native(link); } catch { return true; }
  return fs.existsSync(path.join(target, 'SKILL.md'));
}
