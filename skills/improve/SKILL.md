---
name: improve
description: Audit a project or area for improvements, rank them, implement the safe ones and verify them in one pass, then list the rest as numbered options. Also covers behavior-preserving refactors and measured performance work. Use when the user runs /improve [area], asks "what can be improved" (and would otherwise follow up with "implement all"), or asks to refactor, clean up or speed something up.
metadata:
  aliases: "what can be improved, improve this, refactor, clean up the code, optimize performance, make it faster, simplify this"
  keywords: "improve, refactor, cleanup, performance, optimize, simplify, tech debt, quality, speed"
  composes: "verify, test-everything, review-code"
  requires: "shell"
  risk: "medium"
---

# Improve [area] (also /improve)

Replaces the "what can be improved?" → "implement all" round trip with one run.

## Modes

- **Open audit** ("what can be improved"): all steps below.
- **Refactor or clean up:** behavior must not change. Run the tests first; if coverage of the area
  is thin, add characterization tests before moving code (`test-everything`). Small steps, tests
  green after each.
- **Performance:** measure first (profiler, Lighthouse, benchmark, query plan) and record the
  baseline; change one thing at a time and report before and after numbers from real runs.

## Steps

1. **Scope.** Use the given area, or the part of the project changed most recently (git log)
   if none. Read only what that area needs.
2. **Audit** for real, evidence-backed issues: bugs and silent failures, UX/UI gaps against
   ~/agent-skills/working-agreements/ui-quality.md, performance, missing tests, dead code. No
   speculative rewrites.
3. **Rank** by impact vs. effort and sort into:
   - **Safe:** non-destructive, inside this repo, no new dependencies, no paid calls, no change
     to a design the user liked, no schema/data migration.
   - **Needs a decision:** anything else.
4. **Implement every Safe item**, one small commit-sized change at a time (commit only if the
   user asked for commits). Add a regression test for each bug fixed.
5. **Verify** with the `verify` skill on the real target. Anything that fails is reported as failed.
6. **Report in 2–5 sentences** what was improved and verified, then the "Needs a decision" items
   as a numbered list the user can answer with numbers ("do 2 and 4").
