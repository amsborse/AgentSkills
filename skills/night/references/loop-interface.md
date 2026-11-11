# Night loop interface

A night loop is an ordinary skill. People run it in the day ("run night-tests on the billing
module") and `/night` runs it unattended overnight. The loop holds only the loop contract: what to
look for, how to measure it, the one change per iteration, and when to stop. The craft lives in the
day skills it `composes` (`test-everything`, `fix-bug`, `revamp-ui` and so on), so nothing is
written twice.

## Discovery

The engine (`night.mjs loops`) scans, in order, and the first skill with a given name wins:

1. `<repo>/.claude/skills/*/SKILL.md` and `<repo>/.agents/skills/*/SKILL.md` (repository-local)
2. the catalog the `night` skill sits in (its sibling folders)
3. `~/.claude/skills/*/SKILL.md` and `~/.agents/skills/*/SKILL.md`

A skill is a **loop** when its frontmatter has `metadata.night-loop`. Every other skill is listed
as a day skill a loop may compose. Adding a loop is adding a folder: the core needs no change.

## Frontmatter

All values are strings (the catalog validator enforces this).

```yaml
---
name: night-tests
description: <what it does and when to use it, under ~280 characters>
metadata:
  aliases: "<unique trigger phrases>"
  keywords: "<search words>"
  composes: "test-everything, fix-bug"      # day skills that hold the craft
  requires: "git, shell"
  risk: "low|medium|high"
  night-loop: "tests"                        # /night modes this loop serves (comma list)
  night-writes: "code"                       # code | report (report loops must not edit files)
  night-minutes: "25"                        # typical minutes per iteration (time planning)
  night-signals: "no-tests, failing-tests"   # repo signals that make this loop relevant
  night-keep: "tests-up"                     # optional keep rule, see below
---
```

Signals the engine detects today: `failing-tests`, `no-tests`, `has-tests`, `frontend`,
`backend`, `python`, `node`, `docs`, `no-docs`, `todos`, `deps`, `ci`, `skills`, `dirty-tree`,
`playwright`, `lint`. A loop whose signals match ranks higher in `/night auto`.

Keep rules (`night-keep`, default `no-regression`): the supervisor always reverts a regression;
this adds what a kept change must also show. `tests-up`: the passed-test count rises.
`failures-down`: the failed count drops or a failing check now passes. `metric-up`: at least one
configured metric improves beyond its noise tolerance. `no-regression`: every check that passed
still passes and nothing else got worse.

## Body sections

Every loop SKILL.md has these sections, in this order:

- `## Activation`: when the loop applies and when it does not.
- `## Workflow`: the iteration, one change at a time.
- `## Evaluation`: what proves the change: commands, metrics, screenshots, and what counts as a
  regression.
- `## Stop conditions`: when the loop has nothing worth doing left.
- `## Examples`: a day use and a night use.

## The iteration contract (what `/night` expects of one agent run)

1. Read the handoff and the task in the prompt. Work only inside the given worktree.
2. Make **one** coherent change for the task (or, for `night-writes: report`, write no files).
3. Run the fast checks yourself, but do not grade yourself: the supervisor re-runs every
   evaluation command and decides keep or revert.
4. Do not commit, push, merge, switch branches, edit `.night/`, CI, lock files you were not asked
   to update, or anything under `protected_paths`. Never weaken a test or assertion.
5. End the final message with one line `NIGHT_RESULT: {json}` with these fields:
   `summary`, `hypothesis`, `files` (paths changed), `checks_run`, `confidence` (0-1),
   `next_hypothesis`, optional `done` (true when the loop has nothing worth doing left, so it is not
   queued again), and optional `follow_ups` (at most 3 of `{title, loop, why}`). For report
   loops add `report` (markdown). The supervisor treats all of it as an unverified claim.
