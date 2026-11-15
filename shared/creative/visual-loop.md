# Browser-based visual loop and quality gates

Every substantial visual change (new screen, redesign, new animation or interaction, 3D scene)
runs this loop in a real browser. Code review alone never establishes visual quality.

```text
Inspect → Design → Implement → Render → Capture → Critique → Improve → Verify
```

1. **Inspect.** Run the app (dev server or static file). Capture the *before* set with the
   audit runner, which also records existing defects:

   ```bash
   node ~/agent-skills/skills/audit-design/scripts/visual-audit.mjs \
     --url http://localhost:3000 --out .visual/before
   ```

   Defaults: desktop 1440×900, tablet 834×1112, mobile 390×844, light and dark. Playwright is
   resolved from the project (`--project DIR`); without it, the runner exits 2 and says so.
2. **Design.** Direction from `adaptation.md`, technology from `selector.md`, techniques from
   `README.md`. Write the 3–5 line direction note.
3. **Implement.** In the existing framework and components. Large isolated parts go to Codex
   (`codex-orchestration.md`).
4. **Render.** Reload the running app; kill stale servers on the port first.
5. **Capture.** Run the runner again with `--out .visual/after`. For motion, also capture
   frames at start, middle and end (Playwright `page.clock` or the screencast) when the change
   is an animation.
6. **Critique.** Look at the screenshots yourself (read the PNGs), then the report. Taste,
   hierarchy and brand fit need eyes; the runner only measures. Rank what you see: P0 broken,
   P1 wrong, P2 weak, P3 polish. List the top 5–8 only.
7. **Improve.** Fix from the top of the list. One change per issue, re-render.
8. **Verify.** The runner reports no blocker or major finding, every P0/P1 is fixed, and the
   before/after pairs show the intended improvement. Report the after folder path, the summary
   line and any remaining findings honestly.

The `.visual/` folder is a working area; add it to `.gitignore` if the project lacks it.

## What the runner checks (and what it does not)

Measured per viewport and theme: load and console errors, blank render, horizontal overflow,
text contrast (WCAG AA, composited backgrounds; unknown over images and filters), tap targets
under 24 px, broken images and missing alt, layout shift, long animation frames, axe-core
violations when the project has `axe-core`. Per viewport: idle and offscreen
`requestAnimationFrame` rate, hover feedback and hover layout shift, visible keyboard focus,
reduced-motion behaviour (rAF and infinite CSS animations). Across themes: whether dark mode
changes anything.

Not measured: taste, brand fit, hierarchy, copy, hidden-tab pausing (unreliable headless),
motion smoothness by eye. Those stay in the critique step and in the report as unchecked.

## Performance: the experience bench

When a change adds motion, 3D, heavy imagery or script, measure it too. Before the change:
`visual-audit.mjs --perf --url … --save-baseline .visual/bench/baseline.json`; after it, the
same flags with `--baseline`. The bench runs each condition (viewport, theme, CPU slowdown,
motion preference, quality tier) several times and reports medians with their range: Core Web
Vitals, frame pacing, long tasks, heap growth and bytes. A verdict is `improved`, `regressed`,
`no measurable change` or `unknown`; only the first is evidence of a gain. It is lab data from
one machine, not what visitors experience. Details:
`~/agent-skills/skills/audit-design/references/experience-bench.md`.

## Quality gates

A change is done only when all of these hold, each backed by a screenshot or a runner finding:

| Gate | Evidence |
|---|---|
| Consistent design language (tokens, type, components reused) | Screens side by side |
| Clear hierarchy; first screen answers the main question | Desktop and mobile first-screen shots |
| Strong typography (one scale, measure, rhythm) | Shots; no clipped or overflowing text |
| Intentional motion (each animation has a reason, calm, no snaps) | Frame captures; direction note |
| Polished states: hover, focus-visible, active, disabled, loading, empty, error | Runner hover and keyboard checks, shots |
| Responsive at all three widths, no horizontal scroll | Runner overflow check |
| Keyboard accessible, visible focus | Runner keyboard check |
| Reduced motion respected (reduce, not remove) | Runner reduced-motion check and shot |
| No needless continuous rendering (idle and offscreen) | Runner idle and offscreen rAF rates |
| Efficient assets and shaders (DPR ≤ 2, compressed media, lazy heavy code) | Network panel or bundle report |
| No regressions | Project tests pass; before/after pairs |

Reject generic AI aesthetics (see `adaptation.md`) unless the user asked for them, and remove
visual complexity that has no stated purpose.

## Recording results

After the loop, append one line per notable defect or success to the creative ledger
(`learning.md`) so the skills can improve from real outcomes.
