---
name: nightly-evolution
description: Autonomous overnight improvement of a repository on an isolated nightly/evolution-YYYY-MM-DD branch, producing one evidence-backed draft PR per night. Covers performance, code quality, architecture, UI/UX, modernization, security, reliability, AI efficiency, cost, developer experience and product opportunities. Use on a night-loop tick, or when asked to "run nightly evolution", "evolve this repo overnight" or "do an improvement pass". Not for fixing a specific reported bug.
license: MIT
metadata:
  version: "1"
  engine: scripts/evolve.mjs
---

# Nightly Evolution

Improve a repository while its owner sleeps, measurably and reversibly. The engine
(`scripts/evolve.mjs`, Node 18+, no dependencies) owns everything deterministic: branch and
worktree, locks, baselines, survey, scoring, dedupe, conflict guards, verification, revert,
memory and the PR. You own judgment and implementation. Spend tokens only where the engine
cannot decide.

```sh
EVOLVE='node ~/agent-skills/nightly-evolution/scripts/evolve.mjs'   # or <this skill dir>/scripts/evolve.mjs
$EVOLVE tick --repo <repo> --agent <your-name>
```

## The loop contract

Run **one** `tick` per wake of the repository's existing night loop. Do not create a new
scheduler, background loop or second watcher. Each tick does at most `budgets.max_tick_minutes`
of deterministic work, then prints JSON with an `action`:

| action | do |
| --- | --- |
| `idle` / `wait` | Nothing. Outside the window, night finished, or another agent owns the live attempt. |
| `blocked` | Read `why`, fix the cause if it is in policy/setup, then `tick --retry`. |
| `tick-again` | Baseline or final metrics continue next tick. |
| `triage` | Read the night's survey (the first `read` path; only that, plus files you choose to open), add scored candidates, `triage done`. |
| `implement` / `continue` | Implement that one candidate in the printed worktree, commit, `verify`, then `accept` or `reject`. |

If the host loop has its own primary duty (Kriya autonomy, a batch run), finish that duty's
tick first. Evolution is a secondary lane: skip it on any tick where the primary duty needs the
time, and never let it touch the primary lane's worktrees, claims or services.

## Triage (once per night)

1. Read the survey: baseline metrics, churn hotspots, largest files, duplication clusters,
   dependency audit and the **memory digest**. Never re-propose what memory marks rejected
   unless you have new evidence (`--retry-reason`).
2. Read the repo's own `AGENTS.md` / design docs named in the policy before proposing anything
   that touches architecture or UI. The repository's decisions outrank this skill. The tick
   output carries the policy's `focus` goals and repo `rules`; treat the rules as hard limits.
3. For each dimension with priority >= 3, open its file below and look for evidence-backed
   opportunities. Research the web only when a candidate depends on it (`research.md`).
4. Add candidates. Every candidate needs a hypothesis that names a metric or a test that will
   prove it. Prefer several small independent candidates over one large one.

```sh
$EVOLVE candidate add --dimension performance --title "..." --hypothesis "..." \
  --files apps/api/src/feed.ts --metrics api_feed.p95 --impact 4 --confidence 3 --cost 2 --risk 2
```

Score = impact x confidence x priority / (cost x risk). The engine refuses duplicates of past
experiments and candidates that target protected paths or files owned by in-flight work.

## Experiment (one at a time)

- Work only in the night worktree. Make **atomic commits** with clear messages.
- `verify <id>` runs the policy checks that match the changed files, measures the target and
  gating metrics against tonight's baseline, and rescans conflicts. It never commits.
- `experiment accept <id> --evidence "..."` only after a passing verify on the current HEAD.
  UI changes need `screenshot --candidate <id>` evidence first (`visual-design.md`).
- `experiment reject <id> --reason "..."` resets the worktree to where the experiment began.
  A rejected idea with its reason is valuable memory: write the reason for a future reader.
- Then `tick` again. The engine stops at the experiment/accept/token budgets and finalizes
  before the window closes: final metrics, report, push, **draft** PR.

## Non-negotiable rules

- Never merge, deploy, or push to the default branch. The PR is the only output.
- Never change credentials, `.env*`, secrets, billing, production configuration, or run a
  destructive database operation or migration. `protected_paths` enforces part of this; the
  rest is on you.
- Never use a paid API or model silently. Record usage with `usage --tokens N --usd X --model M`;
  paid usage is a violation unless `ai.paid_allowed` is true. Where the repo has a routing or
  cost policy (for example Viveka in Sutra), in-product AI goes through it.
- Do not claim improvement without recorded evidence. Do not weaken a test, fixture, threshold
  or gate to obtain green. A regression on a gating metric rejects the change.
- Do not add a library because it is popular. Adoption needs a measured reason (`research.md`).
- Preserve established design systems and architectural decisions; propose changes to them as
  findings in the PR, not as silent rewrites.
- Changes to this skill go through a reviewed PR in the `agent-skills` repository, never by
  editing the installed copy during a night.

## Deterministic before tokens

Read the night's survey, metric output and `verify` JSON instead of exploring broadly. Use the
repository's own tools (and `aef run` where installed) for verbose commands. Open a source
file only when a candidate needs it.

## Supporting files (load only when relevant)

| File | Load when |
| --- | --- |
| `performance.md` | latency, concurrency, caching, rendering, DB efficiency, bundles |
| `optimization.md` | code quality, duplication, dead code, AI token/routing efficiency, cost, developer experience |
| `architecture.md` | boundaries, modularity, resilience, scalability |
| `visual-design.md` | any UI change: design system, motion, WebGL, accessibility, screenshots |
| `research.md` | modernization, new libraries/patterns, any web research |
| `creativity.md` | product features and missing capabilities |
| `security.md` | vulnerabilities, dependencies, authorization, secrets |
| `reliability.md` | errors, retries, timeouts, recovery, observability |
| `evaluation.md` | defining metrics, verifying, screenshots, agent/AI evaluation |
| `memory.md` | recording discoveries, decisions, libraries and opportunities |

## Manual use

```sh
$EVOLVE init --repo <repo>          # once: discover and write .evolution/policy.yaml
$EVOLVE dry-run --repo <repo>       # whole lifecycle on a throwaway branch, no push
$EVOLVE tick --repo <repo> --force  # start tonight's run outside the window
$EVOLVE status --repo <repo>
```
