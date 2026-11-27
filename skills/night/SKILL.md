---
name: night
description: Run autonomous, verified improvement loops on any repository overnight. Plans by stage and signals, isolates worktrees, delegates iterations, verifies independently, rotates past blocked tasks, and writes an evidence-only morning report. Use for "/night", "/night auto", "run loops overnight", "night status" or "night report".
metadata:
  aliases: "night, /night, night loop, night run, overnight loops, night status, night report, night stop, night resume, night bootstrap"
  keywords: "night, overnight, loop, autonomous, unattended, watchdog, orchestrator, morning report, keep or revert, experiments"
  composes: "run-autonomous, coordinate-agents, review-code, night-tests, night-bug-hunter, night-improve, night-readiness, night-security-faults, night-visual"
  requires: "git, node, claude?, codex-bridge?"
  risk: "high"
---

# Night

`/night` is the deterministic overnight orchestrator. Craft lives in day skills (`production-ready`,
`improve-visuals`, `security-audit`, `test-everything`, `fix-bug`, ...); loop contracts live in
`night-*` skills. The orchestrator detects the stack, domain (`saas`, `game`, `ai`, `frontend`,
`backend`, polyglot languages) and lifecycle stage (`seed` -> `prototype` -> `mvp` -> `production`),
plans by priority, runs isolated worktree lanes, verifies every diff independently, rotates across
fresh loops instead of halting early on one stagnant task, and writes an evidence-only morning report.

## Run it

From the target repository:

```
node ~/agent-skills/skills/night/scripts/night.mjs <command> [args]
```

| You get | Run |
| --- | --- |
| `/night` or `/night auto` | `run auto --detach` (stage-aware mix of matching loops) |
| `/night full` | `run full --detach` (broad overnight playlist: code + creative research loops) |
| `/night <playlist>` (`saas`, `game`, `production`, `hardening`, `security`, `polish`, `creative`) | `run <playlist> --detach` |
| `/night <loop-mode>` (`readiness`, `security-faults`, `saas-lab`, `game-lab`, `chaos`, `visual`, `dependencies`, `ideas`, `tests`, `bugs`, `improve`, `qa`, `performance`, `refactor`, `research`, `docs`, `accessibility`, `consistency`, `redteam`, `evolve-skills`) | `run <loop-mode> --detach` |
| `/night build <objective>` or `/night <free text>` | `run build <objective> --detach` / `run <free text> --detach` |
| `/night status`, `stop`, `resume`, `report`, `bootstrap`, `doctor` | the same word (`stop --now` kills agents and reverts their work) |
| "what would it do" | `plan [mode]` |

Options: `--agent claude|codex|<name>`, `--max-iterations N`, `--hours H`, `--dry-run`. Detach
unless the user asked to watch it.

Before the first run in any repository:
1. Run `doctor` to inspect git, stage (`seed`/`prototype`/`mvp`/`production`), signals, agents,
   evaluation commands and disk.
2. If the repository is at `seed` or `prototype` stage with no test runner yet, run `bootstrap` to
   configure safe deterministic starter checks in `.night/config.yaml` (or run report loops such as
   `ideas` / `research` immediately).
3. Start the detached run, tell the user the `night/<date>-<label>` branch and how to check
   `status` / `report`, then stop without polling.

## What a run does

1. Detects stack (Node/Bun/Deno/TS, Python/uv, Rust, Go, .NET, Swift, Godot), domain signals
   (`saas`, `game`, `ai`, `frontend`, `backend`, `monorepo`, `docker`), stage (`seed`..`production`)
   and loop skills (`references/loop-interface.md`).
2. Scores tasks with `Priority = (Impact x Confidence x RiskReduction) / (Effort x ExecutionCost)`.
3. Creates an isolated worktree on `night/<date>-<label>`; uncommitted changes in the main checkout
   are never touched.
4. Captures baseline checks (repeated to expose flakiness) and metrics.
5. Per iteration: syncs a lane worktree, runs one fresh agent process with pushes blocked, inspects
   the diff (protected paths, removed assertions, skips, deleted tests, secrets), re-runs checks,
   and cherry-picks kept commits onto the run branch or reverts cleanly while saving `.patch` files.
6. Rotates across untried pending loops if an early task stagnates, stopping only on deadline,
   budget, disk, stop request, or when the queue has no viable work left.
7. Writes `.night/reports/<run>.md` and `latest.md` from recorded evidence only.

## Never

Never pushes, merges, deploys, publishes, edits infrastructure/migrations/secrets, weakens checks,
or invents metrics. `allow_external_actions: true` is rejected. Tests use deterministic fake agents.
