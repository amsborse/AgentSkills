# Autonomous night loop: shared context

This file is the shared context for the mission below. Any session or agent working on it reads
this file first and trusts it over its own memory or a chat summary. The work is longer than one
context window, so state lives here, in git and in `.night/`, never only in a conversation.

**Update rule (mechanical):** rewrite the "Live state" section after every finished step (each
`eta.js step`), before every commit, and before launching or stopping anything in the background.
Sections 1 to 4 are frozen: change them only when the owner changes the mission.

**Single writer:** one session works on this at a time. If `git status` in the skill worktree
shows changes the live section does not explain, or a live `.night/supervisor.lock` exists that
the live section does not mention, another session is active: stop and report, do not edit.

Paths are under `D:\1 - Projects\Projects\` unless they start with `~`.

## 1. Mission (the owner's words, unchanged)

```text
MISSION: Finish the Autonomous Unblocking Night Loop, then run it for 8 hours on Sutra

Build and execute, not plan-only. Do not ask me questions: the preflight is done and the safe
defaults below stand. Anything that needs me goes into the approval queue and the morning
report while you carry on with other work. Do not stop after building the skill.

Finished means all three:
1. the reusable skill exists in AgentSkills, tested and committed;
2. an 8-hour unattended run has completed on Sutra without intervention (if the engine breaks,
   fix it with a failing-first test and relaunch until a run completes on its own);
3. NIGHT-LOOP-REPORT.md tells me what was verified, what was only attempted, and what waits
   for my approval.

== WHERE THINGS STAND ==
- Worktree D:\1 - Projects\Projects\AgentSkills-wt-anl, branch feat/autonomous-night-loop,
  cut from AgentSkills main @ e3995f0. No file written or committed yet. All skill work goes
  here. Note ~/agent-skills links to the main checkout, not this worktree.
- Extend the existing `night` engine. Do NOT create a second scheduler or orchestrator.
  Read these first:
    skills/night/scripts/night.mjs
    skills/night/scripts/lib/{supervisor,state,plan,agents,evaluate,report,watchdog,workspace}.mjs
    skills/night/SKILL.md, skills/night/references/loop-interface.md, skills/run-autonomous/SKILL.md
    nightly-evolution/scripts/lib/{util,yaml}.mjs, scripts/validate.mjs
    tests/night.test.mjs (29 tests), tests/fixtures/night/fake-agent.mjs
- Sutra inputs: Sutra-wt-consolidated/docs/engineering/BRANCH-CONSOLIDATION.md (three "Items for
  the owner"), docs/END-TO-END-READINESS.md, AgentSkills docs/prompts/stock-intelligence-night-loop.md,
  Sutra modules/artha/src/stocks/learning-lab/night-loop.ts, .agents/skills/night-loop-kriya/SKILL.md,
  and Sutra's package.json scripts (to choose fast evaluation commands).
- Sutra worktrees:
    Sutra                  codex/desktop-indigo-clay, uncommitted desktop work   DO NOT TOUCH
    Sutra-wt-audit         audit/e2e-readiness, 4 uncommitted Google auth files  DO NOT TOUCH
    Sutra-wt-consolidated  integration/sutra-consolidated @ f31260ee, clean      launch the run here
    Sutra-wt-fable         research/stock-intel-fable, 3 commits not yet consolidated
    Sutra-v2-int           integration/stock-intel-v2 (node_modules is a junction)
    Sutra-wt-report-curiosity and .sutra/report-redesign-worktree: leave alone
- AgentSkills main has someone else's uncommitted changes (audit-design bench files, .serena/,
  docs/prompts/). Leave them alone.

== BUILD (in AgentSkills-wt-anl) ==
1. skills/night/scripts/lib/unblock.mjs, the unblocking engine. Classify every non-kept attempt:
   - technical: diagnose, bounded retries, smallest verified fix, regression test, record.
   - agent/model: check real availability, switch to an already-authorized agent, otherwise wait
     and continue other tasks. Never bypass a quota.
   - authorization: record the exact decision and the cost of waiting, put it in the approval
     queue, continue unrelated tasks. Never self-approve.
   - research: keep the negative result under .night/artifacts/<run>/, keep the claim blocked.
     Never weaken a statistical gate.
   Approval queue: .night/approvals.jsonl, append-only, entries
   {id, at, run_id, task_id, decision, consequence, default, status}. Only the owner resolves
   one, with `night approvals approve|deny <id>`. The supervisor re-reads it every loop:
   approved -> task back to pending, denied -> skipped.
