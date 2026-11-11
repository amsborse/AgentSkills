---
name: night-consistency
description: Consistency loop. Select one naming, error-handling, component or theme-token inconsistency, align a bounded set with an established repository pattern, and retain it only when checks show no regression. Use for "night-consistency", "night consistency" or as /night consistency.
metadata:
  aliases: "night-consistency, night consistency"
  keywords: "night, loop, consistency"
  composes: "improve, review-code, revamp-ui"
  requires: "git, shell"
  risk: "low"
  night-loop: "consistency"
  night-writes: "code"
  night-minutes: "20"
  night-signals: "frontend, has-tests"
---

# Night consistency

One iteration tackles one bounded hypothesis, using `improve`, `review-code`, `revamp-ui`
for the craft. Read the shared contract in `../night/references/loop-interface.md`;
this skill supplies the target, evidence and stopping rules.

## Activation

- Use when multiple implementations of the same concern diverge without a documented reason.
- Use existing patterns as the reference; do not introduce a new design system or convention.
- Read the handoff first and avoid repeating a target already resolved by earlier iterations.

## Workflow

1. **Baseline:** Inventory one inconsistency class: naming, error handling, duplicate components or theme tokens.
2. **Choose:** Identify the established reference with code locations and count deviations in a bounded scope.
3. **One change:** Use `improve` or `revamp-ui` for one coherent alignment; preserve intentional exceptions.
4. **Check:** Use `review-code` to check semantics, then run relevant tests and visual checks for UI changes.
5. **Hand back:** run fast checks and report evidence, including failed or unavailable commands.
   The supervisor re-runs checks and decides keep/revert; never weaken tests or assertions.

## Evaluation

- Keep: The scoped deviation count drops, the reference is unchanged and previously green checks still pass.
- Revert: Intentional differences disappear, semantics change or a new competing convention is introduced.
- Inconclusive: missing evidence or unavailable checks cannot count as a successful iteration.
- Record baseline and candidate results with exact commands so the supervisor can repeat them.

## Stop conditions

- No unexplained deviations remain in the selected class.
- The reference is ambiguous; record competing patterns for an owner decision.
- Stop at the supplied time or iteration limit; report the next bounded hypothesis.

## Examples

- Day: "run night-consistency on the dashboard theme tokens" investigates one target with the owner watching.
- Night: `/night consistency` repeats bounded iterations within the supplied budget, with each
  outcome independently evaluated by the supervisor.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
Report evidence rather than grading your own result. Include changed paths and reproducible checks.
