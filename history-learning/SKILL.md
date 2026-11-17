---
name: history-learning
description: Learn durable preferences and corrections from past coding-agent conversations (Claude Code, Codex, Cursor, OpenCode, Antigravity, Kiro, Qwen) as reviewed skill updates. Use to learn from chat history, mine repeated corrections or audit what was learned. Read-only, consent-gated, redacted; never overwrites skills itself.
license: MIT
metadata:
  aliases: "learn from past conversations, mine my chat history, incremental history learning, audit what has been learned"
  keywords: "history, learning, conversations, transcripts, preferences, corrections"
  composes: "manage-skills"
  requires: "shell"
  risk: "medium"
  version: "1.0.0"
  state: "~/.agent-history-learning (private; never inside a repository)"
---

# History learning

Turns what the user has already told agents, across every tool and project, into skills that
stop the same mistakes from recurring. The pipeline is deterministic until the last step; the
only model involvement is a reviewing agent (you) reading a small, redacted, budgeted digest.

```sh
HL="node ~/agent-skills/history-learning/scripts/hl.mjs"
```

## Hard rules

1. **Read-only history.** Never write to, move, or "clean up" any transcript or database. SQLite
   stores are opened read-only; OpenCode's `credential`/`account` tables are never queried.
   The only exception is archiving, when the user asks for it after learning (`archive.md`).
2. **Consent first.** Sources start disabled. Ask the user before `$HL consent --enable`, and
   before `$HL consent --model allow`. Reading a digest *is* sending excerpts to a model.
3. **Private state.** Inventory, evidence, clusters, digests and reports live in the state
   directory. Never copy them, quotes from them, project names or paths into a public repo.
4. **No raw archives anywhere.** Never upload transcripts or the state directory to any service.
5. **Proposals, not publications.** Skill changes go on a local `learning/<date>` branch for the
   user to review. Never push, merge, or edit installed skill directories directly.
6. **Do not skip silently.** Every store found is reported, including unsupported and empty ones.

## Workflow

1. **Discover** (no consent needed): `$HL inventory` then `$HL catalog`. Read
   `reports/coverage.md` (sessions by agent, project, month; duplicates; unsupported stores)
   and `reports/catalog.md` (existing skills and instruction files). Sources: `sources.md`.
2. **Ask** the user which sources to enable, whether a reviewing model may read digests and
   with what token budget, and where project-specific skills belong. Record the answers:
   `$HL consent --enable claude-code,codex --model allow --budget 60000 [--redact "Acme,Bob"]`.
3. **Extract and cluster** locally: `$HL extract` then `$HL cluster`. Only human-typed turns from
   interactive sessions; automated (`claude -p`, `codex exec`) and subagent sessions are
   excluded. How signals, redaction and the evidence bar work: `extraction.md`.
