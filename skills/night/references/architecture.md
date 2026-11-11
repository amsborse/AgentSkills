# Night architecture

## Two layers, no duplication

- **Skills hold the work.** Day skills (`test-everything`, `fix-bug`, `improve`, `revamp-ui`, ...)
  hold the craft. Loop skills (`night-*`) hold only the loop contract: what to look for, one
  change per iteration, how it is measured, and when to stop. Each loop `composes` day skills, so
  anyone can run it interactively ("run night-tests on the parser").
- **The orchestrator holds the night.** `skills/night/scripts/` is a deterministic Node program.
  It knows nothing about tests or UI. It knows about loops only through the metadata interface
  (`loop-interface.md`). It plans, isolates, delegates, verifies, records, recovers and reports.
  A model never decides whether a change is kept.

## Modules (`scripts/lib/`)

| Module | Role |
| --- | --- |
| `state.mjs` | `.night/` layout, config defaults and validation, state.json (atomic writes), the events log, the PID lock with stale detection |
| `env.mjs` | Detects the stack, evaluation commands, repo signals, uncommitted changes and TODOs |
| `loops.mjs` | Discovers loop and day skills (repo, catalog, user) and checks the required sections |
| `plan.mjs` | Builds tasks with scores, each with a recorded basis. Handles requeue and follow-ups |
| `workspace.mjs` | Run worktree and lane worktrees, checkpoint and revert of a single task, patches, commit by path, cherry-pick integration |
| `agents.mjs` | Adapters for the `claude` CLI, Codex (via `codex-bridge`) and configured command agents. Agents run with push blocked, stall and timeout detection, and usage and cost capture. Routing picks the agent |
| `evaluate.mjs` | Runs checks with repeats (flaky detection), metrics, diff inspection (protected paths, removed assertions, skips, deleted tests, secrets) and the keep/revert/inconclusive decision |
| `supervisor.mjs` | The loop: start/resume, baseline, scheduling non-overlapping lanes, stop conditions, retries with backoff, experiments and failures, handoff and backlog |
| `report.mjs` | The morning report, built from recorded evidence only |
| `watchdog.mjs` | A pure `assess()` plus `tick()`/`watch()`. Restarts a dead or stalled supervisor with exponential backoff |

`night.mjs` is the CLI over these modules.

## One iteration

```
pick task (highest priority, eligible: time left, no scope overlap with running lanes)
  -> lane worktree synced to the run head; checkpoint (sha + untracked files)
  -> prompt rebuilt from files: loop skill body, mission, task, last handoff, recent learnings
  -> agent runs in the lane (fresh process; pushes blocked; commits folded back)
  -> supervisor verifies: diff inspection, every evaluation command, metrics, keep rule
  -> keep: commit by path in the lane, cherry-pick onto the run branch, re-verify if the
           run head moved since the lane started, otherwise drop it again
     revert: save a patch, restore exactly the task's files
  -> experiment record (hypothesis, baseline, changes, commands, results, verdict,
     confidence, next_hypothesis); failure record; requeue or block
```

The agent's `NIGHT_RESULT` line is a claim. It supplies a hypothesis, a summary, `done`,
follow-ups and a report for report loops. It never decides the verdict.

## State and recovery

`.night/` sits in the target repository and is added to `.git/info/exclude`. The layout:

- `config.yaml`, `state.json`, `mission.md`, `backlog.md`, `baseline.json`
- `experiments.jsonl`, `failures.jsonl`, `events.jsonl`
- `learnings.md`, `handoff.md`
- `checkpoints/`, `logs/`, `reports/`, `artifacts/`
- `STOP`, `lock`

Every JSON and markdown write goes through a temp file and a rename, and JSONL files are append-only.

**Resume.** On resume the supervisor does the following:

- aborts a half-done cherry-pick;
- moves the run branch back to the last integrated sha;
- reverts every lane that was mid-task and marks those tasks pending with an `interrupted` history entry;
- continues with the same limits and deadline.

The **watchdog** never calls a model. A run is unhealthy in either of these cases:

- the supervisor pid is dead;
- its heartbeat is older than max(5 min, 3 heartbeats) and the current phase's declared deadline has passed.

The heartbeat runs on a timer while agents and checks run asynchronously, so a 40-minute build is not a stall.

