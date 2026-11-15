---
name: improve-visuals
description: Make an existing UI look better in rounds, judged blind on real screenshots, not on speed. Use for "improve the visuals" or "make it look better".
metadata:
  aliases: "improve visuals, improve-visuals explore, improve the visuals, look better, make it look better, make it prettier, better visuals, visual improvements, raise the visual quality, improve the design"
  keywords: "visual, visuals, look, beautiful, prettier, design, aesthetic, polish, typography, hierarchy, depth, craft, judge, rounds, screenshots"
  composes: "audit-design, revamp-ui, build-animation, add-interactions, create-visuals, review-changes, verify"
  requires: "browser, playwright"
  risk: "medium"
---

# Improve visuals

The job is a page that **looks** better, judged by eye on real screenshots. A round whose
changes cannot be seen in a screenshot or a frame capture did not improve the visuals, however
much faster or more compliant it made the page. Anything can be made better: a page that passes
every check still gets scored and still gets improvements. Stop on the budget or when a blind
judge stops preferring the changes, never because the runner says "pass".

How this differs from its neighbours: `audit-design` only reports; `revamp-ui` changes the
direction or redesigns; `night-visual` makes one change per unattended iteration; `improve`
handles code and performance. This skill keeps the current direction and raises its craft.

The bar is the UI taste section of `~/agent-skills/working-agreements/AGENTS.md` with details in
`~/agent-skills/working-agreements/ui-quality.md`; the repository's design system wins on
specifics. Read the product with `~/agent-skills/shared/creative/adaptation.md` so improvements
fit it rather than a house style.

Before building a component, interaction or effect, search Arsenal and reuse what fits; register
what you build there (`~/agent-skills/shared/creative/arsenal.md`). Extra selectable designs
follow `~/agent-skills/shared/creative/design-variants.md`.

## Explore (optional first round)

When the direction itself is in doubt, or the request is `improve-visuals explore` or
`/experience experiment`, run `workflows/explore.md` first: three prototypes forced apart on
named axes, judged blind and pairwise against the current design, then stop for the owner's
choice. Skip it when the direction is liked; the rounds below keep the direction.

## 0. Scope and keep-list

- Pages, viewports (default desktop 1440×900, mobile 390×844; add tablet for layout work),
  both themes, and the round budget (default 3).
- **Keep-list:** what the owner liked (repo memory, `AGENTS.md`, praise in git history or past
  sessions). Never replace it; a new treatment of a liked element is an option or toggle.
- Work on a branch or worktree; never on the default branch.

## 1. Capture the baseline

Run the `audit-design` runner into `.visual/r0` for screenshots and guardrail numbers. Also
capture each page section by section (first viewport, then each section or every viewport
height down the page), both themes, so small regions can be compared. Note the guardrail
numbers: runner blockers and majors, layout shift, idle frame rate, test results.

## 2. Score

Open the screenshots yourself and score every page on the ten dimensions in
`workflows/rubric.md` (0–5 with anchors), citing the screenshot for each score. Save the scores
as `.visual/scores/r0.json`. Scores come from pixels, never from reading code.

## 3. Pick the round's changes

Per page, pick the 3–5 changes with the largest visible payoff, starting from the lowest
scores. `workflows/ideas.md` is the lever bank for each dimension; use it when a dimension
feels "fine", because fine is a 3, not a 5. Write each change as one line: the region, what
looks wrong in the screenshot, the change, and the dimension it lifts.

Does not count as a visual change: performance work, refactors, test-only work, accessibility
fixes nobody can see. Do those only when a guardrail regressed, and log them separately.

## 4. Improve

- Use the project's tokens, components and CSS; extend the token file before adding one-off
  values. No new UI library, no new design language.
- One change per line from step 3, so each one can be kept or reverted alone. Commit per page
  or per change, staged by path.
- Route craft to the specialist skill: motion to `build-animation`, hover and press to
  `add-interactions`, illustrations and the signature visual to `create-visuals`. Hand large
  isolated implementation to Codex per `~/agent-skills/shared/agent-routing.md`.
- Real content only: no invented numbers, fake testimonials or placeholder images presented as
  final.

## 5. Judge blind

Capture the after set with the same runner settings into `.visual/rN`, then build blind pairs
so the judge cannot tell before from after:

```
node ~/agent-skills/skills/improve-visuals/scripts/blind-pairs.mjs pair --before .visual/r0 --after .visual/r1 --out .visual/judge/r1
```

The answer key lands next to the folder (`.visual/judge/r1.key.json`), never inside it. The
judge is independent of whoever made the changes: a fresh subagent that is given only the pairs
folder and `workflows/judge.md` (not your change list), or Codex
in the review mode of the `revamp-ui` skill's Codex visual workflow. Its verdicts go to
`.visual/judge/r1/verdicts.json`; then:

```
node ~/agent-skills/skills/improve-visuals/scripts/blind-pairs.mjs tally --pairs .visual/judge/r1 --verdicts .visual/judge/r1/verdicts.json
```

Keep a change when the pairs that show it prefer the after side. Rework or revert it when the
before side wins or the judge flags a regression. A missing verdict is unknown, never a win.

## 6. Guardrails

A visual win is kept only when the guardrails hold against the baseline: runner blockers and
majors not higher, layout shift and idle frame rate not worse, reduced motion respected, both
themes readable, project tests green. A visual win that breaks a guardrail is reworked, not
kept, and never kept by weakening a test.

## 7. Next round

Re-score from the new screenshots into `.visual/scores/rN.json` and pick again. A dimension that
reached 4 still has levers in `workflows/ideas.md`. Stop when the budget is spent, or when two
rounds in a row win no pairs; list the next ideas in the report either way.

## Report

Lead with the result: rubric scores per page from r0 to the last round, how many pairs the
after side won, and the guardrail numbers before and after. Publish the before/after comparison
(both themes, section by section, from the real screenshots) as a page via `review-changes`,
list the changes kept and the ones reverted with the judge's reason, and offer the next ideas as
numbered options. Never claim a visual improvement without the screenshot pair that shows it.
