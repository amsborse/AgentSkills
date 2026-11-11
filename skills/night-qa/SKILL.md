---
name: night-qa
description: User-flow QA loop. Exercise one main journey end to end, capture reproducible breaks, and add one regression-backed repair or a precise bug-hunter follow-up, with runtime evidence for every claim. Use for "night-qa", "night qa" or as /night qa.
metadata:
  aliases: "night-qa, night qa"
  keywords: "night, loop, qa"
  composes: "test-everything, verify, fix-bug"
  requires: "git, shell"
  risk: "medium"
  night-loop: "qa"
  night-writes: "code"
  night-minutes: "30"
  night-signals: "frontend, has-tests, playwright"
---

# Night qa

One iteration tackles one bounded hypothesis, using `test-everything`, `verify`, `fix-bug`
for the craft. Read the shared contract in `../night/references/loop-interface.md`;
this skill supplies the target, evidence and stopping rules.

## Activation

- Use when the application has main user flows that can run locally with safe fixtures.
- Do not exercise production purchases, real messages or other external side effects.
- Read the handoff first and avoid repeating a target already resolved by earlier iterations.

## Workflow

1. **Baseline:** List main flows and baseline their outcomes using `verify`; choose one uncovered or failing path.
2. **Choose:** Use Playwright when present, otherwise the existing end-to-end harness and real runtime.
3. **One change:** Exercise entry, actions and persisted outcome; record the first break and reproduction evidence.
4. **Check:** Fix that break with `fix-bug` and a failing regression test, or file a `night-bug-hunter` follow_up.
5. **Hand back:** run fast checks and report evidence, including failed or unavailable commands.
   The supervisor re-runs checks and decides keep/revert; never weaken tests or assertions.

## Evaluation

- Keep: The flow reaches its expected outcome and a repair passes its regression and relevant suite.
- Revert: A formerly passing flow fails, assertions weaken, or the outcome is inferred without execution.
- Inconclusive: missing evidence or unavailable checks cannot count as a successful iteration.
- Record baseline and candidate results with exact commands so the supervisor can repeat them.

## Stop conditions

- All main flows have current evidence and no actionable breaks remain.
- The runtime or fixtures are unavailable; report inconclusive evidence and the blocked flow.
- Stop at the supplied time or iteration limit; report the next bounded hypothesis.

## Examples

- Day: "run night-qa on the signup journey" investigates one target with the owner watching.
- Night: `/night qa` repeats bounded iterations within the supplied budget, with each
  outcome independently evaluated by the supervisor.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
Report evidence rather than grading your own result. Include changed paths and reproducible checks.
