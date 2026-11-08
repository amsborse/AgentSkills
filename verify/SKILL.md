---
name: verify
description: Verify a change where the user actually looks at it (local browser, Vercel/production URL, LG TV, Windows desktop app, Chrome extension) and report pass/fail with real evidence. Use when the user runs /verify, says something is "still broken" / "I still see the old one", or before claiming a UI or runtime fix is done.
---

# /verify

Done means checked on the target the user uses, with evidence. Never report a pass from code
reading, mocks, class names or a generated image.

## Steps

1. **Find the target.** Look in this order and stop at the first hit:
   - the user's request (e.g. "on the TV", "on Vercel", "locally");
   - a `verify target` note in the project memory or CLAUDE.md;
   - the project's scripts and docs (package.json, README, AGENTS.md, deploy scripts).

   If it is still unclear, ask once with numbered options (e.g. `1. local dev  2. Vercel preview
   3. TV`). Save the answer and the exact run/screenshot commands as a project memory named
   `verify-target` so the next /verify does not ask again.
2. **Make sure the target runs the new code.** Rebuild, restart the dev server, redeploy only if
   the user already asked for a deploy, clear caches or reinstall the app/extension. A stale
   build is the most common cause of "still broken".
3. **Run the cheap checks first:** typecheck, lint, the relevant tests. Fix failures before going
   further.
4. **Exercise the change on the target** the way the user would: the page, flow, device or
   command they named. Web: Playwright (headless is fine) at the user's viewport, both themes
   when the change is visual. Desktop/TV: launch the real app and capture a real screenshot
   using the commands in the `verify-target` memory.
5. **Compare against the request** (and the reference image, if one was given). If it does not
   match, fix and go back to step 2. Do not stop after one pass.
6. **Report in 2–5 sentences:** pass/fail, where it was checked, the screenshot path, and
   anything not verified. A failed or unverifiable check is reported as exactly that.
