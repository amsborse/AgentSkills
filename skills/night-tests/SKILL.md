---
name: night-tests
description: Test-coverage loop. Each iteration finds the riskiest untested behavior, adds one focused test in the project's own style, proves it would catch a break, and keeps it only if the suite stays green. Use for "night-tests", "add tests overnight", "grow coverage in a loop" or as /night tests.
metadata:
  aliases: "night-tests, night tests, test loop, add tests overnight, coverage loop"
  keywords: "night, loop, tests, coverage, regression, unit, integration, characterization"
  composes: "test-everything, fix-bug"
  requires: "git, shell"
  risk: "low"
  night-loop: "tests"
  night-writes: "code"
  night-minutes: "20"
  night-signals: "no-tests, has-tests, failing-tests"
  night-keep: "tests-up"
---

# Night tests

One loop iteration adds one test that protects behavior that matters. The craft (frameworks,
flaky tests, end-to-end) is in `test-everything`; this skill is the loop around it. The loop
contract shared by every night loop is in `../night/references/loop-interface.md`.

## Activation

- Use when a repository has untested critical paths, a thin suite, or no tests at all.
- With **no test runner**, the first iteration sets up the smallest runner the stack already
  implies (`node --test`, `pytest`) and one smoke test. A new framework beyond that needs the
  owner, so record it as a decision instead.
- Not for fixing failing tests: that is `night-bug-hunter`. If the suite is red at baseline,
  stop and hand the failures to that loop.

## Workflow

1. **Baseline:** run the suite once and record pass, fail and skip counts (the supervisor has
   them in the prompt when run by `/night`).
2. **Pick one target:** the most-changed or most critical file without tests (git log, imports
   from entry points, money, auth, data writes). Skip what earlier iterations covered (handoff).
3. **Write one test** (or one small group for one function) in the existing style. It reaches
   state through production code paths and asserts behavior, not implementation details.
4. **Prove it bites:** break the code under test temporarily, confirm the test fails, restore
   the code, and confirm it passes. Note this in `checks_run`.
5. **Run the suite.** Report `NIGHT_RESULT` with the file covered and the next target.

## Evaluation

- Keep: every evaluation command still passes, the passed-test count rises, the failed count does
  not, and no existing assertion was removed or loosened.
- Revert: any previously passing check fails, a test is skipped or deleted, or the new test is
  flaky (passes and fails across the supervisor's repeated runs).
- Inconclusive: the suite could not run (missing tool). Record it; do not count it as a win.

## Stop conditions

- The critical paths in the risk map all have tests, or the last 3 targets were low value.
- The suite is red at baseline (hand over to `night-bug-hunter`).
- Two iterations in a row produced flaky tests: the problem is the harness, record it.

## Examples

- Day: "run night-tests on `src/billing`" adds one test per iteration while you watch, and
  stops when billing's branches are covered.
- Night: `/night tests` ranks untested modules, runs up to `max_iterations` iterations, and the
  morning report lists each kept test with before and after pass counts.
