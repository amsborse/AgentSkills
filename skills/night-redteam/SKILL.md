---
name: night-redteam
description: Red-team loop. Prove one exploitable trust-boundary failure only with a local failing test, then repair its root cause or record an owner decision when no safe fix fits. Use for "night-redteam", "night redteam" or as /night redteam.
metadata:
  aliases: "night-redteam, night redteam"
  keywords: "night, loop, redteam"
  composes: "security-audit, fix-bug, test-everything"
  requires: "git, shell"
  risk: "high"
  night-loop: "redteam, security"
  night-writes: "code"
  night-minutes: "30"
  night-signals: "backend, frontend, deps"
---

# Night redteam

One iteration tackles one bounded hypothesis, using `security-audit`, `fix-bug`, `test-everything`
for the craft. Read the shared contract in `../night/references/loop-interface.md`;
this skill supplies the target, evidence and stopping rules.

## Activation

- Use for authorised inspection of the repository's own code and safe local fixtures.
- Never target real services or third parties; a proof-of-concept is only a local failing test.
- Read the handoff first and avoid repeating a target resolved by earlier iterations.

## Workflow

1. **Baseline:** Use `security-audit` to trace injection, authz, secrets, SSRF and path traversal boundaries.
2. **Choose:** Select one reachable attack path; describe the expected denial without exposing secret values.
3. **One change:** Write a failing regression through production paths with inert payloads and fake services.
4. **Check:** Use `fix-bug` for one root-cause repair and `test-everything` to check denial and valid access.
5. **Hand back:** run fast checks and report evidence, including unavailable or failed commands.
   The supervisor re-runs checks and decides keep/revert; never weaken tests or assertions.

## Evaluation

- Keep: The exploit test fails before the fix, passes after it and legitimate operations still pass.
- Revert: The attack remains reachable, controls weaken or reproduction requires external targeting.
- Inconclusive: missing evidence or unavailable checks cannot count as a successful iteration.
- Record baseline and candidate results with exact commands for the supervisor to repeat.

## Stop conditions

- High-risk findings without a safe bounded fix become owner decisions with local evidence.
- No locally provable attack remains, or safe reproduction is unavailable.
- Stop at the supplied time or iteration limit; report the next bounded hypothesis.

## Examples

- Day: "run night-redteam on the upload path boundary" investigates one target with the owner watching.
- Night: `/night redteam` repeats bounded iterations within the supplied budget, with each
  outcome independently evaluated by the supervisor.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
Report evidence rather than grading your own result. Include changed paths and reproducible checks.
