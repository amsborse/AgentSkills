# agent-skills

Task-oriented skills for every coding agent on this machine (Claude Code, Codex, Cursor,
OpenCode, Gemini CLI), installed from one source. Ask for what you want in plain words; the agent
picks the matching skill, and each skill sizes itself to the job. Skills follow the open Agent
Skills format (`SKILL.md` with frontmatter, extra files loaded on demand).

## Just ask

| You say | Skill |
| --- | --- |
| "Revamp my website UI" | `revamp-ui` |
| "Build this feature end to end" | `build-feature` |
| "Research this topic deeply" | `research` |
| "Find and fix this bug" | `fix-bug` |
| "Understand the architecture of this repository" | `understand-code` |
| "Make this project production ready" | `production-ready` |
| "Automate this browser workflow" | `automate-browser` |
| "Run this task autonomously overnight" | `run-autonomous` |
| "Review my changes" / "second opinion from Codex" | `review-code` |
| "Add a hero animation" | `build-animation` |
| "Test everything" | `test-everything` |
| "Security audit this repo" | `security-audit` |
| "What can be improved?" / "refactor this" | `improve` |
| "Check it works" / "I still see the old one" | `verify` |
| "Delegate this to Codex" | `coordinate-agents` |
| "Which skill should I use?" / "add a skill" | `manage-skills` |

All 17 skills, with what each composes and needs: `docs/SKILL-CATALOG.md`. Not sure which one
fits? `node scripts/route.mjs "your request"`.

```text
agent-skills/
  skills/<name>/            the catalog: SKILL.md + workflows/ loaded on demand
  shared/                   files several skills read (codex-bridge.md, browser.md)
  registry/                 generated skills.json and capabilities.json; compatibility.json
  working-agreements/       shared rules every repo imports (AGENTS.md, ui-quality.md, evidence)
  nightly-evolution/        overnight improvement engine (scripts/evolve.mjs) and skill
  history-learning/         learn from past agent conversations (scripts/hl.mjs) and skill
  scripts/                  install.mjs, validate.mjs, build-registry.mjs, route.mjs, hooks/
  tests/                    node:test suites (engine, installer, router, registry, hook, catalog)
  docs/                     ARCHITECTURE, SKILL-CATALOG, MIGRATION, SOURCES, OPEN-QUESTIONS, INVENTORY
```

Requirements: Git and Node.js 18+. No npm dependencies.

## Install

```sh
git clone https://github.com/amsborse/AgentSkills ~/agent-skills   # or link an existing checkout
node ~/agent-skills/scripts/install.mjs      # --dry-run to preview, --uninstall to remove
node ~/agent-skills/scripts/validate.mjs
node --test ~/agent-skills/tests/
```

The installer links (junctions on Windows, symlinks elsewhere) every skill into:

| Agent | Directory read |
| --- | --- |
| Claude Code | `~/.claude/skills`, plus every `~/.claude-<profile>/skills` that exists |
| Codex, Cursor, Gemini CLI, OpenCode | `~/.agents/skills` (the shared user skills folder) |

It is idempotent, never overwrites a real directory or a link that points elsewhere, and removes
only links it created that no longer match a skill. It changes no settings unless asked:
`--router-hook on` adds an optional keyword-hint hook to Claude Code, `--codex-block on` adds a
pointer block to `$CODEX_HOME/AGENTS.md`; `off` removes them. How routing works, and the token
cost: `docs/ARCHITECTURE.md`. Upgrading from the old layout and rolling back: `docs/MIGRATION.md`.
Third-party code and its review: `docs/SOURCES.md`.

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
repository; `scripts/validate.mjs` fails if credentials, emails, home paths or the local
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
the repository is cloned there and `scripts/install.mjs` is run. The skill wrapper
(`skills/working-agreements/SKILL.md`) covers sessions in repositories that do not import it yet.

## Changing a skill

Skills are installed by link, so edits here are live everywhere. Make changes on a branch and
merge them through a reviewed PR. A nightly run must never modify its own skill.
