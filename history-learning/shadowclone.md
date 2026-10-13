# Running ShadowClone alongside history-learning

[ShadowClone](https://github.com/theonly1me/shadowclone) (`npm i -g @shadowclone/cli`, 0.0.34+
for OpenCode) learns from the sources it supports natively and keeps its own reviewable rule
store with history and undo. Use it for those sources; use `hl` for the rest and for
cross-agent deduplication. Both stay behind the same consent and review rules.

## What each covers

| Store | ShadowClone source | hl source |
| --- | --- | --- |
| `~/.claude/projects` | `claude-code` | `claude-code` |
| `~/.claude-<profile>/projects` | not read (it only knows `~/.claude`) | `claude-code` |
| `~/.codex/sessions` | `codex` | `codex` |
| OpenCode database | `opencode` (0.0.34+) | `opencode` |
| Cursor IDE database and `~/.cursor/projects/*/agent-transcripts` | not read (`cursor` means the `cursor-agent` CLI store `~/.cursor/chats`) | `cursor-ide`, `cursor-transcripts` |
| Antigravity IDE brain | not read (`antigravity` means the CLI under `~/.gemini/antigravity-cli`) | `antigravity` |
| Kiro, Qwen | not read | `kiro`, `qwen` |
| `CLAUDE.md`, `AGENTS.md`, skills, git metadata | `agent-context`, `declared-rules`, `skill-library`, `git-metadata` | `hl catalog` (read-only listing) |

## Windows status (0.0.34)

On native Windows every command that touches the store, including the safe `init` below, stops
with "Storage directory must be owned by the current user". The check compares the directory's
`stat().uid` with `process.getuid()`, which does not exist on Windows, so it can never pass.
It is a security check, so do not patch the installed bundle to get around it. WSL is not a
drop-in alternative: its Linux side needs its own Node, and from there it would read Windows
history over `/mnt/c` with paths it does not understand.

Consequences on Windows: ShadowClone's index and `learn --deep` (with `--engine codex` or
`--engine cursor-agent`) are unavailable, and `hl` plus a reviewing agent session covers every
source instead. The deep-distillation engines also need their CLI on `PATH`: `codex` (the
desktop app bundles one that is not on `PATH`) or `cursor-agent` (not installed by the Cursor
IDE). Recheck after upgrading: `shadowclone --version`, then the `init` below. Reporting the
uid check upstream is the user's call.

## Safe setup

A plain `shadowclone init` that answers yes to learning enables every present source at once,
and may start a model distillation. A yes to skill maintenance syncs and edits skills across
agents. Neither is acceptable here. Instead:

```sh
shadowclone init --no-learn --no-skill-maintenance --no-background-learning   # writes ~/.shadowclone/config.toml, all sources off
```

Then enable only the consented native sources by editing `~/.shadowclone/config.toml`:

```toml
schema-version = 1

[sources]
claude-code = true      # only if the user enabled claude-code
codex = true            # only if the user enabled codex
opencode = true         # only if the user enabled opencode
skill-library = false   # keep false: no skill sync or edits
# every other source stays false

[distillation]
deep = false            # true only after model consent; it calls an agent CLI
automatic = false       # never: no background distillation
```

Do not run `shadowclone install`. It writes hooks and instructions into `CLAUDE.md`,
`settings.json`, `.agents/hooks.json` and skill folders, which would overwrite agent
configuration.

## Use

```sh
shadowclone learn                                   # local index, no model call
shadowclone learning pending                        # what it found; nothing applied
# only with model consent, and with an explicit cap:
shadowclone learn --deep --engine claude-code --max-calls 10
shadowclone learning show <key>                     # review one rule and its evidence
shadowclone learning reject <key> | narrow <key>    # keep its store clean
```

Never pass `--apply`. Treat ShadowClone's pending rules as one more input to `synthesis.md`:
when one matches an `hl` cluster, cite both, and when it does not, require the same evidence
bar before proposing it. Changes still land only through a `learning/<date>` branch.

## Undo

`shadowclone learning disable`, `shadowclone history`, `shadowclone undo <revision>`, and
`shadowclone forget --all` remove everything ShadowClone derived. It never modifies transcripts.
