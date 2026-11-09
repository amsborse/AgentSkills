#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { route } from '../route.mjs';

try {
  if (process.env.AGENT_SKILLS_ROUTER === 'off') process.exit(0);
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const { prompt } = JSON.parse(input);
  if (typeof prompt !== 'string' || prompt.startsWith('/') || prompt.trim().split(/\s+/).filter(Boolean).length < 3) process.exit(0);
  const registryPath = process.env.AGENT_SKILLS_REGISTRY || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../registry/skills.json');
  const result = route(prompt, JSON.parse(fs.readFileSync(registryPath, 'utf8')));
  if (!result.matches.length) process.exit(0);
  const names = result.matches.slice(0, 2).map((m) => m.name);
  let additionalContext = `Skill router (keyword hint, may be wrong): ${names.join(', ')}${result.ambiguous ? ' (ambiguous)' : ''}. Load a skill with the Skill tool only if it fits the request.`;
  additionalContext = additionalContext.slice(0, 299);
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext } })}\n`);
} catch (error) {
  // Fail open (the prompt continues, exit 0), but not silently: stderr shows in the
  // Claude Code debug log / transcript so a broken registry is noticed.
  process.stderr.write(`agent-skills route-hook: ${error?.message || error}\n`);
  process.exitCode = 0;
}
