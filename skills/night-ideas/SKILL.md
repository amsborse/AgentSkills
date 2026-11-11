---
name: night-ideas
description: Idea loop. Rank product and engineering opportunities from repository evidence with explicit priority scores, returning actionable proposals and follow-ups without writing files. Use for "night-ideas", "night ideas" or as /night ideas.
metadata:
  aliases: "night-ideas, night ideas"
  keywords: "night, loop, ideas"
  composes: "research, understand-code, improve"
  requires: "git, shell"
  risk: "low"
  night-loop: "ideas"
  night-writes: "report"
  night-minutes: "20"
  night-signals: ""
---

# Night ideas

One iteration tackles one bounded hypothesis, using `research`, `understand-code`, `improve`
for the craft. Read the shared contract in `../night/references/loop-interface.md`;
this skill supplies the target, evidence and stopping rules.

## Activation

- Use for product or engineering opportunities grounded in the current repository.
- Write no files, including notes or caches; propose work rather than implementing it.
- Read the handoff first and avoid repeating a target resolved by earlier iterations.

## Workflow

1. **Baseline:** Use `understand-code` to find code evidence for friction, missing capabilities or repeated costs.
2. **Choose:** Use `research` to check assumptions; label unverified demand and external claims explicitly.
3. **One change:** Rank with Priority = (Impact x Confidence x RiskReduction)/(Effort x ExecutionCost).
   Score each factor 1-5 with a stated evidence basis; use `improve` for ranking discipline.
4. **Check:** Develop one top idea per iteration; return ranked proposals in `NIGHT_RESULT.report`.
5. **Hand back:** run fast checks and report evidence, including unavailable or failed commands.
   The supervisor re-runs checks and decides keep/revert; never weaken tests or assertions.

## Evaluation

- Keep: Each idea cites code evidence, states scores and uncertainty, and defines a measurable outcome.
- Revert: Invented demand or benefits, file changes or proposals duplicating existing capabilities.
- Inconclusive: missing evidence or unavailable checks cannot count as a successful iteration.
- Record baseline and candidate results with exact commands for the supervisor to repeat.

## Stop conditions

- No new evidence-backed opportunity remains, or the last three ideas duplicate earlier proposals.
- Feed at most three actionable follow_ups; the supervisor reverts any accidental file change.
- Stop at the supplied time or iteration limit; report the next bounded hypothesis.

## Examples

- Day: "run night-ideas on the onboarding opportunities" investigates one target with the owner watching.
- Night: `/night ideas` repeats bounded iterations within the supplied budget, with each
  outcome independently evaluated by the supervisor.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
Report evidence rather than grading your own result. Include cited markdown in `report` and keep `files` empty.
