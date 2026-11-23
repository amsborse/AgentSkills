'use strict';

// Antigravity PostToolUse auto-formatter (edit_file|write_file):
// - Runs nearest project node_modules/.bin/prettier on JS/TS/JSON/CSS/HTML/MD/YAML/etc.
// - Runs local ruff format on .py files if ruff is available on PATH.
// Silent and best-effort; logs real format counts to telemetry and always outputs `{}`.

const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { recordEvent } = require('./telemetry.js');

const PRETTIER_EXTS = new Set([
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts',
  '.json', '.css', '.scss', '.less', '.html', '.vue', '.svelte',
  '.md', '.mdx', '.yaml', '.yml', '.graphql',
]);

function main() {
  const t0 = Date.now();
  try {
    const raw = fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, '').trim();
    const payload = raw ? JSON.parse(raw) : {};
    const cwd = payload.cwd || (payload.workspacePaths && payload.workspacePaths[0]) || '';
    const args = payload.toolCall && payload.toolCall.args ? payload.toolCall.args : {};
    const file = args.Path || args.path || args.file_path;
    if (!file || typeof file !== 'string' || !fs.existsSync(file)) {
      process.stdout.write('{}');
      return;
    }

    const ext = path.extname(file).toLowerCase();
    if (PRETTIER_EXTS.has(ext)) {
      for (let dir = path.dirname(file); ; dir = path.dirname(dir)) {
        const bin = path.join(dir, 'node_modules', '.bin', process.platform === 'win32' ? 'prettier.cmd' : 'prettier');
        if (fs.existsSync(bin)) {
          execSync(`"${bin}" --write --log-level silent --ignore-unknown "${file}"`, {
            cwd: dir,
            stdio: 'ignore',
            timeout: 15000,
          });
          recordEvent({
            feature: 'auto-format',
            event: 'PostToolUse',
            outcome: 'formatted',
            detail: `prettier:${ext}`,
            repo: cwd || path.dirname(file),
            ms: Date.now() - t0,
          });
          break;
        }
        if (path.dirname(dir) === dir) break;
      }
    } else if (ext === '.py') {
      try {
        execFileSync('ruff', ['format', '--quiet', file], { stdio: 'ignore', timeout: 10000 });
        recordEvent({
          feature: 'auto-format',
          event: 'PostToolUse',
          outcome: 'formatted',
          detail: 'ruff:.py',
          repo: cwd || path.dirname(file),
          ms: Date.now() - t0,
        });
      } catch {}
    }
  } catch {}

  process.stdout.write('{}');
}

main();