4. **Digest**: `$HL digest`. One file per category under `digest/`, capped by the budget.
5. **Synthesize** by reading the digest and the catalog, following `synthesis.md`: improve
   existing skills before creating new ones, separate global from project scope, keep cluster
   ids as evidence and a confidence level on every rule, reject one-off or temporary asks.
   Write `proposals.json` to the state directory, run `$HL support` (it recomputes every
   rule's sessions and confidence from its clusters and fails on overstated or unknown ones),
   then `$HL mark --digest`.
6. **Stage** the changes on a `learning/<date>` branch (in a separate worktree when the repo's
   main checkout is shared with other agents), write each skill's evidence file with
   `$HL support --write`, run `scripts/validate.sh`, commit locally, and produce `$HL report`. Review, approval, sync and
   undo: `review.md`.
7. **Archive** (only when the user asks): zip sessions older than N days with
   `scripts/Archive-ChatHistory.ps1`, which verifies every file by hash before deleting the
   original and never touches memory folders or the Codex thread databases. Learned evidence
   survives. Order, `/insights` and Claude's `cleanupPeriodDays`: `archive.md`.

Taste (UI look, motion, writing voice) is mostly described, not commanded, so cue-based
extraction under-reads it. For such a subject run a topic pass, `$HL topic <name> --categories
ui-visual,animation --match <vocabulary> --budget <n>`, read the whole digest, draft rules by
judgement, then give each rule a keyword pattern and check its support with `$HL topic-support`
(see "Topic passes" in `synthesis.md`).

## Incremental learning

`$HL learn` re-inventories, extracts only sessions whose files changed, re-clusters, and (if
model review is consented) writes a digest containing only new or grown clusters. It is safe to
run from a night loop or a scheduled task because it makes no model calls and writes only to
the state directory. A human-started agent session then performs step 5 on that digest.

## Automatic daily capture

`node scripts/install.mjs --learning-hooks on` (from the repo root; `off` removes it all) sets up:

- **A daily run** (`hl schedule on|off|status [--at HH:MM]`, default 03:30): a Task Scheduler
  task on Windows, a marked crontab line elsewhere. It runs `hl auto-run --background`, a
  detached worker that runs `learn` and re-runs every saved topic pass (`topics/<name>.json`,
  e.g. `ui-taste`) with its own parameters. Sessions left open for days are covered, because
  `learn` re-reads any transcript that changed. About a minute, local, no model calls, nothing
  outside the state directory. Logs: `auto/logs/`.
- **A SessionStart hook** in every Claude profile. If no run happened in the last 26 hours
  (machine off at run time), it starts one. On new sessions, at most once a day, it tells the
  user how many new or grown clusters and new taste statements wait for review. A failed run is
  reported at every start until a run succeeds, and is not retried more than once a day.

Capture used to run from a SessionEnd hook; the installer removes that entry, and `hl hook
session-end` is a no-op for any profile that still has it.

When the user asks to review it: `$HL pending --write` (writes `topics/<name>.new.md` with only
the statements first seen since the last review), then synthesis step 5 on the digest plus those
delta files, then stage as in step 6. `$HL mark --digest` sets the review date that both the
cluster digest and the topic deltas count from.

## ShadowClone

ShadowClone natively learns from `~/.claude`, Codex, OpenCode, Pi, the Cursor CLI and the
Antigravity CLI. This skill covers the stores it does not (Claude profiles such as
`~/.claude-work`, the Cursor IDE database and agent transcripts, Antigravity IDE, Kiro, Qwen)
and the cross-agent deduplication. How to run both without letting either publish or edit
agent configs: `shadowclone.md`. On native Windows ShadowClone 0.0.34 cannot initialise its
store (an ownership check that needs POSIX uids); `hl` covers every source there.

## Commands

| Command | Effect |
| --- | --- |
| `inventory` | metadata-only scan of every store; `inventory.json`, `reports/coverage.md` |
| `catalog` | existing skills and instruction files; `reports/catalog.md` |
| `consent [--enable a,b] [--disable c] [--model allow\|deny] [--budget n] [--redact t]` | record consent |
| `extract [--full] [--limit n]` | redacted signal statements, changed sessions only |
| `cluster` | near-duplicate clusters with confidence |
| `digest [--budget n] [--all]` | budgeted per-category digest of new or grown clusters |
| `learn` | the incremental pipeline above |
| `evidence <cluster-id>` | every redacted statement behind a cluster |
| `mark <ids>\|--digest` | clusters reviewed; omitted from the next digest |
| `support [--write]` | per-rule sessions, projects and computed confidence; `--write` emits each skill's evidence file |
| `topic <name> --categories a,b [--match re] [--budget n]` | every statement on one subject, cue or not; budgeted `topics/<name>.md` |
| `topic-support <name> --patterns f [--write f]` | sessions and projects behind rules drafted from a topic, counts only |
| `report` | `reports/learning.md` and refreshed coverage |
| `forget [--source s]` | delete derived evidence (all, or one source); history untouched |
| `status` | consent and state summary |
| `pending [--write]` | what waits for review; `--write` emits `topics/<name>.new.md` deltas |
| `schedule on\|off\|status [--at HH:MM]` | the daily run (Task Scheduler or cron); installed by `--learning-hooks on` |
| `auto-run [--background]` | `learn` plus saved topic passes; `--background` detaches with a log |
| `hook session-start` | SessionStart hook (JSON on stdin): review notice, catch-up of a missed day |