Restarts back off at base·2^n and stop after 5. A stop request plus a dead supervisor ends the run as `stopped`.

## Safety model

- **Isolation.** The user's checkout and uncommitted changes are never touched: work happens on `night/<date>-<label>` in a separate worktree. A revert affects only the files of the task being reverted. The code never uses `reset --hard`, `clean` or `add -A`.
- **Agents.** Agents get the system rules, disallowed tools (push, commit, reset, network, publish) and a git environment that rewrites every push URL to an invalid one.
- **Config.** The config validator rejects `allow_external_actions: true`. Permission bypass is never the default.
- **Protected paths.** Protected paths, which `evolve-skills` extends with the orchestrator and its own loop, turn any change into a revert. So do removed assertions, new skips, deleted tests and anything that looks like a secret.
- **Report.** The report states unknowns as unknown. Codex does not report cost, so total cost becomes "unknown", never $0.

## Stop conditions

These are checked before every launch:

- stop file
- deadline
- max iterations
- stagnation (N attempts in a row without a kept change)
- token or cost budget, either already spent or predicted to be exceeded by the next task based on the average per task
- low disk
- no usable agent
- empty queue
- nothing that fits in the remaining time

Finishing a loop (the agent reports `done` with no change) is not stagnation.

## What it borrowed, and what it refused

Studied in November 2026 from public sources; nothing was installed.

| Source | Taken | Refused |
| --- | --- | --- |
| Ralph Wiggum (Huntley, `ralph-loop` plugin) | One task per fresh process, plan files that can be rebuilt, "search before you implement" | In-session stop-hook loops (context rot), completion by magic string, unlimited iterations by default |
| nightcrawler | Supervisor shape: prompt rebuilt from mission, state and handoff, STOP file, PID lock, layered stop conditions, diminishing-returns stop, completion report | `--dangerously-skip-permissions` without isolation, letting the agent verify itself, no rollback |
| nightshift | Per-task attempt caps, "fail the task, keep the run", morning review | Mode with no git, no money cap |
| loop-skills | "Quiet round" convergence, Codex/Claude cross-routing, recording invalidated findings | Auto push and merge |
| autoresearch (and Karpathy's) | Commit-verify-keep-or-revert, baseline first, guard files, results log, failure classes | "Never stop" with no budget, a single metric as proof of behaviour |
| crank | Criteria tied to checkable facts, frozen evaluation surface, approvals queue ("Needs you"), verified/assumed tagging | Heavy ceremony on every round |
| watchloop | Cheap deterministic gate before any model call, the spawn wrapper as the single entry point | Skip-permissions on the host |
| Anthropic long-running harness articles, continuous-claude, LongHorizon-Harness | A skeptical evaluator separate from the generator, the agent's claims never change state on their own, stall diagnostics | Auto-merge to main |

## Known limits

- The keep decision only sees what the evaluation commands see. A repository with weak tests gets weak verification, and the report says so.
- Visual and accessibility loops need the project's own screenshot or audit commands configured as checks or metrics. Without them, those changes are kept only on no-regression.
- Codex runs report tokens but not cost, so cost budgets are enforced only for agents that report cost. When a cost budget is set and an agent reports no cost, the run warns once (state, log and stderr) that the budget cannot be enforced; token and iteration limits still apply.
- The push guard compares remote-tracking refs before and after each agent call. It catches a push that updates them, not one to a remote URL that has no tracking ref, and a `git fetch` the owner runs during the night also trips it (the run stops, which is the safe side).
- Assertion balance is counted per test file, so moving assertions from one test file to another is reported as a removal and the change is reverted.
- The lock is a file created exclusively. Taking over a stale lock (its process is dead) is a remove-then-create, so two runs started in the same instant after a crash could race; only one keeps the lock file, but both may start.
- Ignored files (build output, caches) that an agent creates in a lane are not removed by a revert, since git does not track them, and lanes are reused across tasks, so they persist until the run's workspace is deleted.
- A command agent's `{cwd}` and `{prompt_file}` are passed unquoted inside the configured command string, so paths with spaces need the command written to quote them.
- One machine, one run per repository (the lock). Lanes share the machine's CPU, so timing metrics in concurrent lanes are noisier; performance tasks should use `max_concurrent_agents: 1`.