2. Queue. Add one internal status, waiting_approval, and store task.blocker = {kind, ...}.
   One mapping function to the reporting states: pending->READY, running->RUNNING,
   waiting_approval->WAITING_FOR_APPROVAL, blocked after exhausted technical retries->FAILED,
   other blocked->BLOCKED, kept/done->VERIFIED, skipped->SKIPPED. Write .night/queue.json
   next to the backlog with: id, key, objective, dependencies, priority, acceptance, agent,
   attempts, runtime, usage, last error, evidence links, commit, state.
3. Dependencies: task.key and task.dependencies. A task is eligible only when all its
   dependencies are kept or done. A blocked, waiting or skipped dependency blocks its
   dependents (kind "dependency") so the queue can still drain.
4. Idempotency: task.key is the idempotency key, with a ledger at .night/idempotency.jsonl.
   Seeding skips keys already present. A side_effect task interrupted mid-run goes to
   waiting_approval ("outcome uncertain, check state"), never a blind retry.
5. Rate limits: they do not count toward attempts, iterations or stagnation. Backoff grows
   with a streak and is capped at about 30-60 minutes; the loop waits while the wake time is
   before the deadline. Extend the RATE regex in agents.mjs with
   "hit your (usage )?limit|session limit|weekly limit".
6. A protected-path change is an authorization blocker: waiting_approval, patch saved, no
   retry. Agents can declare a blocker in NIGHT_RESULT.blocker {kind, decision, consequence,
   detail}. Approval and research outcomes do not count as stagnation.
7. Per-task `verify` commands ([{name, run}]) run in the lane after the global checks; a
   failure reverts the change with failure "acceptance_failed".
8. Resource limits: resources.min_free_memory_mb and a CPU ceiling (sample os.cpus() deltas,
   because os.loadavg is 0 on Windows). Under pressure launch nothing new and log it; stop with
   "resource_pressure" only if it lasts about 30 minutes with nothing running. Record runtime,
   tokens and cost per task.
9. Ownership: refuse to start when another worktree of the same repo holds a live
   .night/supervisor.lock, or the run branch or directory is already checked out elsewhere.
10. Presets: skills/autonomous-night-loop/presets/<name>.yaml with mission, config overrides
    and tasks (key, title, objective, acceptance, verify, depends_on, scores, writes,
    estimate_minutes, scope, side_effect, optional loop). Five presets on one engine:
    stock-intelligence, personal-intelligence, repository-consolidation, general-engineering,
    research-and-validation. `night preset <name> [--file path]` seeds a planned queue and
    writes mission.md and .night/preset.yaml. Config merges defaults < preset < user.
    writeMission must not overwrite a preset mission. A bare `night run [--detach]` must use
    the planned queue (today modeAndObjective returns mode "auto" and discards it).
11. Report: report.mjs also writes NIGHT-LOOP-REPORT.md (location configurable) with start and
    end time, mission and repo, initial and final commit, tasks completed, tests and evidence,
    bugs fixed, remaining blockers, questions needing approval, runtime and resource usage,
    next actions. Verified and attempted are kept apart. The first section reads in under a
    minute.
12. Agents: Claude Code first. commandAdapter.available() checks a `bin` with commandExists.
    Ship Codex, Antigravity (agy) and OpenCode definitions as config examples, marked untested
    unless you actually exercised them.
13. skills/autonomous-night-loop/SKILL.md plus a references/unblocking-engine.md. Add the new
    paths and test files to ENGINE_PATHS in supervisor.mjs.

== TESTS (fake agent only, no model calls) ==
- Add fake-agent behaviours: ratelimit, needs-approval, research-block, protected.
- New tests: queue durability and dependencies, blocker classification, rate-limit wait,
  approval approve/deny flow, preset seeding, idempotent re-seed.
