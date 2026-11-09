#!/usr/bin/env node
// Stand-in for the Antigravity `agy` CLI in codex-bridge tests. FAKE_AGY_MODE picks the scenario;
// FAKE_AGY_LOG receives the argv and the API-key variables the child could see.
import fs from 'node:fs';

const mode = process.env.FAKE_AGY_MODE || 'ok';
if (process.env.FAKE_AGY_LOG) {
  const keys = Object.keys(process.env).filter(k => /_API_KEY$|^GOOGLE_APPLICATION_CREDENTIALS$/i.test(k));
  fs.writeFileSync(process.env.FAKE_AGY_LOG, JSON.stringify({ argv: process.argv.slice(2), keys, depth: process.env.CODEX_BRIDGE_ACTIVE || null }));
}
const out = ev => process.stdout.write(JSON.stringify(ev) + '\n');
const id = 'conv-123';
const step = (i, extra) => out({ event: 'step_update', step_update: { conversation_id: id, step_index: i, ...extra } });

if (mode === 'quota') {
  process.stderr.write('Error: RESOURCE_EXHAUSTED: You have exhausted your quota for this model.\n');
  process.exit(1);
}
out({ event: 'init', conversation_id: id, init: { cwd: process.cwd(), tools: ['read_file'] } });
step(0, { state: 'DONE', step_type: 'user_input' });
if (mode === 'no-result') {
  process.stderr.write('jetski: no output produced\n');
  process.exit(0);
}
if (mode === 'denied') {
  out({ event: 'result', result: { conversation_id: id, status: 'SUCCESS', response: '', num_turns: 1, usage: { input_tokens: 5, output_tokens: 0 }, denied_actions: ['write_file(C:/x/a.txt)'] } });
  process.exit(0);
}
step(1, { state: 'ACTIVE', step_type: 'agent_response', text_delta: 'Done: ' });
step(1, { state: 'DONE', step_type: 'agent_response', text_delta: 'alpha', usage: { input_tokens: 10, output_tokens: 2 } });
out({ event: 'result', result: { conversation_id: id, status: 'SUCCESS', response: 'Done: alpha\n', num_turns: 1, usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 }, denied_actions: [] } });
