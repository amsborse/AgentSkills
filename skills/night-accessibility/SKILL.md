---
name: night-accessibility
description: Accessibility loop. Repair one evidenced interface barrier and retain it only when violation counts fall, keyboard paths work and no new barriers appear. Use for "night-accessibility", "night accessibility" or as /night accessibility.
metadata:
  aliases: "night-accessibility, night accessibility"
  keywords: "night, loop, accessibility"
  composes: "revamp-ui, verify, test-everything"
  requires: "git, shell"
  risk: "medium"
  night-loop: "accessibility"
  night-writes: "code"
  night-minutes: "25"
  night-signals: "frontend"
---

# Night accessibility

One iteration tackles one bounded hypothesis, using `revamp-ui`, `verify`, `test-everything`
for the craft. Read the shared contract in `../night/references/loop-interface.md`;
this skill supplies the target, evidence and stopping rules.

## Activation

- Use for a runnable frontend with a reproducible accessibility barrier.
- Automated scores alone do not prove keyboard usability or accessible task completion.
- Read the handoff first and avoid repeating a target resolved by earlier iterations.

## Workflow

1. **Baseline:** Run axe/Playwright accessibility checks when available; record rule IDs and violation counts.
2. **Choose:** Use `verify` to test keyboard paths, focus order, contrast and labels in one affected flow.
3. **One change:** Use `revamp-ui` to remove one barrier; add regression coverage with `test-everything`.
4. **Check:** Repeat the same audit and keyboard path at the same scope, themes and viewport settings.
5. **Hand back:** run fast checks and report evidence, including unavailable or failed commands.
   The supervisor re-runs checks and decides keep/revert; never weaken tests or assertions.

## Evaluation

- Keep: Violation count drops, no violations are added and the affected task works with the keyboard.
- Revert: New barriers, lost focus or regressions in previously passing functional checks.
- Inconclusive: missing evidence or unavailable checks cannot count as a successful iteration.
- Record baseline and candidate results with exact commands for the supervisor to repeat.

## Stop conditions

- No actionable barriers remain in scope, or rendering prevents reliable assessment.
- Without automated tooling, count reproducible manual violations and disclose that limitation.
- Stop at the supplied time or iteration limit; report the next bounded hypothesis.

## Examples

- Day: "run night-accessibility on the modal keyboard path" investigates one target with the owner watching.
- Night: `/night accessibility` repeats bounded iterations within the supplied budget, with each
  outcome independently evaluated by the supervisor.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
Report evidence rather than grading your own result. Include changed paths and reproducible checks.