- Real recovery test: start a detached run with a hanging fake agent, kill the supervisor
  PID, let the real watchdog (no injected spawner) resume it, and assert that no completed
  task repeats and no commit is cherry-picked twice.
- Then run `node --test tests/night.test.mjs` (all 29 must still pass) and
  `node scripts/validate.mjs`. Commit by path to feat/autonomous-night-loop.

== RUN ON SUTRA ==
1. One real Claude smoke of 1-2 iterations first. Nested `claude -p` is unproven on this
   machine and my hooks will run inside it.
2. Then ONE real 8-hour run launched from Sutra-wt-consolidated, so the base is
   integration/sutra-consolidated. Settings: max_concurrent_agents 1, max_iterations about 60,
   max_stagnant_iterations about 12, workspace.setup = offline frozen pnpm install (a real
   install, not a node_modules junction), fast evaluation commands from package.json
   (typecheck, lint, targeted tests). Wait on it with a background command that exits when
   the run state is terminal. Register no OS schedule.
3. Seed the queue in this priority order (user-visible impact, dependency unblocking, chance
   of success, verification value, cost; docs and cosmetics never displace end-to-end work):
   A. Consolidation: continue integration/sutra-consolidated; bring in verified Personal
      Intelligence, Stock Intelligence V2 and Fable work; reconcile GDELT display permissions;
      resolve the V2 vs Fable protocol differences, especially the 20-day evaluation
      discrepancy; strengthen experiment hashing and lineage. Triage Fable's 3 commits one by
      one: hashing, lineage and protocol fixes may go in; anything that trains or validates on
      returns goes to the approval queue.
   B. Personal Intelligence: clean desktop build and launch; Google OAuth error and reconnect
      experience; Sutra server auth; real Tasks and Calendar sync; attention recommendations;
      agent session liveness and stale-state reconciliation; Artha spending accuracy; desktop
      and web E2E tests. Stage the owner sign-in where needed; never fake real-account success.
   C. Stock Intelligence (reuse the existing SI night loop): verified GDELT research and
      display; Fable LightGBM integration; complete experiment fingerprints; point-in-time
      integrity; supported Python inference runtime; one-shot prospective news shadow; SEC
      fundamentals research integrity; simulated paper-trading ledger with fees and slippage;
      real Learning Lab browser verification; source licensing decision memo.
4. Seed the approval queue with the three "Items for the owner" from BRANCH-CONSOLIDATION.md
   and the preflight defaults listed below.
5. Full unit, integration and load suites run on the Oracle VM in a separate checkout with an
   isolated Postgres, delivered by git bundle, never by push. Only targeted tests on the PC.
6. Before calling it done, record exact exit codes and test counts for: typecheck, lint,
   format, unit, integration, build, desktop launch, browser E2E, data-policy and
   research-integrity checks. Nothing passes on mocks alone. At the end, fast-forward
   integration/sutra-consolidated locally from the run branch and say that you did.

== HARD LIMITS ==
Allowed without asking: read-only inspection, local code changes in authorized worktrees,
running tests, creating dedicated non-production worktrees, documentation, local checkpoints,
commits of verified changes to the designated branch, isolated non-production test services.

Not allowed without my explicit approval: push or merge into main; production deployment;
deleting branches or worktrees; destructive database operations; purchases or paid API usage;
changing real personal tasks or calendar events; live financial trades; unlocking the sealed
2025+ holdout; persistent schedules or recurring shadow jobs; access-control bypasses;
modifying another agent's work. Stock-return training and validation stay blocked until
source rights are confirmed. Never weaken a test or statistical gate, never bypass a quota,
never self-approve, never fabricate a result.

Git hygiene: no `git reset --hard`, `git clean -fd`, `git add -A` or `git stash`; stage your
own files by path; unlink node_modules junctions before removing any worktree. Every bug fix
gets a regression test that fails first.

