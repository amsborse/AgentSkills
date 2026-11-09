---
name: fix-bug
description: Find and fix a bug — reproduce it on the real target, find the root cause, write a failing regression test, fix, and confirm the fix where the user saw the bug. Use for errors, crashes, failing tests or CI, wrong behavior, "this is broken", "still broken" or "I still see the old one".
metadata:
  aliases: "fix this bug, find and fix, debug this, it is broken, still broken, not working, failing test, fix ci"
  keywords: "bug, fix, debug, error, broken, failing, crash, exception, stack trace, regression, flaky"
  composes: "verify, test-everything"
  requires: "shell"
  risk: "medium"
---

# Fix a bug

1. **Reproduce first**, on the target where it was seen (page, device, CLI, CI log). When the
   user says it is still broken, do not restate the earlier fix: reproduce it again. If you cannot
   reproduce, say so and list what you tried.
2. **Rule out a stale build** (old server, cache, unbuilt bundle, old extension) before reading code.
3. **Find the root cause.** Form one hypothesis at a time, check it with a log, a breakpoint or a
   minimal test, and keep going until the cause explains every symptom. Use `git log -p` / `git
   bisect` for regressions. Don't patch symptoms, and don't swallow errors to make them go away.
4. **Write the regression test** and watch it fail for the right reason.
5. **Fix** the cause with the smallest change. Never weaken a test or a check to get green.
6. **Confirm**: the test passes, the suite passes, and the `verify` skill shows the fix on the
   original target.
7. **Report** the cause in one sentence, the fix, and the evidence. Other bugs you noticed go in
   the report as follow-ups; don't fix them now.
