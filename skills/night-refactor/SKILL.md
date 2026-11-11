---
name: night-refactor
description: Refactoring loop. Characterise existing behaviour before simplifying one bounded area, preserve the public API, and keep the change only when tests and review show equivalent behaviour with less complexity. Use for "night-refactor", "night refactor" or as /night refactor.
metadata:
  aliases: "night-refactor, night refactor"
  keywords: "night, loop, refactor"
  composes: "improve, test-everything, review-code"
  requires: "git, shell"
  risk: "medium"
  night-loop: "refactor"
  night-writes: "code"
  night-minutes: "25"
  night-signals: "has-tests, todos"
---

# Night refactor

One iteration tackles one bounded hypothesis, using `improve`, `test-everything`, `review-code`
for the craft. Read the shared contract in `../night/references/loop-interface.md`;
this skill supplies the target, evidence and stopping rules.

## Activation

- Use for a bounded complexity problem with behaviour that can be characterised.
- Not for feature changes or public API redesign; route those to a separate owner decision.
- Read the handoff first and avoid repeating a target already resolved by earlier iterations.

## Workflow

1. **Baseline:** Record public API and current outputs; add and pass characterisation tests before moving code.
2. **Choose:** Choose one simplification with a concrete measure such as branches, duplication or dependencies.
3. **One change:** Use `improve` within a cap of fewer than 300 changed lines, including tests, per iteration.
4. **Check:** Run `test-everything` and use `review-code` to compare behaviour, API and the complexity measure.
5. **Hand back:** run fast checks and report evidence, including failed or unavailable commands.
   The supervisor re-runs checks and decides keep/revert; never weaken tests or assertions.

## Evaluation

- Keep: Characterisation and existing checks pass, the public API is unchanged and complexity drops.
- Revert: Observable behaviour changes, the diff reaches 300 changed lines or the complexity benefit is absent.
- Inconclusive: missing evidence or unavailable checks cannot count as a successful iteration.
- Record baseline and candidate results with exact commands so the supervisor can repeat them.

## Stop conditions

- The next useful refactor cannot fit the cap; propose a smaller independent step.
- No defensible simplification remains, or behaviour cannot be characterised safely.
- Stop at the supplied time or iteration limit; report the next bounded hypothesis.

## Examples

- Day: "run night-refactor on the parser internals" investigates one target with the owner watching.
- Night: `/night refactor` repeats bounded iterations within the supplied budget, with each
  outcome independently evaluated by the supervisor.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
Report evidence rather than grading your own result. Include changed paths and reproducible checks.
