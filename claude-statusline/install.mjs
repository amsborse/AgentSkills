#!/usr/bin/env node
// Copies the status line into the Claude Code config folder (CLAUDE_CONFIG_DIR or ~/.claude).
// A different existing file is kept as <name>.bak first. Prints the settings.json entries to add;
// it never edits settings.json itself.
//   node claude-statusline/install.mjs [--dry-run]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const dry = process.argv.includes('--dry-run');
const files = ['statusline.js', 'scripts/eta.js', 'scripts/statusline-procs.ps1', 'scripts/statusline.test.js', 'scripts/claude-task-log.js', 'scripts/claude-task-log.test.js'];

for (const rel of files) {
  const src = path.join(here, rel);
  const dst = path.join(target, rel);
  const next = fs.readFileSync(src);
  if (fs.existsSync(dst)) {
    if (Buffer.compare(fs.readFileSync(dst), next) === 0) { console.log(`ok        ${dst}`); continue; }
    if (!dry) fs.copyFileSync(dst, `${dst}.bak`);
  }
  if (!dry) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, next);
  }
  console.log(`${dry ? 'would-copy' : 'copied   '} ${dst}`);
}

const node = (p) => `node "${path.join(target, p).replace(/\\/g, '/')}"`;
console.log(`
Add to ${path.join(target, 'settings.json')} if missing:
  "statusLine": { "type": "command", "command": ${JSON.stringify(node('statusline.js'))}, "padding": 0, "refreshInterval": 5 }
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": ${JSON.stringify(node('scripts/eta.js') + ' hook-prompt')}, "timeout": 5 }] }],
    "Stop":             [{ "hooks": [{ "type": "command", "command": ${JSON.stringify(node('scripts/eta.js') + ' hook-stop')}, "timeout": 5 },
                                   { "type": "command", "command": ${JSON.stringify(node('scripts/claude-task-log.js') + ' hook-stop')}, "timeout": 5 }] }]
  }`);
