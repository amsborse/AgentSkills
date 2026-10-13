# Sources

Every adapter is read-only and dependency-free (Node 22.5+ for `node:sqlite`). Each yields
session metadata for the inventory and, after consent, the user's typed turns with the end of
the agent reply that preceded each one.

| Source id | Store | What counts as a user turn | ShadowClone |
| --- | --- | --- | --- |
| `claude-code` | `~/.claude*/projects/**/*.jsonl` (every `CLAUDE_CONFIG_DIR` profile) | `type:user` lines that are not sidechain, meta, compact summaries, tool results, slash-command echoes or hook output | native for `~/.claude` only |
| `codex` | `$CODEX_HOME/sessions/**/*.jsonl` (+ `archived_sessions`) | `event_msg/user_message` (CLI) or `item_completed` `UserMessage` (desktop); falls back to `response_item` user messages minus injected AGENTS.md / environment context | native |
| `cursor-ide` | `%APPDATA%/Cursor/User/globalStorage/state.vscdb`, table `cursorDiskKV` | `bubbleId:<composer>:<bubble>` with `type: 1`, ordered by `composerData:<id>.fullConversationHeadersOnly` | not supported |
| `cursor-transcripts` | `~/.cursor/projects/<slug>/agent-transcripts/**/*.jsonl` | `role:user`, text inside `<user_query>` | not supported (it reads `~/.cursor/chats`, the CLI store) |
| `opencode` | `$OPENCODE_DB` or `$XDG_DATA_HOME/opencode/opencode.db` | `session_message.type = 'user'`, `data.text` | native |
| `antigravity` | `~/.gemini/antigravity/brain/<id>/.system_generated/logs/transcript.jsonl` (IDE) and `~/.gemini/antigravity-cli/brain/...` (CLI) | `USER_INPUT` steps | native for the CLI only |
| `kiro` | `~/.kiro/sessions/cli/*.jsonl` | `kind: Prompt`, text content | not supported |
| `qwen` | `~/.qwen/projects/*/chats/*.jsonl` | `type: user`, `message.parts[].text` | not supported |

Reported but not read:

- `~/.claude*/history.jsonl`: prompt log that duplicates the project transcripts.
- Antigravity `conversations/*.pb` and `*.db`: undocumented protobuf blobs. They are marked
  `duplicate` when a brain transcript exists for the same id, otherwise `unsupported`.
- Continue sessions, VS Code Copilot `chatSessions`: listed with their count. There is no adapter yet.
- Absent agents (Pi, Cursor CLI, Antigravity CLI, Gemini CLI, Windsurf, Factory, Amp, Cline,
  Claude Desktop, Aider): listed as not installed, or as present-without-adapter.

## Origin classification

| Origin | Rule | Used as evidence |
| --- | --- | --- |
| `interactive` | default | yes |
| `automated` | Claude `entrypoint` starting `sdk` (headless `claude -p`), Codex `source: exec` | no: prompts were written by scripts and loops |
| `subagent` | Claude `subagents/` files, Codex `source: {subagent}`, OpenCode `parent_id`, Cursor bubbles with `subagentSpawnTaskToolCallId` | no: prompts were written by another agent |

Interactive sessions can still carry scripted prompts, for example when a loop opens an
interactive agent. Clustering drops any long prompt whose opening recurs verbatim in four or
more sessions (`extraction.md`).

## Projects

A session's project comes from its working directory, or for Cursor from the workspace URI or
the files it edited. Subfolders, linked worktrees (`<repo>/.<tool>/worktrees/*`,
`<repo>-worktrees/*`) and task clones (`Sutra-<task>` next to `Sutra`) collapse onto the main
repository. Deleted folders resolve to the first missing folder below the nearest survivor.
Paths in temp folders without a repository become `(temp)`.

## Duplicates

- Cursor transcripts and IDE composers share ids; the IDE record is primary.
- Resumed Claude sessions copy earlier lines with the same `uuid`; turns are deduplicated by it.
- Forked Codex and OpenCode sessions repeat parent turns with the same timestamp and text;
  turns are deduplicated by `(timestamp, text)`.
- The same correction typed in different sessions is not a duplicate. It is the strongest signal.

## Adding an adapter

Add `scripts/lib/adapters/<agent>.mjs` exporting `{ id, agent, roots(), sessions(root),
turns(session) }`, register it in `adapters/index.mjs`, and add a fixture to
`tests/history-learning.test.mjs`. Discover the format by printing key names and types only,
never string values, until the user has consented to that source.
