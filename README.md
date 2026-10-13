# agent-skills

Shared, version-controlled agent skills for every repository on this machine, installed into
Claude Code, Codex, OpenCode and Cursor from one source. Each skill follows the open Agent
Skills format (`SKILL.md` with `name`/`description` frontmatter plus supporting files loaded on
demand), and nothing in here is specific to one repository.

```text
agent-skills/
  nightly-evolution/        the skill (SKILL.md + 10 supporting files + scripts/evolve.mjs engine)
  history-learning/         learn from past agent conversations (SKILL.md + 5 supporting files + scripts/hl.mjs)
  working-agreements/       shared rules every repo imports (AGENTS.md + ui-quality.md + evidence files; SKILL.md wrapper)
  scripts/install.sh        link skills into every detected agent (idempotent)
  scripts/validate.sh       structure, engine, tests, installed links, repo policies
  tests/                    node:test suites (engine lifecycle, installer)
```

Requirements: Git and Node.js 18+. No npm dependencies.

## Install

```sh
git clone https://github.com/amsborse/AgentSkills ~/agent-skills   # or link an existing checkout
~/agent-skills/scripts/install.sh            # add --dry-run to preview, --uninstall to remove
~/agent-skills/scripts/validate.sh
```

The installer detects agents and links (junctions on Windows, symlinks elsewhere) each skill
into their user skill directories:

| Agent | Directory | Notes |
| --- | --- | --- |
| Claude Code | `~/.claude/skills`, plus every `~/.claude-<profile>/skills` that exists (`CLAUDE_CONFIG_DIR` profiles) | |
| Codex | `$CODEX_HOME/skills` (`~/.codex/skills`) | Codex follows symlinked skill folders |
| OpenCode | none needed when `~/.claude/skills` is installed (OpenCode reads it); otherwise `~/.config/opencode/skills` | avoids a duplicate skill name |
| Cursor | none needed (reads `~/.claude/skills` and `~/.codex/skills`); otherwise `~/.cursor/skills` | |

It never overwrites an existing directory or a link that points elsewhere (reported as a
conflict, exit code 2), and it also makes `~/agent-skills` point at this checkout when that
path is free. Because installs are links, `git pull` here updates every agent at once.

## nightly-evolution

Autonomous overnight improvement: one `nightly/evolution-YYYY-MM-DD` branch and isolated
worktree per repository per night, baseline metrics, a deterministic survey, scored and
deduplicated candidates, one atomic experiment at a time, checks and metrics against the
baseline, automatic revert of failures, persistent memory, and a single draft PR in the morning
with before/after evidence, failures, risks, remaining opportunities and token/compute usage.
It never merges, never deploys and never touches credentials, billing, production config or
migrations.

```sh
E="node ~/agent-skills/nightly-evolution/scripts/evolve.mjs"
$E init --repo <repo>        # discover; write .evolution/{policy.yaml,baselines.json,history.jsonl}
$E dry-run --repo <repo>     # full lifecycle on a throwaway branch; nothing pushed
$E tick --repo <repo>        # one bounded step; prints the next action for the agent
$E status --repo <repo>
```

### Running it nightly

There is deliberately no scheduler here. A repository's existing night loop calls
`evolve tick` once per wake, after its own primary duty, and follows the printed action. The
engine is resumable (state in `.git/evolution/`), locked against concurrent invocations,
refuses to take over another agent's live experiment or a same-named branch it did not start,
and finalizes before the policy window closes. See `nightly-evolution/SKILL.md` for the agent-facing contract.

### Per-repository files

| Path (main checkout) | Purpose |
| --- | --- |
| `.evolution/policy.yaml` | priorities, focus areas, checks, metrics, budgets, protected paths, UI pages; proposed for version control in the first nightly PR |
| `.evolution/baselines.json` | metric results per base commit and a rolling series |
| `.evolution/history.jsonl` | append-only memory of experiments, research, libraries, decisions, opportunities |
| `.git/evolution/` | per-night state, survey, logs, screenshots, report, discovery profile |

`.evolution/` is excluded through `.git/info/exclude`, so it never dirties `git status` and
memory survives branches that are never merged. Its files are written so that the repo's own
`prettier --check .` accepts them. Volatile state lives under `.git/`, and worktrees default
to `../<repo>-worktrees/`, because linters and formatters do not read `.git/info/exclude`.

## history-learning

Learns durable preferences, repeated corrections, decisions and working patterns from every
coding agent's local history (Claude Code and its profiles, Codex, the Cursor IDE and its agent
transcripts, OpenCode, Antigravity, Kiro, Qwen) and turns them into evidence-backed skill
proposals on a local `learning/<date>` branch for review. It complements
[ShadowClone](https://github.com/theonly1me/shadowclone): ShadowClone handles the sources it
supports natively, and this skill adds read-only adapters for the stores it does not read.

```sh
HL="node ~/agent-skills/history-learning/scripts/hl.mjs"
$HL inventory                 # metadata-only coverage of every store (no consent needed)
$HL consent --enable claude-code,codex --model allow --budget 60000
$HL learn                     # extract (changed sessions only), cluster, budgeted digest
$HL report                    # private learning report
```

History is only ever read. Sources and model review start disabled. Text is redacted before
it is stored, and only a token-budgeted digest of clustered statements is shown to a
reviewing agent. All derived data lives in `~/.agent-history-learning/`, never in this public
repository; `scripts/validate.sh` fails if credentials, emails, home paths or the local
username appear in tracked files. See `history-learning/SKILL.md`.

## working-agreements

The owner's standing rules for every coding agent (release safety, verification and honesty,
scope, autonomous runs, and UI taste), learned by `history-learning` from repeated explicit
instructions and corrections, plus a topic pass over everything the owner said about visual
design and motion. Each rule carries a strength tag; `evidence.md` and `ui-evidence.md` list the
supporting session and project counts, with no quotes, project names or paths.

The rules live once, in `working-agreements/AGENTS.md`, and repositories import that file
instead of copying it:

```md
<!-- in the repository's AGENTS.md (Codex, Cursor, OpenCode, Antigravity) -->
## Shared working agreements

The owner's cross-repository rules live in one shared file,
`~/agent-skills/working-agreements/AGENTS.md`. Read it before starting work. This file wins
where the two conflict. If that path does not exist on this machine, say so once and continue.
```

```md
<!-- in the repository's CLAUDE.md (Claude Code loads @imports automatically) -->
@~/agent-skills/working-agreements/AGENTS.md
```

Only Claude Code has a real import; the other agents follow the pointer in `AGENTS.md`. A
machine without `~/agent-skills` (a VM, CI, a cloud agent) does not see the shared rules until
the repository is cloned there and `scripts/install.sh` is run. The skill wrapper
(`working-agreements/SKILL.md`) covers sessions in repositories that do not import it yet.

## Changing a skill

Skills are installed by link, so edits here are live everywhere. Make changes on a branch and
merge them through a reviewed PR. A nightly run must never modify its own skill.
