---
name: night-visual
description: Stage-aware visual polish loop. Lifts UI or HUD craft across themes and viewports with real before/after screenshots and audit guardrails. Use for "/night visual".
metadata:
  aliases: "night-visual, night visual, overnight visual polish"
  keywords: "night, loop, visual, ui, polish"
  composes: "improve-visuals, audit-design, revamp-ui, add-interactions, build-animation, verify"
  requires: "git, shell"
  risk: "medium"
  night-loop: "visual"
  night-writes: "code"
  night-minutes: "30"
  night-signals: "frontend, playwright, game"
---

# Night visual

One iteration elevates **one** evidenced visual weakness—layout hierarchy, typography, surface depth,
designed light/dark parity, tactile micro-interaction, or game HUD readability—using `improve-visuals`,
`audit-design`, `revamp-ui`, `add-interactions`, `build-animation` and `verify`. Read
`../night/references/loop-interface.md` and load `workflows/stage-playbook.md` to adapt to the
repository's stage and product mode.

## Activation

- Use when the repository renders a web interface, desktop/mobile view, or game canvas/HUD locally.
- Adapt to the detected repository stage (`workflows/stage-playbook.md`): fix structural overflow,
  broken contrast and missing theme tokens at `seed`/`prototype`; run rubric-scored craft upgrades
  and blind-pair checks at `mvp`/`production`.
- **Preserve loved designs:** never replace an aesthetic or hero element the owner already chose;
  expose bold visual directions as selectable variants/toggles (`shared/creative/design-variants.md`).

## Workflow

1. **Baseline:** Start the local app/preview without Docker when possible. Capture real before
   screenshots (`desktop 1440x900`, `mobile 390x844`, both light and dark themes where supported)
   and run `audit-design`'s `visual-audit.mjs` when Playwright is available.
2. **Choose one highest-payoff target:** Score the screenshots (never code alone) against
   `workflows/stage-playbook.md` and `~/agent-skills/working-agreements/ui-quality.md`. Pick the
   lowest-scoring visible region not yet addressed in the handoff.
3. **One coherent upgrade:** Extend existing design tokens/CSS variables first. Apply one bounded
   improvement—sharp typographic hierarchy, warm paper-like light surfaces, deep layered dark mode,
   compact single-action cards, HUD/menu contrast, or calm 60fps physical transitions (`prefers-reduced-motion`
   respected, offscreen work paused).
4. **Verify visually:** Capture matching after screenshots at identical viewports and themes. Run
   `visual-audit.mjs` (and `improve-visuals` `blind-pairs.mjs` when configured) to confirm zero new
   contrast, overflow, CLS or frame-rate regressions. Clean up temporary `.visual/` scratch files
   unless tracked by repo policy.
5. **Hand back:** Run fast runtime/unit checks and emit `NIGHT_RESULT` with exact commands and
   before/after metrics. Never weaken assertions.

## Evaluation

- Keep: Real before/after screenshots demonstrate a clear craft gain, both themes and mobile/desktop
  viewports hold cleanly, `prefers-reduced-motion` works, and all checks stay green.
- Revert: Any theme/viewport regression, washed-out contrast, unbacked translucent chrome, gimmick
  animation, layout shift, or code-only edit with no visible pixel improvement.
- Inconclusive: Page/canvas could not be rendered locally to capture real screenshots.

## Stop conditions

- Every primary route/screen reaches high craft across themes and viewports with zero visual-audit
  blockers/majors, or two consecutive iterations show no clear visual improvement.
- Rendering requires external credentials or unavailable infrastructure (record exact blocker once).

## Examples

- Day: "run night-visual on the billing settings page" upgrades hierarchy, card density and theme
  parity with before/after screenshots.
- Night: `/night visual` or `/night polish` iterates across key screens and viewports overnight.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