Safe defaults already adopted (list them in the report as open questions for me):
- commits go to integration/sutra-consolidated;
- AgentSkills work stays on feat/autonomous-night-loop, not merged to main;
- 8-hour runtime; Claude CLI agents only, fake agent in tests;
- full suites on the Oracle VM, targeted tests on the PC;
- local dev services and disposable local test records are fine, no real Tasks or Calendar writes.

== WHEN IT ENDS ==
Stop the background processes you started. Send one notification. Reply in 2-5 sentences:
what is verified, what failed, where the report and the approval queue are.

One thing to know before you paste it: the lane agents draw on the same Claude quota as the session that launches them, so a usage limit mid-run will pause the loop rather than fail it, and the 8 hours may deliver less work than the clock suggests.
```

## 2. Standing rules that also apply

- Owner's working agreements: `~/agent-skills/working-agreements/AGENTS.md` (never push, merge,
  deploy or publish unasked; no paid model calls in tests; no secrets in output; never destroy
  work you did not create; done means verified; never fabricate; every bug fix gets a
  failing-first regression test; never weaken a test).
- Replies are 2 to 5 sentences, result first. No questions: take the safe default and list it in
  the report.
- Progress: `node ~/.claude/scripts/eta.js plan <steps> <minutes>`, then `eta.js step` per step.
- No `git stash` in Sutra (stashes are shared across worktrees). Full unit, integration and load
  suites run on the Oracle VM, never on the PC. One notification per task, at the end. Never run
  deliver, rerun or resend commands (batch email guard). The owner runs `git push`.
- `scripts/validate.mjs` fails on credentials, emails, home paths and the local username in
  scanned files: write `~` instead of a home path.
- Commit messages end with the co-author attribution line the harness gives at session start.
- Do not commit this folder (`docs/night-loop/`): the AgentSkills repository is public and this file
  names private project state. It stays untracked in the worktree; stage other files by path.
- The original paste and the whole first session are in
  `~/.claude/projects/D--1---Projects-Projects-Sutra/471e0635-762a-40a4-951a-61db49f9c00b.jsonl`.

## 3. Where things are

**Checked on 2026-11-18 and different from the mission text:** the branch
integration/sutra-consolidated and the worktrees `Sutra-wt-consolidated` and `Sutra-wt-audit` no
longer exist. The consolidation was merged into Sutra main (422be4d0) and recorded as deployed
(b974d3ac). The table below is the checked state; section 1 keeps the owner's original wording.
Safe default taken: the run gets a new dedicated worktree `Sutra-wt-night` on a new branch
`integration/night-loop` cut from main, the run's verified commits are fast-forwarded only into
that branch, and nothing is committed to main. This is an open decision for the owner.

| Path | Branch | Rule |
| --- | --- | --- |
| `AgentSkills-wt-anl` | feat/autonomous-night-loop (from main @ e3995f0) | all skill work goes here |
| `AgentSkills` | main | someone else's uncommitted files: leave alone. `~/agent-skills` links here |
| `Sutra` | main @ c28978bf, clean | the owner's checkout: read only, never commit here |
| `Sutra-wt-night` (to create) | integration/night-loop, from main | launch the 8-hour run here |
| `Sutra-wt-followup` | chore/consolidation-followups @ b974d3ac, already in main | leave alone |
| branch audit/e2e-readiness @ bbf25dc1 | no worktree | leave alone |
| `Sutra-wt-fable` | research/stock-intel-fable | 3 commits not yet consolidated, read-only source |
| `Sutra-v2-int` | integration/stock-intel-v2 | node_modules is a junction |
| `Sutra-wt-report-curiosity`, `.sutra/report-redesign-worktree` | | leave alone |

Engine files (in `AgentSkills-wt-anl`): `skills/night/scripts/night.mjs` (CLI),
`skills/night/scripts/lib/{supervisor,state,plan,agents,evaluate,report,watchdog,workspace}.mjs`,
`nightly-evolution/scripts/lib/{util,yaml}.mjs`, `tests/night.test.mjs` (29 tests at the start),
`tests/fixtures/night/fake-agent.mjs`, `scripts/validate.mjs`.

Sutra inputs to read before seeding the queue (in `Sutra`, on main, unless noted):
`docs/engineering/BRANCH-CONSOLIDATION.md` (three "Items for the owner"),
`docs/END-TO-END-READINESS.md`, `package.json` scripts, `modules/artha/src/stocks/learning-lab/night-loop.ts`,
`.agents/skills/night-loop-kriya/SKILL.md`, and AgentSkills main `docs/prompts/stock-intelligence-night-loop.md`.

Shell notes: the Bash working directory resets after every command, so start each one with
`cd "/d/1 - Projects/Projects/AgentSkills-wt-anl" && ...`. Tests use temp directories without
spaces, `NIGHT_AGENTS=fake`, and must not pass `NODE_TEST_CONTEXT` to a nested `node --test`.

## 4. Engine map: where each build item hooks in

Read the function before editing it. Names are in `supervisor.mjs` unless another file is given.

| Build item | Hook |
| --- | --- |
| 1 unblock engine, approvals | new `lib/unblock.mjs`; called from `finishAttempt` (classify every non-kept attempt) and from `loop` (re-read `.night/approvals.jsonl` each tick); `night.mjs` gets an explicit `approvals` case (the `default` case prepends `run`) |
| 2 queue states | `waiting_approval` status and `task.blocker`; one status-to-report-state function; `writeBacklog` also writes `.night/queue.json`; `statusText` in `night.mjs` counts waiting tasks; `finish` and the `queue_empty` check must not count waiting tasks as open |
| 3 dependencies | `plan.mjs` `newTask` (add `key`, `dependencies`, `verify`, `side_effect`; export it); `eligible` filters on dependencies and blocks dependents with kind "dependency" |
| 4 idempotency | ledger `.night/idempotency.jsonl` written when seeding; `resume` sends an interrupted `side_effect` task to waiting_approval instead of pending |
| 5 rate limits | `runTask` rate_limited branch (streak backoff, cap 30 to 60 minutes) and `finishAttempt` (no attempt, iteration or stagnation count); `loop` waits while the wake time is before the deadline instead of stopping with `agents_unavailable`; `RATE` regex in `agents.mjs` |
| 6 protected paths, declared blockers | `runTask` after `inspectDiff` (`diff.protected` -> waiting_approval, patch saved); `buildPrompt` contract gains `blocker`; `finishAttempt` skips the stagnation count for approval and research outcomes |
| 7 per-task verify | `runTask`, after the global `runChecks`; failure `acceptance_failed` reverts |
| 8 resources | `state.mjs` `DEFAULT_CONFIG.resources`; `stopReason` and the launch gate in `loop`; CPU from `os.cpus()` deltas; per-task runtime, tokens, cost in `finishAttempt` |
| 9 ownership | `runNight`, around `acquireLock`: other worktrees of the same repo with a live lock, or the run branch or directory checked out elsewhere |
| 10 presets | `skills/autonomous-night-loop/presets/*.yaml`; `night.mjs` `preset` case and `file` as a valued flag; `state.mjs` `paths` and `loadConfig` (defaults < `.night/preset.yaml` < user); `writeMission` must keep a preset mission; bare-run bug: `modeAndObjective` returns mode "auto" for no arguments, so `start` discards the planned queue |
| 11 report | `report.mjs` `writeReport` also writes NIGHT-LOOP-REPORT.md; existing tests assert on `/Finished|kept/i`, `/no check ran/`, `/tool missing/`, `/total cost/` |
| 12 agents | `agents.mjs` `commandAdapter.available` checks `def.bin` with `commandExists` |
| 13 docs, engine paths | `skills/autonomous-night-loop/SKILL.md`, `references/unblocking-engine.md`; `ENGINE_PATHS` (a test asserts `protectedPaths` contains them) |
| 14 shared context for lane agents | already present: `buildPrompt` feeds each lane agent the tail of `.night/mission.md`, `.night/handoff.md` and learnings. Add one contract sentence (state lives in those files and in `.night/queue.json`, not in the agent's session) and document it. No second mechanism |

Known facts that are easy to get wrong:

- `classify` in `agents.mjs` reports `rate_limited` only when the exit code is not 0 or the result
  is an error.
- `finishAttempt` blocks a task when the same failure fingerprint repeats or attempts exceed
  `max_retries_per_task`; an existing test expects status `blocked` for plan `js-test,break`.
- The watchdog restarts with `night resume --from-watchdog`; `MAX_RESTARTS` is 5; the restart delay
  is `backoff_base_seconds * 2 ** restarts`. The real recovery test runs `night watchdog --interval N`
  with no injected spawner.
- `night.mjs` help text ends with a `Modes: ...` line that a test parses.
- The YAML subset has no nested flow collections: quote strings that contain `: `.

## Live state

Last updated: 2026-11-18, by the first session: context file and resume prompt written, Sutra
state re-checked. No engine code written yet.

Next action: read the Sutra inputs listed in section 3, then write `skills/night/scripts/lib/unblock.mjs`
and work down the build checklist.

Background processes started by this mission and still running: none.
Night run on Sutra: not started. Run id: none. Run branch: none.

### Build checklist (in `AgentSkills-wt-anl`)

| Item | Status | Commit | Evidence |
| --- | --- | --- | --- |
| 1 unblock engine and approval queue | not started | | |
| 2 queue states and queue.json | not started | | |
| 3 dependencies | not started | | |
| 4 idempotency | not started | | |
| 5 rate limits | not started | | |
| 6 protected paths and declared blockers | not started | | |
| 7 per-task verify | not started | | |
| 8 resource limits | not started | | |
| 9 ownership | not started | | |
| 10 presets and bare-run fix | not started | | |
| 11 NIGHT-LOOP-REPORT.md | not started | | |
| 12 agents (bin check, config examples) | not started | | |
| 13 skill docs and ENGINE_PATHS | not started | | |
| 14 lane-agent shared-context sentence | not started | | |

### Tests

| Item | Status | Evidence |
| --- | --- | --- |
| fake-agent behaviours: ratelimit, needs-approval, research-block, protected | not started | |
| queue durability and dependencies | not started | |
| blocker classification | not started | |
| rate-limit wait | not started | |
| approval approve and deny flow | not started | |
| preset seeding and idempotent re-seed | not started | |
| real watchdog recovery (no repeat, no double cherry-pick) | not started | |
| `node --test tests/night.test.mjs` (29 old tests still pass) | not run | |
| `node scripts/validate.mjs` | not run on the new work | |
| committed by path to feat/autonomous-night-loop | nothing committed | |

### Run on Sutra

| Step | Status | Evidence |
| --- | --- | --- |
| Sutra inputs read | not started | |
| real Claude smoke, 1 to 2 iterations | not started | |
| queue seeded (A consolidation, B personal intelligence, C stock intelligence) | not started | |
| approval queue seeded (three owner items, five safe defaults) | not started | |
| worktree `Sutra-wt-night` created on integration/night-loop | not started | |
| 8-hour run launched from `Sutra-wt-night` | not started | |
| run finished on its own | not started | |
| full suites on the Oracle VM by git bundle | not started | |
| exit codes and test counts: typecheck, lint, format, unit, integration, build, desktop launch, browser E2E, data-policy, research-integrity | none recorded | |
| integration/night-loop fast-forwarded locally from the run branch | not done | |
| NIGHT-LOOP-REPORT.md written | not done | |
| background processes stopped, one notification sent | not done | |

### Open decisions for the owner (go in the report, do not block)

- Commits go to integration/night-loop (new, from main), because integration/sutra-consolidated no
  longer exists. Consolidation queue items (group A) are re-checked against main first: work
  already merged is marked verified, not redone. Fable's 3 commits are still outside main.
- AgentSkills work stays on feat/autonomous-night-loop, not merged to main.
- 8-hour runtime; Claude CLI agents only; fake agent in tests.
- Full suites on the Oracle VM; targeted tests on the PC.
- Local dev services and disposable local test records are fine; no real Tasks or Calendar writes.

### Engine failures and relaunches

None yet. Record each as: what broke, the failing-first test, the fix commit, the relaunch time.
