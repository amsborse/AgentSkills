---
name: history-learning
description: Learn durable preferences, corrections, decisions and working patterns from historical coding-agent conversations (Claude Code, Codex, Cursor, OpenCode, Antigravity, Kiro, Qwen) and turn them into reviewed, evidence-backed skill updates. Use when asked to learn from past conversations or chat history, mine repeated corrections or preferences, update skills from experience, run incremental history learning, or audit what has been learned. Read-only over history, consent-gated per source, redacts before any model sees text, and never publishes or overwrites skills on its own.
license: MIT
metadata:
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
   Write `proposals.json` to the state directory, then `$HL mark --digest`.
6. **Stage** the changes on a `learning/<date>` branch in the right repository, run
   `scripts/validate.sh`, commit locally, and produce `$HL report`. Review, approval, sync and
   undo: `review.md`.

## Incremental learning

`$HL learn` re-inventories, extracts only sessions whose files changed, re-clusters, and (if
model review is consented) writes a digest containing only new or grown clusters. It is safe to
run from a night loop or a scheduled task because it makes no model calls and writes only to
the state directory. A human-started agent session then performs step 5 on that digest.

## ShadowClone

ShadowClone natively learns from `~/.claude`, Codex, OpenCode, Pi, the Cursor CLI and the
Antigravity CLI. This skill covers the stores it does not (Claude profiles such as
`~/.claude-work`, the Cursor IDE database and agent transcripts, Antigravity IDE, Kiro, Qwen)
and the cross-agent deduplication. How to run both without letting either publish or edit
agent configs: `shadowclone.md`.

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
| `report` | `reports/learning.md` and refreshed coverage |
| `forget [--source s]` | delete derived evidence (all, or one source); history untouched |
| `status` | consent and state summary |
