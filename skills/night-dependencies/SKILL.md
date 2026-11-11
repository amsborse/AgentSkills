---
name: night-dependencies
description: Dependency loop. Review advisories and update one package or lockstep group with the project package manager, favour patch and minor releases, and keep only a tested change with a consistent lockfile. Use for "night-dependencies", "night dependencies" or as /night dependencies.
metadata:
  aliases: "night-dependencies, night dependencies"
  keywords: "night, loop, dependencies"
  composes: "security-audit, test-everything"
  requires: "git, shell"
  risk: "high"
  night-loop: "dependencies, security"
  night-writes: "code"
  night-minutes: "25"
  night-signals: "deps"
---

# Night dependencies

One iteration tackles one bounded hypothesis, using `security-audit`, `test-everything`
for the craft. Read the shared contract in `../night/references/loop-interface.md`;
this skill supplies the target, evidence and stopping rules.

## Activation

- Use when dependency manifests and their package manager are available in the worktree.
- Never change registries or publish packages; dependency lockfile edits must be authorised by the task.
- Read the handoff first and avoid repeating a target already resolved by earlier iterations.

## Workflow

1. **Baseline:** Record installed versions and checks; run `npm audit` or `pip-audit` when available.
2. **Choose:** Use `security-audit` to choose one package or necessary lockstep group; prefer patch/minor.
3. **One change:** For a major, read its changelog and migration notes first; proceed only with green tests.
4. **Check:** Update with the project's own package manager and lockfile; run `test-everything` and advisories again.
5. **Hand back:** run fast checks and report evidence, including failed or unavailable commands.
   The supervisor re-runs checks and decides keep/revert; never weaken tests or assertions.

## Evaluation

- Keep: Tests stay green, the lockfile matches the manifest and the targeted version or advisory is resolved.
- Revert: New failures, incompatible peer requirements, unexplained lockfile churn or new advisory exposure.
- Inconclusive: missing evidence or unavailable checks cannot count as a successful iteration.
- Record baseline and candidate results with exact commands so the supervisor can repeat them.

## Stop conditions

- No safe update remains, advisory tools are unavailable for a security claim, or migration exceeds scope.
- Record unavailable advisory evidence as unknown and risky upgrades as owner decisions.
- Stop at the supplied time or iteration limit; report the next bounded hypothesis.

## Examples

- Day: "run night-dependencies on the HTTP client dependency" investigates one target with the owner watching.
- Night: `/night dependencies` repeats bounded iterations within the supplied budget, with each
  outcome independently evaluated by the supervisor.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
Report evidence rather than grading your own result. Include changed paths and reproducible checks.
