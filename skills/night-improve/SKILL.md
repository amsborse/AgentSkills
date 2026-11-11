---
name: night-improve
description: Improvement loop. Rank small repository improvements by evidence, make the best bounded change, and keep it only when checks prove the intended benefit without regressions. Use for "night-improve", "night improve" or as /night improve.
metadata:
  aliases: "night-improve, night improve"
  keywords: "night, loop, improve"
  composes: "improve, review-code, verify"
  requires: "git, shell"
  risk: "medium"
  night-loop: "improve, auto"
  night-writes: "code"
  night-minutes: "25"
  night-signals: "has-tests, todos, lint"
---

# Night improve

One iteration tackles one bounded hypothesis, using `improve`, `review-code`, `verify`
for the craft. Read the shared contract in `../night/references/loop-interface.md`;
this skill supplies the target, evidence and stopping rules.

## Activation

- Use for a general improvement backlog with tests, TODOs or lint evidence.
- Use a more specific loop when its evidence and acceptance criteria fit better.
- Read the handoff first and avoid repeating a target already resolved by earlier iterations.

## Workflow

1. **Baseline:** Record baseline checks and list candidates with code locations and observed costs.
2. **Choose:** Rank with Priority = (Impact x Confidence x RiskReduction)/(Effort x ExecutionCost).
   Score each factor 1-5; state the basis in user impact, evidence, risk avoided, work and run cost.
3. **One change:** Choose the highest-ranked feasible candidate; use `improve` for one coherent change.
4. **Check:** State its measurable benefit before editing: fewer warnings, less duplication or a passing check.
5. **Hand back:** run fast checks and report evidence, including failed or unavailable commands.
   The supervisor re-runs checks and decides keep/revert; never weaken tests or assertions.

## Evaluation

- Keep: The chosen metric improves and all previously passing evaluation checks remain green.
- Revert: No measurable benefit, new warnings, changed behaviour outside scope or weakened assertions.
- Inconclusive: missing evidence or unavailable checks cannot count as a successful iteration.
- Record baseline and candidate results with exact commands so the supervisor can repeat them.

## Stop conditions

- No candidate has a defensible benefit, or the last three candidates were low value.
- A red baseline needs bug investigation before general improvements.
- Stop at the supplied time or iteration limit; report the next bounded hypothesis.

## Examples

- Day: "run night-improve on the checkout module" investigates one target with the owner watching.
- Night: `/night improve` repeats bounded iterations within the supplied budget, with each
  outcome independently evaluated by the supervisor.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
Report evidence rather than grading your own result. Include changed paths and reproducible checks.
