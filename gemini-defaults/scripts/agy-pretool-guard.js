'use strict';

// Antigravity PreToolUse guardrail for run_command:
// 1. PowerShell 5.1 chain-operator guard (ported from ~/.claude/hooks/ps-guard.js)
// 2. Batch email send guard (ported from ~/.claude/hooks/guard-batch-email.js)
// 3. Catastrophic git/filesystem guard (AGENTS.md + 2026 deterministic safety standard)

const fs = require('fs');

function findChainOperator(cmd) {
  const n = cmd.length;
  let i = 0;
  const atLineStart = (k) => k === 0 || cmd[k - 1] === '\n' || cmd[k - 1] === '\r';
  while (i < n) {
    const ch = cmd[i];
    const two = cmd.slice(i, i + 2);
    if (ch === '`') { i += 2; continue; }
    if (two === "@'" || two === '@"') {
      const close = two[1] + '@';
      let k = cmd.indexOf('\n', i);
      if (k < 0) return -1;
      for (;;) {
        const line = cmd.indexOf(close, k + 1);
        if (line < 0) return -1;
        if (atLineStart(line)) { i = line + 2; break; }
        k = line;
      }
      continue;
    }
    if (ch === "'") {
      i++;
      while (i < n) {
        if (cmd[i] === "'" && cmd[i + 1] === "'") { i += 2; continue; }
        if (cmd[i] === "'") break;
        i++;
      }
      i++;
      continue;
    }
    if (ch === '"') {
      i++;
      while (i < n) {
        if (cmd[i] === '`') { i += 2; continue; }
        if (cmd[i] === '"' && cmd[i + 1] === '"') { i += 2; continue; }
        if (cmd[i] === '"') break;
        i++;
      }
      i++;
      continue;
    }
    if (two === '<#') { const e = cmd.indexOf('#>', i + 2); if (e < 0) return -1; i = e + 2; continue; }
    if (ch === '#' && (i === 0 || /\s|;|\(|\{/.test(cmd[i - 1]))) {
      const e = cmd.indexOf('\n', i); if (e < 0) return -1; i = e; continue;
    }
    if (cmd.startsWith('--%', i)) { const e = cmd.indexOf('\n', i); if (e < 0) return -1; i = e; continue; }
    if (two === '&&' || two === '||') return i;
    i++;
  }
  return -1;
}

function deny(reason) {
  process.stdout.write(JSON.stringify({ decision: 'deny', reason }));
}

function allow() {
  process.stdout.write(JSON.stringify({ decision: 'allow' }));
}

function checkCommand(cmd) {
  if (!cmd || typeof cmd !== 'string') return null;

  // 1. Windows PowerShell 5.1 chain operator guard
  const at = findChainOperator(cmd);
  if (at >= 0) {
    const op = cmd.slice(at, at + 2);
    const fix = op === '&&' ? '`A; if ($?) { B }`' : '`A; if (-not $?) { B }`';
    return `Windows PowerShell 5.1 has no \`${op}\` operator; rewrite as ${fix} or use \`;\`.`;
  }

  // 2. Batch email send guard (Sutra / Manthan)
  const worker = /@sutra\/worker|apps[\\/]worker|deliver-cli|rerun-cli/i.test(cmd);
  const deliver = worker && /\bdeliver(-cli)?\b/i.test(cmd) && !/--no-email\b/i.test(cmd);
  const rerun = worker && /\brerun(-cli)?\b/i.test(cmd);
  const resend = /--resend\b/i.test(cmd);
  if (deliver || rerun || resend) {
    const why = [deliver && 'deliver without --no-email', rerun && 'rerun', resend && '--resend']
      .filter(Boolean).join(', ');
    return `Batch email guard: blocked command that can send Manthan emails (${why}). Ask the owner to run it directly.`;
  }

  // 3. Destructive git / filesystem guardrails
  if (/\bgit\s+reset\s+--hard\b/i.test(cmd)) {
    return 'Safety guard: `git reset --hard` is blocked (never destroy uncommitted work).';
  }
  if (/\bgit\s+clean\s+-[a-z]*f[a-z]*d|git\s+clean\s+-[a-z]*d[a-z]*f/i.test(cmd)) {
    return 'Safety guard: `git clean -fd` is blocked (never bulk-delete untracked files).';
  }
  if (/\bgit\s+push\b[^\r\n]*(--force\b|-f\b)[^\r\n]*\b(main|master)\b/i.test(cmd) ||
      /\bgit\s+push\b[^\r\n]*\b(main|master)\b[^\r\n]*(--force\b|-f\b)/i.test(cmd)) {
    return 'Safety guard: force-pushing to main/master is blocked.';
  }
  if (/\brm\s+-[a-z]*r[a-z]*f\s+(\/|~|\$HOME|\*)\b/i.test(cmd) ||
      /\bRemove-Item\b[^\r\n]*-Recurse[^\r\n]*([A-Za-z]:\\["'\s]*$|~|\$HOME|\$env:USERPROFILE)["'\s]*$/i.test(cmd)) {
    return 'Safety guard: recursive delete on root/home directory is blocked.';
  }

  return null;
}

module.exports = { findChainOperator, checkCommand };

if (require.main === module) {
  let raw = '';
  try { raw = fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, ''); } catch {}
  let cmd = '';
  try {
    const payload = JSON.parse(raw || '{}');
    const args = payload.toolCall && payload.toolCall.args ? payload.toolCall.args : {};
    cmd = String(args.CommandLine ?? args.command ?? '');
  } catch {
    // Fail closed if unparseable input mentions email resend/deliver
    cmd = raw;
  }

  const reason = checkCommand(cmd);
  if (reason) deny(reason);
  else allow();
}
