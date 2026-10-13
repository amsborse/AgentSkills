# Visual design and UX

The goal is a more premium, consistent, accessible product **in the repository's own design
language**. Never impose a new aesthetic overnight.

## Before touching UI

1. Read the design system and UI workflow docs named in the policy (`ui.references`, docs such
   as `DESIGN_SYSTEM.md`, `UI_QUALITY_WORKFLOW.md`) and any repo design skill (for example a
   `*-design` skill under `.agents/skills`). Use its tokens, type scale, spacing and motion
   rules. If an installed design skill applies (impeccable, emil-design-eng, apple-design),
   use it as a lens, but the repository's system wins on conflict.
2. Identify the approved reference images for the screens you will touch.

## Good overnight UI candidates

- Inconsistencies: one-off colors/spacing/radii that should use tokens; mismatched states.
- Missing states: loading, empty, error, long-content, offline. Use worst-case data.
- Accessibility: contrast, focus visibility, keyboard paths, labels, `prefers-reduced-motion`,
  hit targets, semantic landmarks. These are always in scope.
- Feedback: actions without acknowledgement, silent failures, unclear next steps.
- Motion: purposeful transitions on state change (150-300 ms, ease-out for entrances), springs
  for direct manipulation; never animate layout-thrashing properties; respect reduced motion.
- WebGL/Three.js only where the product already uses it or the design system calls for a hero
  moment, lazily loaded, with a static fallback and a measured frame budget. Never on a data
  screen.

## Evidence (required before `accept`)

```sh
$EVOLVE screenshot --candidate <id> --page <name> --serve     # 1440x900, compared to its reference
```

- Capture each touched page at 1440×900 (the policy viewport). With a `reference`, the engine
  writes a diff image and `diffRatio`. Intentional changes will differ: explain each difference
  in `--evidence`. Unexplained diffs elsewhere on the page are regressions.
- Capture before and after if the screen has no approved reference (run the screenshot on the
  base first, then after your commits).
- Check console errors (`pageErrors`) and paint timings in the capture output.
- For accessibility, run the repo's a11y tests if present (e.g. `@a11y` Playwright tags).

## Skip

Rebrands, palette changes, new fonts, layout rewrites of approved screens, and anything the
design docs mark as decided. Record them as opportunities with screenshots instead.
