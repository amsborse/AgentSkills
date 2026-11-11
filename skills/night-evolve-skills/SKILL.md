---
name: night-evolve-skills
description: Skill-evolution loop. Improve one catalog skill from recorded failures and repeated corrections, validate the edit, and reserve changes to the active loop or engine for human application. Use for "night-evolve-skills", "night evolve skills" or as /night evolve-skills.
metadata:
  aliases: "night-evolve-skills, night evolve skills"
  keywords: "night, loop, evolve, skills"
  composes: "manage-skills, history-learning, review-code"
  requires: "git, shell"
  risk: "high"
  night-loop: "evolve-skills"
  night-writes: "code"
  night-minutes: "30"
  night-signals: "skills"
---

# Night evolve skills

One iteration tackles one bounded hypothesis, using `manage-skills`, `history-learning`, `review-code`
for the craft. Read the shared contract in `../night/references/loop-interface.md`;
this skill supplies the target, evidence and stopping rules.

## Activation

- Use for a skill catalog with failures.jsonl, learnings.md or repeated correction evidence.
- Use `history-learning` only within existing source consent; unsupported preferences are not rules.
- Read the handoff first and avoid repeating a target resolved by earlier iterations.

## Workflow

1. **Baseline:** Use `manage-skills` to select one repeated failure pattern with evidence references and frequency.
2. **Choose:** Never modify `skills/night`, `skills/night-evolve-skills` or any running watchdog/supervisor script.
3. **One change:** Represent protected edits as a proposal file in `NIGHT_RESULT.report`, never write it to disk;
   alternatively validate an authorised isolated worktree copy. Only a human applies those edits.
4. **Check:** For an unprotected skill, make one evidence-backed edit; use `review-code` and the catalog validator.
5. **Hand back:** run fast checks and report evidence, including unavailable or failed commands.
   The supervisor re-runs checks and decides keep/revert; never weaken tests or assertions.

## Evaluation

- Keep: Run `node scripts/validate.mjs` when present; validation passes and the cited failure scenario improves.
- Revert: Protected running code changes, unsupported generalisations, alias collisions or validator failures.
- Inconclusive: missing evidence or unavailable checks cannot count as a successful iteration.
- Record baseline and candidate results with exact commands for the supervisor to repeat.

## Stop conditions

- Only protected changes remain: return proposals for a human; never self-apply them.
- No repeated failure has a bounded remedy, or required validation cannot run.
- Stop at the supplied time or iteration limit; report the next bounded hypothesis.

## Examples

- Day: "run night-evolve-skills on the catalog routing failures" investigates one target with the owner watching.
- Night: `/night evolve-skills` repeats bounded iterations within the supplied budget, with each
  outcome independently evaluated by the supervisor.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
Report evidence rather than grading your own result. Include changed paths and reproducible checks.
