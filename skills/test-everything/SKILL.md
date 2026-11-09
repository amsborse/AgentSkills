---
name: test-everything
description: Plan, write and run tests across the stack — unit, integration, end-to-end and visual — find the gaps that matter, fix flaky tests at the cause, and report real results. Use for "test everything", "add tests", "improve test coverage", "set up e2e tests", a test strategy, or when a change needs proof beyond reading the code.
metadata:
  aliases: "test everything, write tests, add tests, test coverage, improve coverage, run all tests, e2e tests, test strategy"
  keywords: "test, tests, testing, coverage, unit, integration, e2e, playwright, vitest, jest, pytest, flaky, snapshot"
  composes: "verify, fix-bug"
  requires: "shell, browser?"
  risk: "medium"
---

# Test everything

Rules: tests reach state through production code paths, and critical runtime behavior has at
least one test against the real runtime. Never weaken an assertion or timeout to go green. No
paid API calls in tests: use fakes or recorded fixtures.

## Size it

- **One change:** test the new behavior and its edge cases next to the existing tests, then run
  the suite.
- **Coverage push or strategy:** the steps below.

## Steps

1. **Inventory:** the test runners, commands, CI config, and what is covered today (coverage report
   if available). Run the full suite once and record the baseline: pass, fail and skip counts.
2. **Risk map:** list the critical paths (auth, money, data writes, sync, the main user flow) and
   the most-changed files without tests. Those come first, not the easy targets.
3. **Write tests** in the project's existing style and framework. No new framework without
   approval. Each test asserts behavior, not implementation details.
4. **End-to-end and visual:** cover the main user flow in a real browser (Playwright), at the
   viewports the user cares about, in both themes for UI.
5. **Flaky tests:** reproduce with repeated runs, fix the race or shared state; never just add
   retries or sleeps.
6. **Report** the before and after counts from real runs, what is covered now, and the remaining
   gaps ranked by risk. Failing tests are reported as failing.
