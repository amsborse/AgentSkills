import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function skillDirs(root = REPO_ROOT) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && fs.existsSync(path.join(root, d.name, 'SKILL.md')))
    .map((d) => d.name);
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
  if (isDir(codexHome) || onPath('codex')) agents.push({ id: 'codex', name: 'Codex', present: true, targets: [path.join(codexHome, 'skills')] });

  const claudeDefault = path.join(home, '.claude', 'skills');
  const claudeTargets = agents.find((a) => a.id === 'claude-code')?.targets || [];
  const opencodeConfig = env.XDG_CONFIG_HOME ? path.join(env.XDG_CONFIG_HOME, 'opencode') : path.join(home, '.config', 'opencode');
  if (isDir(opencodeConfig) || onPath('opencode')) {
    const readsClaude = !env.OPENCODE_DISABLE_CLAUDE_CODE && !env.OPENCODE_DISABLE_CLAUDE_CODE_SKILLS;
    if (readsClaude && claudeTargets.includes(claudeDefault)) agents.push({ id: 'opencode', name: 'OpenCode', present: true, targets: [], coveredBy: claudeDefault });
    else agents.push({ id: 'opencode', name: 'OpenCode', present: true, targets: [path.join(opencodeConfig, 'skills')] });
  }

  if (isDir(path.join(home, '.cursor'))) {
    const covered = claudeTargets.includes(claudeDefault) ? claudeDefault : agents.some((a) => a.id === 'codex') ? path.join(codexHome, 'skills') : null;
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
