#!/usr/bin/env node
// Stand-in for the Codex CLI in codex-bridge tests. FAKE_CODEX_MODE picks the scenario. Like the real
// `codex exec --json`, tool calls never reach stdout: their output only lands in the session rollout
// under $CODEX_HOME/sessions/YYYY/MM/DD/rollout-<time>-<threadId>.jsonl.
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
if (argv[0] === 'login' && argv[1] === 'status') {
  process.stdout.write('Logged in using ChatGPT\n');
  process.exit(0);
}
const mode = process.env.FAKE_CODEX_MODE || 'ok';
const id = '01a1ffe3-0000-7000-8000-00000000c0de';
const out = ev => process.stdout.write(JSON.stringify(ev) + '\n');
const toolOutput = mode === 'sandbox-fail'
  ? 'bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted\n'
  : 'alpha\n';
const answer = mode === 'sandbox-fail'
  ? 'Couldn’t read `note.txt` because the sandbox failed to start.'
  : 'note.txt says alpha';

const now = new Date();
const day = path.join(process.env.CODEX_HOME, 'sessions', String(now.getFullYear()),
  String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0'));
fs.mkdirSync(day, { recursive: true });
const rollout = [
  { type: 'session_meta', payload: { id } },
  { type: 'response_item', payload: { type: 'custom_tool_call', call_id: 'call_1', name: 'exec', input: 'cat note.txt' } },
  { type: 'response_item', payload: { type: 'custom_tool_call_output', call_id: 'call_1', output: [
    { type: 'input_text', text: 'Script completed\nOutput:\n' },
    { type: 'input_text', text: JSON.stringify({ exit_code: mode === 'sandbox-fail' ? 1 : 0, output: toolOutput }) },
  ] } },
];
fs.writeFileSync(path.join(day, `rollout-2026-11-21T20-54-51-${id}.jsonl`), rollout.map(r => JSON.stringify(r)).join('\n') + '\n');

out({ type: 'thread.started', thread_id: id });
out({ type: 'turn.started' });
out({ type: 'item.completed', item: { id: 'item_0', type: 'agent_message', text: answer } });
out({ type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 2 } });
const o = argv.indexOf('-o');
if (o >= 0) fs.writeFileSync(argv[o + 1], answer + '\n');
process.exit(0);
