---
name: night
description: Run autonomous, verified improvement loops on a repository overnight or while away. It plans by priority, works on an isolated run branch, delegates each iteration to Claude, Codex or a configured agent, independently verifies and keeps or reverts every change, survives crashes through a watchdog, and writes an evidence-only morning report. Never pushes, merges or deploys. Use for "/night", "/night auto", "/night tests", "run loops overnight", "night status", "night report" or "stop the night run".
metadata:
  aliases: "night, /night, night loop, night run, overnight loops, night status, night report, night stop, night resume"
  keywords: "night, overnight, loop, autonomous, unattended, watchdog, orchestrator, morning report, keep or revert, experiments"
  composes: "run-autonomous, coordinate-agents, review-code, night-tests, night-bug-hunter, night-improve"
  requires: "git, node, claude?, codex-bridge?"
  risk: "high"
---

# Night

`/night` is the orchestrator. The work itself lives in the loop skills (`night-tests`,
`night-bug-hunter`, `night-improve`, ...) and in the day skills they compose (`test-everything`,
`fix-bug`, `improve`, ...), so the same skills run interactively by day and unattended by night.
The orchestrator only plans, isolates, delegates, verifies, records and reports. It is a
deterministic Node script: no model decides whether a change is kept.

## Run it

All commands go through one CLI. From the target repository:

```
node ~/agent-skills/skills/night/scripts/night.mjs <command> [args]
```

Map the user's `/night ARGUMENTS` straight onto it:

| You get | Run |
| --- | --- |
| `/night` or `/night auto` | `run auto --detach` |
| `/night <mode>` (tests, bugs, improve, qa, visual, performance, refactor, research, security, docs, accessibility, consistency, dependencies, redteam, ideas, evolve-skills) | `run <mode> --detach` |
| `/night build <objective>` or `/night <free text>` | `run build <objective> --detach` / `run <free text> --detach` |
| `/night status`, `stop`, `resume`, `report` | the same word (`stop --now` kills agents and reverts their work) |
| "what would it do" | `plan [mode]` |

`security` runs `night-redteam` and `night-dependencies`; `night loops` lists every mode. Options: `--agent claude|codex|<name>`,
`--max-iterations N`, `--hours H`, `--dry-run`. Without `--detach` the run blocks the session, so
detach unless the user asked to watch it.

Before the first run in a repository, run `doctor` and fix what it reports (no agent, no
evaluation command, low disk). `init` writes `.night/config.yaml` with the defaults; see
`references/config.md`. After starting, tell the user the run branch and how to check on it,
then stop; do not poll. When the user comes back, `report` prints the morning report.

## What a run does

1. Detects the stack, evaluation commands, signals (no tests, failing tests, TODOs, UI, ...),
   uncommitted changes and available agents, and discovers loop skills by their `night-loop`
   metadata (`references/loop-interface.md`).
2. Plans tasks with Priority = (Impact x Confidence x RiskReduction) / (Effort x ExecutionCost),
   each score with a recorded basis.
3. Creates a run branch `night/<date>-<label>` in its own worktree from HEAD. The user's
   checkout and uncommitted changes are never touched.
4. Records a baseline: every evaluation command, repeated to catch flaky ones.
5. Per task: checkpoint, delegate one iteration to an agent in a lane worktree, then verify
   independently (re-run checks, inspect the diff for protected paths, removed assertions, new
   skips, deleted tests and secrets), and keep (commit to the run branch) or revert exactly that
   task's change, saving a patch. Concurrent tasks never share files.
6. Stops on any limit: time, iterations, stagnation, budgets, disk, repeated failure, empty
   queue, stop request. It does not start work that cannot finish in the time left.
7. Writes `.night/reports/<run>.md` from recorded evidence only (example:
   `references/sample-report.md`).

The watchdog (started by `--detach`) restarts a dead or stalled supervisor with exponential
backoff; a long build is not a stall because the heartbeat keeps ticking. Details:
`references/architecture.md`.

## Never

The orchestrator never pushes, merges, deploys, publishes, changes infrastructure, touches
billing or secrets, sends external messages or runs destructive migrations, and agents run with
pushes blocked and those tools denied. `allow_external_actions: true` is rejected. It never
bypasses permissions by default, never weakens a check to keep a change, and never reports a
number it did not measure. Tests and smoke runs use a fake command agent, never a paid model.

## Adding a loop

Create a skill with `night-loop`, `night-writes`, `night-minutes`, `night-signals` and
`night-keep` metadata and the sections Activation, Workflow, Evaluation, Stop conditions and
Examples. It is discovered from this catalog, `.claude/skills` or `.agents/skills` with no change
to the orchestrator; `scripts/validate.mjs` checks the interface.
