---
name: night-research
description: Research loop. Investigate one repository question with primary sources and code evidence, then return a cited markdown report with confidence levels and unknowns, without changing any files in the worktree. Use for "night-research", "night research" or as /night research.
metadata:
  aliases: "night-research, night research"
  keywords: "night, loop, research"
  composes: "research, understand-code"
  requires: "git, shell"
  risk: "low"
  night-loop: "research"
  night-writes: "report"
  night-minutes: "30"
  night-signals: ""
---

# Night research

One iteration tackles one bounded hypothesis, using `research`, `understand-code`
for the craft. Read the shared contract in `../night/references/loop-interface.md`;
this skill supplies the target, evidence and stopping rules.

## Activation

- Use for a bounded technical question whose answer can guide a later implementation.
- This is a report-only loop: write no files, including notes, caches or downloaded references.
- Read the handoff first and avoid repeating a target already resolved by earlier iterations.

## Workflow

1. **Baseline:** Use `understand-code` to map the question to code paths and define one decision to investigate.
2. **Choose:** Use `research` to gather primary sources; distinguish observed facts from inference.
3. **One change:** Cross-check conflicting claims and record source dates, code locations and applicability.
4. **Check:** Return cited markdown in `NIGHT_RESULT.report`, with confidence levels, unknowns and next steps.
5. **Hand back:** run fast checks and report evidence, including failed or unavailable commands.
   The supervisor re-runs checks and decides keep/revert; never weaken tests or assertions.

## Evaluation

- Keep: The report answers the question with traceable citations and explicitly supported confidence.
- Revert: Unsupported certainty, missing citations or file changes; every file change gets reverted by the supervisor.
- Inconclusive: missing evidence or unavailable checks cannot count as a successful iteration.
- Record baseline and candidate results with exact commands so the supervisor can repeat them.

## Stop conditions

- The question is answered, sources are exhausted or access blocks further verification.
- Keep unknowns visible; do not turn a missing source into a fabricated conclusion.
- Stop at the supplied time or iteration limit; report the next bounded hypothesis.

## Examples

- Day: "run night-research on the storage migration options" investigates one target with the owner watching.
- Night: `/night research` repeats bounded iterations within the supplied budget, with each
  outcome independently evaluated by the supervisor.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
Report evidence rather than grading your own result. Include cited markdown in `report` and keep `files` empty.
