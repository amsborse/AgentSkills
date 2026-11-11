---
name: night-performance
description: Performance loop. Measure one real bottleneck with repeated baseline and candidate runs, make one bounded optimisation, and retain it only when the measured gain exceeds noise and behaviour stays stable. Use for "night-performance", "night performance" or as /night performance.
metadata:
  aliases: "night-performance, night performance"
  keywords: "night, loop, performance"
  composes: "improve, verify"
  requires: "git, shell"
  risk: "medium"
  night-loop: "performance"
  night-writes: "code"
  night-minutes: "30"
  night-signals: "has-tests, frontend, backend"
  night-keep: "metric-up"
---

# Night performance

One iteration tackles one bounded hypothesis, using `improve`, `verify`
for the craft. Read the shared contract in `../night/references/loop-interface.md`;
this skill supplies the target, evidence and stopping rules.

## Activation

- Use for a runnable workload with a repeatable latency, throughput or resource metric.
- Do not optimise a suspected hot path without measurements from a representative workload.
- Read the handoff first and avoid repeating a target already resolved by earlier iterations.

## Workflow

1. **Baseline:** Fix workload, environment and warm-up; record at least five baseline runs with `verify`.
2. **Choose:** Report raw values, units, median and spread (min-max); define the noise band before editing.
3. **One change:** Use `improve` to change one measured bottleneck while preserving output and public behaviour.
4. **Check:** Repeat at least five candidate runs under the same conditions; compare medians and spreads.
5. **Hand back:** run fast checks and report evidence, including failed or unavailable commands.
   The supervisor re-runs checks and decides keep/revert; never weaken tests or assertions.

## Evaluation

- Keep: The gain exceeds the defined noise band and correctness checks pass; include every raw number.
- Revert: The gain falls inside noise, resource use regresses beyond budget or outputs change.
- Inconclusive: missing evidence or unavailable checks cannot count as a successful iteration.
- Record baseline and candidate results with exact commands so the supervisor can repeat them.

## Stop conditions

- Never fabricate percentages; noisy or unavailable measurements are inconclusive.
- No measured bottleneck remains within scope, or repeatability cannot be established.
- Stop at the supplied time or iteration limit; report the next bounded hypothesis.

## Examples

- Day: "run night-performance on the search endpoint latency" investigates one target with the owner watching.
- Night: `/night performance` repeats bounded iterations within the supplied budget, with each
  outcome independently evaluated by the supervisor.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
Report evidence rather than grading your own result. Include changed paths and reproducible checks.
