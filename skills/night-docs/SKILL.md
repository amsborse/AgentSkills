---
name: night-docs
description: Documentation loop. Find one mismatch between repository instructions and actual code, correct it with precise examples, and retain the edit only when the documented commands and claims are verified locally. Use for "night-docs", "night docs" or as /night docs.
metadata:
  aliases: "night-docs, night docs"
  keywords: "night, loop, docs"
  composes: "understand-code, verify"
  requires: "git, shell"
  risk: "low"
  night-loop: "docs"
  night-writes: "code"
  night-minutes: "15"
  night-signals: "docs, no-docs"
---

# Night docs

One iteration tackles one bounded hypothesis, using `understand-code`, `verify`
for the craft. Read the shared contract in `../night/references/loop-interface.md`;
this skill supplies the target, evidence and stopping rules.

## Activation

- Use for missing setup instructions, stale command examples or documentation drift.
- Avoid marketing fluff and speculative capabilities; describe what the current code actually does.
- Read the handoff first and avoid repeating a target already resolved by earlier iterations.

## Workflow

1. **Baseline:** Use `understand-code` to compare one documented claim with its implementation and configuration.
2. **Choose:** Run the existing documented command safely and record the mismatch or missing prerequisite.
3. **One change:** Make one documentation correction tied to code evidence, including required working directory.
4. **Check:** Use `verify` to run each changed command exactly as documented in a safe local environment.
5. **Hand back:** run fast checks and report evidence, including failed or unavailable commands.
   The supervisor re-runs checks and decides keep/revert; never weaken tests or assertions.

## Evaluation

- Keep: Changed commands work as written and every corrected claim maps to current code or runtime evidence.
- Revert: A command fails, prerequisites are hidden or prose promises behaviour the implementation lacks.
- Inconclusive: missing evidence or unavailable checks cannot count as a successful iteration.
- Record baseline and candidate results with exact commands so the supervisor can repeat them.

## Stop conditions

- No evidenced drift remains in the selected documentation area.
- A command needs external side effects or unavailable services; report it as unverified.
- Stop at the supplied time or iteration limit; report the next bounded hypothesis.

## Examples

- Day: "run night-docs on the local setup guide" investigates one target with the owner watching.
- Night: `/night docs` repeats bounded iterations within the supplied budget, with each
  outcome independently evaluated by the supervisor.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
Report evidence rather than grading your own result. Include changed paths and reproducible checks.
