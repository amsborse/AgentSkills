# Explore: three directions

Use when the direction itself is in question, before polishing anything. Three prototypes that
really differ are built cheaply, compared on evidence, and the owner picks. Reached as
`improve-visuals explore` or `/experience experiment`.

This produces prototypes, not a redesign. Applying a chosen direction to the product is a
separate step (`revamp-ui`) and needs the owner's choice first.

## 1. Fix what stays the same

From `shared/creative/adaptation.md`: purpose, users, surface mode, brand marks, content and
the keep-list. All three directions share these, the same real content and the same screen (the
first viewport of the most important page, plus one interaction). Capture the current screen as
`current`: it is always the fourth candidate, and "keep what we have" is a valid result.

## 2. Force the directions apart

Each direction takes a position on every axis. No two directions may share a position on more
than two axes; if they do, change one until they do not.

| Axis | Positions |
|---|---|
| Type voice | Neutral grotesque / editorial serif / technical mono or condensed / expressive display |
| Colour temperature | Cool / warm / neutral with one accent |
| Value | Light-first / dark-first |
| Density | Dense / balanced / airy |
| Shape | Sharp / soft / mixed with one rule |
| Depth | Flat with lines / layered shadows / light and glow |
| Motion | State changes only / calm choreography / one cinematic moment |
| Signature visual | None / typographic / illustrative / living (shader, canvas) |

Surface mode limits the range: an Operate product does not get a cinematic direction, so its
three differ more on type, density and depth. One direction should be the closest honest
improvement of the current design, so the comparison includes a low-risk option.

## 3. Direction cards

One card per direction, written before any code, saved as `.visual/explore/<name>/card.md`:

```
Name: two words, no style labels borrowed from other products
Idea: one sentence a person would repeat
Axes: one position per axis from the table
Tokens: background, surface, text, accent (hex), type families, radius, spacing unit
Signature: the one thing people remember, and its still fallback
Interaction: the one interaction that is prototyped
Recipes: from shared/creative/recipes, with the tier it should hold
Risks: what could make this wrong for these users
```

Read the three cards side by side. If a stranger could not tell which card produced which
screen, the directions are too close: go back to step 2.

## 4. Build

- One worktree or one folder per direction; never the default branch, never the live page.
- Same content, same screen, both themes if the product has both.
- Bounded: the first viewport and the one interaction. No second page, no refactors.
- Independent builds can go to subagents or Codex (`shared/creative/codex-orchestration.md`),
  one direction each, given only its card and the fixed content so they do not converge.
- Continuous effects use the quality runtime and must hold their still fallback.

## 5. Compare

1. Capture every candidate, `current` included, with the same `audit-design` runner settings
   into `.visual/explore/<name>/shots`, and bench each with `--perf`.
2. Judge blind and pairwise with `scripts/blind-pairs.mjs pair`: every candidate against every
   other, including `current`. Sides are randomised per pair by the seed; run each comparison
   with two different seeds so a preference that follows the side rather than the design shows
   up. The judge is a fresh agent that sees only the pairs and `judge.md`, never the cards.
3. Check each prototype by keyboard, by touch emulation and with reduced motion.
4. A direction that breaks a guardrail (contrast, layout shift, frame pacing, reduced motion)
   is marked as such next to its result; it is not hidden and not silently dropped.

## 6. Present and stop

Show the owner, on one page (`review-changes`): the four screenshots at the same size in both
themes, each card's one-line idea, pairwise wins per candidate, bench numbers, guardrail
failures and what was not validated. Offer numbered options: each direction, "keep the current
design", and "combine" (naming which parts). A missing verdict is unknown, never a win.

Then stop. Nothing is applied to the product until the owner picks. After the pick, the chosen
direction's card becomes the brief for `revamp-ui`, and the other prototypes stay in
`.visual/explore/` for reference.
