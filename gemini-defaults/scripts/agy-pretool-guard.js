'use strict';

// Antigravity PreToolUse guardrail for run_command:
// 1. PowerShell 5.1 chain-operator guard (ported from ~/.claude/hooks/ps-guard.js)
// 2. Batch email send guard (ported from ~/.claude/hooks/guard-batch-email.js)
// 3. Secrets read/print guard (.env, SSH private keys, credential JSONs)
// 4. Production deploy guard (scripts/deploy.sh, wrangler deploy prod, vercel --prod)
// 5. Catastrophic git/filesystem guard (git reset --hard, git clean -fd, force-push main, rm -rf /)

const fs = require('fs');
const { recordEvent } = require('./telemetry.js');

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

function checkCommandDetailed(cmd) {
  if (!cmd || typeof cmd !== 'string') return null;

  // 1. Windows PowerShell 5.1 chain operator guard
  const at = findChainOperator(cmd);
  if (at >= 0) {
    const op = cmd.slice(at, at + 2);
    const fix = op === '&&' ? '`A; if ($?) { B }`' : '`A; if (-not $?) { B }`';
    return {
      rule: 'ps5-chain-operator',
      reason: `Windows PowerShell 5.1 has no \`${op}\` operator; rewrite as ${fix} or use \`;\`.`,
    };
  }

  // 2. Batch email send guard (Sutra / Manthan)
  const worker = /@sutra\/worker|apps[\\/]worker|deliver-cli|rerun-cli/i.test(cmd);
  const deliver = worker && /\bdeliver(-cli)?\b/i.test(cmd) && !/--no-email\b/i.test(cmd);
  const rerun = worker && /\brerun(-cli)?\b/i.test(cmd);
  const resend = /--resend\b/i.test(cmd);
  if (deliver || rerun || resend) {
    const why = [deliver && 'deliver without --no-email', rerun && 'rerun', resend && '--resend']
      .filter(Boolean).join(', ');
    return {
      rule: 'batch-email-guard',
      reason: `Batch email guard: blocked command that can send Manthan emails (${why}). Ask the owner to run it directly.`,
    };
  }

  // 3. Secrets & credential file read guard
  const readCmd = /\b(cat|type|gc|get-content|head|tail|more|less|sed|awk|bat)\b/i;
  if (readCmd.test(cmd)) {
    const readsEnv = /(?:^|[\s"'\\/])\.env(?:\.(?!example|sample|template)[A-Za-z0-9_-]+)?(?:[\s"'`]|$)/i.test(cmd);
    const readsCred = /(?:^|[\s"'\\/])(id_rsa|id_ed25519|id_ecdsa|oauth_creds\.json|\.credentials\.json|sutra-oracle\.key|credentials\.json)(?:[\s"'`]|$)|\.aws[\\/]credentials\b/i.test(cmd);
    if (readsEnv) {
      return {
        rule: 'secrets-env-read',
        reason: 'Secrets guard: reading `.env` files via shell is blocked to protect credentials (use `.env.example` or check key names only).',
      };
    }
    if (readsCred) {
      return {
        rule: 'secrets-cred-read',
        reason: 'Secrets guard: reading SSH private keys or credential files via shell is blocked.',
      };
    }
  }

  // 4. Production deploy guard
  if (/(?:^|[\s"'\\/])scripts[\\/]deploy\.sh\b/i.test(cmd)) {
    return {
      rule: 'prod-deploy-guard',
      reason: 'Prod deploy guard: `scripts/deploy.sh` targets production and requires explicit owner execution.',
    };
  }
  if (/\bwrangler\s+(deploy|publish)\b/i.test(cmd) && !/--env\s+test\b|sutra-reports-test\b|--dry-run\b/i.test(cmd)) {
    return {
      rule: 'prod-deploy-guard',
      reason: 'Prod deploy guard: `wrangler deploy` without `--env test` / `--dry-run` is blocked.',
    };
  }
  if (/\bvercel\b[^\r\n]*--prod\b/i.test(cmd)) {
    return {
      rule: 'prod-deploy-guard',
      reason: 'Prod deploy guard: `vercel --prod` requires explicit owner execution.',
    };
  }

  // 5. Destructive git / filesystem guardrails
  if (/\bgit\s+reset\s+--hard\b/i.test(cmd)) {
    return {
      rule: 'destructive-git-reset',
      reason: 'Safety guard: `git reset --hard` is blocked (never destroy uncommitted work).',
    };
  }
  if (/\bgit\s+clean\s+-[a-z]*f[a-z]*d|git\s+clean\s+-[a-z]*d[a-z]*f/i.test(cmd)) {
    return {
      rule: 'destructive-git-clean',
      reason: 'Safety guard: `git clean -fd` is blocked (never bulk-delete untracked files).',
    };
  }
  if (/\bgit\s+push\b[^\r\n]*(--force\b|-f\b)[^\r\n]*\b(main|master)\b/i.test(cmd) ||
      /\bgit\s+push\b[^\r\n]*\b(main|master)\b[^\r\n]*(--force\b|-f\b)/i.test(cmd)) {
    return {
      rule: 'destructive-force-push',
      reason: 'Safety guard: force-pushing to main/master is blocked.',
    };
  }
  if (/\brm\s+-[a-z]*r[a-z]*f\s+(\/|~|\$HOME|\*)\b/i.test(cmd) ||
      /\bRemove-Item\b[^\r\n]*-Recurse[^\r\n]*([A-Za-z]:\\["'\s]*$|~|\$HOME|\$env:USERPROFILE)["'\s]*$/i.test(cmd)) {
    return {
      rule: 'destructive-rm-root',
      reason: 'Safety guard: recursive delete on root/home directory is blocked.',
    };
  }

  return null;
}

function checkCommand(cmd) {
  const hit = checkCommandDetailed(cmd);
  return hit ? hit.reason : null;
}

module.exports = { findChainOperator, checkCommand, checkCommandDetailed };

if (require.main === module) {
  const t0 = Date.now();
  let raw = '';
  try { raw = fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, ''); } catch {}
  let cmd = '';
  let cwd = '';
  try {
    const payload = JSON.parse(raw || '{}');
    cwd = payload.cwd || (payload.workspacePaths && payload.workspacePaths[0]) || '';
    const args = payload.toolCall && payload.toolCall.args ? payload.toolCall.args : {};
    cmd = String(args.CommandLine ?? args.command ?? '');
  } catch {
    cmd = raw;
  }

  const hit = checkCommandDetailed(cmd);
  if (hit) {
    recordEvent({
      feature: hit.rule,
      event: 'PreToolUse',
      outcome: 'blocked',
      detail: hit.rule,
      repo: cwd,
      ms: Date.now() - t0,
    });
    process.stdout.write(JSON.stringify({ decision: 'deny', reason: hit.reason }));
  } else {
    recordEvent({
      feature: 'pretool-guard',
      event: 'PreToolUse',
      outcome: 'allowed',
      repo: cwd,
      ms: Date.now() - t0,
    });
    process.stdout.write(JSON.stringify({ decision: 'allow' }));
  }
}
