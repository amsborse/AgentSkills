# Sample morning report

Real output, unedited except for the worktree path, from `night run tests` on a three-file JavaScript
repository. The agent was the deterministic fake in `tests/fixtures/night/fake-agent.mjs` with the
plan `js-test,js-test,break`: two iterations add a test each, then the agent keeps proposing a change
that breaks `mul`. That change is reverted twice and then blocked, and the two kept commits stay. No
model was called, so no tokens or cost were reported and the cost is shown as unknown.

---

## Night report: night-20261111T0308-7496

**done** (queue_empty) after 7.0s and 4 iteration(s): 2 change(s) kept as commits, 0 report(s), 2 attempt(s) not kept, 1 task(s) blocked.

Mode `tests`. Base a4bf8555 on main; run branch `night/2026-11-10-tests` at df987e21. Usage: no tokens reported, cost unknown (some agents do not report cost; no reported cost).

### Kept

- fc5fd461 night-tests: Test-coverage loop (confidence 0.7, fake)
  evidence: node-test: passed 1 -> 2
- df987e21 night-tests: Test-coverage loop (confidence 0.7, fake)
  evidence: node-test: passed 2 -> 3

### Not kept

- REVERT (verification_failed) night-tests: Test-coverage loop, attempt 1: node-test passed at baseline and now fails (exit 1); node-test: failures 0 -> 2; node-test: passed 3 -> 1
  patch: `.night/artifacts/night-20261111T0308-7496/t-390f43eb-1.patch`
- REVERT (verification_failed) night-tests: Test-coverage loop, attempt 2: node-test passed at baseline and now fails (exit 1); node-test: failures 0 -> 2; node-test: passed 3 -> 1
  patch: `.night/artifacts/night-20261111T0308-7496/t-390f43eb-2.patch`

### Needs you

- night-tests: Test-coverage loop: the same failure repeated (verification_failed)

### Failures by kind

- verification_failed: 2

### Checks

Baseline:
- node-test: pass [1 passed, 0 failed]

Run branch head:
- node-test: pass [3 passed, 0 failed]

### Next

The queue is empty.

### How to review

- `git log --oneline a4bf8555..night/2026-11-10-tests` lists the kept commits; each has Night-Run and Night-Task trailers.
- `git diff a4bf8555...night/2026-11-10-tests` shows the whole night. Merge or cherry-pick what you want; nothing was pushed.
- The run worktree is `../repo-night/night-20261111T0308-7496/run`; remove it with `git worktree remove` when done.
- Experiments: `.night/experiments.jsonl`; failures: `.night/failures.jsonl`; logs: `.night/logs/`.

### Unknown

- total cost (an agent did not report it)
