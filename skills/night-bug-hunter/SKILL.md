---
name: night-bug-hunter
description: Bug-hunting loop. Start from a red baseline, reproduce one failure, add a failing regression test and repair its root cause, keeping the fix only when the original failure and relevant checks pass. Use for "night-bug-hunter", "night bug hunter" or as /night bugs.
metadata:
  aliases: "night-bug-hunter, night bug hunter"
  keywords: "night, loop, bug, hunter"
  composes: "fix-bug, test-everything"
  requires: "git, shell"
  risk: "medium"
  night-loop: "bugs, qa"
  night-writes: "code"
  night-minutes: "30"
  night-signals: "failing-tests, todos, has-tests"
  night-keep: "failures-down"
---

# Night bug hunter

One iteration tackles one bounded hypothesis, using `fix-bug`, `test-everything`
for the craft. Read the shared contract in `../night/references/loop-interface.md`;
this skill supplies the target, evidence and stopping rules.

## Activation

- Use primarily when baseline tests are red or a concrete failure is reproducible.
- Do not guess fixes from TODOs alone; reproduce a reachable failure first.
- Read the handoff first and avoid repeating a target already resolved by earlier iterations.

## Workflow

1. **Baseline:** Run the failing command and record its exact failure, environment and reproduction steps.
2. **Choose:** Use `fix-bug` to trace the root cause through production paths, not just the visible symptom.
3. **One change:** Add a regression test and run it against unchanged code; it must fail for the reported reason.
4. **Check:** Fix one root cause, then run the regression and relevant suite through `test-everything`.
5. **Hand back:** run fast checks and report evidence, including failed or unavailable commands.
   The supervisor re-runs checks and decides keep/revert; never weaken tests or assertions.

## Evaluation

- Keep: The regression fails before the fix and passes after; baseline failures drop without new failures.
- Revert: The reproduction still fails, the test only checks a symptom, or a previously green check turns red.
- Inconclusive: missing evidence or unavailable checks cannot count as a successful iteration.
- Record baseline and candidate results with exact commands so the supervisor can repeat them.

## Stop conditions

- No reproducible failures remain in scope.
- A failure needs unavailable infrastructure or an owner decision; report the blocked reproduction.
- Stop at the supplied time or iteration limit; report the next bounded hypothesis.

## Examples

- Day: "run night-bug-hunter on the failing payment test" investigates one target with the owner watching.
- Night: `/night bugs` repeats bounded iterations within the supplied budget, with each
  outcome independently evaluated by the supervisor.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
Report evidence rather than grading your own result. Include changed paths and reproducible checks.
