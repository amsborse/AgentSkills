---
name: night-tests
description: Polyglot test-coverage loop. Adds one focused behavioral or characterization test per iteration across Node, Python, Rust, Go, .NET or Swift, proving it catches breaks. Use for "/night tests".
metadata:
  aliases: "night-tests, night tests, test loop, add tests overnight, coverage loop"
  keywords: "night, loop, tests, coverage, regression, unit, integration, characterization"
  composes: "test-everything, fix-bug"
  requires: "git, shell"
  risk: "low"
  night-loop: "tests"
  night-writes: "code"
  night-minutes: "20"
  night-signals: "no-tests, has-tests, failing-tests"
  night-keep: "tests-up"
---

# Night tests

One iteration adds **one** meaningful behavioral or characterization test in the repository's native
stack (`node:test`/Vitest/Jest, `pytest`/`unittest`, `cargo test`, `go test`, `dotnet test`,
`swift test`), using `test-everything`. Shared contract: `../night/references/loop-interface.md`.

## Activation

- Use when a repository has untested critical paths, thin edge-case coverage, or is at `seed`/`prototype`
  stage needing its first smoke tests (run `night bootstrap` first if `.night/config.yaml` has no
  evaluation command yet).
- Do **not** use to repair already-failing baseline tests; hand red baselines to `night-bug-hunter`.

## Workflow

1. **Baseline & stage:** Read baseline pass/fail counts and repo stage (`seed` -> entry-point smoke
   characterization; `mvp` -> auth, billing, money, data mutations, game state rules; `production` ->
   concurrency, boundary invariants, failure recovery). Skip targets already covered in the handoff.
2. **Pick one high-risk target:** Rank untested modules by blast radius, git churn, and complexity.
3. **Write real production-path tests:** Exercise real modules/routes/reducers with deterministic
   local fixtures—never trivial `assert(true)` placeholders or tautological mocks.
4. **Prove it bites:** Temporarily mutate the production branch/condition under test, run the test to
   confirm it fails for the right reason, restore the production code cleanly, and confirm green.
5. **Hand back:** Run the full fast suite and emit `NIGHT_RESULT` with pass-count delta and next target.

## Evaluation

- Keep: Passed-test count increases (`tests-up`), failed/skipped counts do not rise, zero existing
  assertions are removed, and repeated runs show zero flakiness.
- Revert: Any regression, flaky timing dependency, skipped test, or test-script tampering.
- Inconclusive: No test runner is configured or installed.

## Stop conditions

- High-risk behavioral paths are covered, or 3 consecutive candidates only touch trivial getters/constants.
- Baseline suite is red (yield to `night-bug-hunter`) or environment lacks the test runtime.

## Examples

- Day: "run night-tests on `src/billing`" covers edge cases one verified commit at a time.
- Night: `/night tests` grows behavioral coverage overnight with before/after pass counts.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
