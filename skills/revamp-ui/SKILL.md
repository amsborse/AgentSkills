---
name: revamp-ui
description: Revamp, redesign or polish an existing UI (site, app, dashboard) to a premium bar that fits the product: pick a direction, fix spacing, color, type, layout, visuals and motion, verify with real screenshots. Optional style add-ons (cinematic, clay, glass). Includes unslop. Use for "revamp this app", "make it feel premium", "unslop" or "redesign".
metadata:
  aliases: "revamp ui, revamp my website, revamp this, revamp the app, redesign, redesign the ui, unslop, polish the ui, make it look premium, feel premium, looks ai generated, design concepts, match this design, claymorphism, clay ui, glassmorphism, glass ui, cinematic ui"
  keywords: "ui, ux, design, premium, interface, application, app, website, landing page, dashboard, layout, typography, color, theme, dark mode, light mode, visual, polish, css, tailwind, clay, glass, neumorphism, style add-on"
  composes: "verify, build-animation, coordinate-agents, audit-design, replicate-design, add-interactions, create-visuals"
  requires: "browser, image-generation?, codex-bridge?"
  risk: "medium"
---

# Revamp a UI

The bar is the UI taste section of `~/agent-skills/working-agreements/AGENTS.md`, with details and
anti-patterns in `~/agent-skills/working-agreements/ui-quality.md`. A repository's design system
wins on specifics. Never replace a design the owner liked: add the new one as an option or toggle.
New pages reuse the existing components and CSS; no new design language or UI library. (high)
Adapt to the product, never to a house style: `~/agent-skills/shared/creative/adaptation.md`
says how to read purpose, users, brand and mode, and never to default to 3D, gradients, glass,
clay or cinematic. Load technique files from `~/agent-skills/shared/creative/README.md` only
when a pass needs one.

Before building a component, interaction or effect, search Arsenal and reuse what fits; register
what you build there (`~/agent-skills/shared/creative/arsenal.md`). Extra selectable designs
follow `~/agent-skills/shared/creative/design-variants.md`.

UI implementation is Codex's work by default (`~/agent-skills/shared/agent-routing.md`): hand
isolated components, pages and assets to Codex through the `coordinate-agents` skill, keep the
direction, review and verification yourself, and fall back to Antigravity, then yourself, when
Codex reports `quotaExhausted`.

## Size it

- **Polish** (one screen, "clean this up"): screenshot it, then run the audit and passes from
  `workflows/unslop/unslop.md` for that screen only, then verify.
- **Audit only** ("what's wrong with this UI"): use the `audit-design` skill (measured runner
  plus P0–P3 critique) and stop. For a second opinion, use the review mode in
  `workflows/codex-visual.md`.
- **Full revamp** (site or app): the steps below.
- **Reference site or video to reproduce:** the `replicate-design` skill.
- **Reference image of a cinematic scene:** match it closely with the `build-animation` skill
  (cinematic-plate workflow).

## Full revamp

1. **Capture the current state:** run the `audit-design` runner into `.visual/before`
   (screenshots at desktop, tablet and mobile, light and dark, plus measured defects;
   `~/agent-skills/shared/creative/visual-loop.md`). Note what the owner liked so you keep it.
2. **Direction:** derive it from the product (the "Direction" section of unslop). For open-ended
   briefs, get 2–3 concepts with `workflows/codex-visual.md` (concepts mode) and pick one, or ask
   once with numbered options. Then attach a **style add-on** if one fits (cinematic, clay or
   glass): read `~/agent-skills/styles/README.md` and the chosen add-on, and record the choice.
3. **Tokens first:** spacing scale, color (one accent), type scale, radii and shadows for both
   themes, in the project's existing token file.
4. **Passes in order:** spacing, color, icons, copy, type, layout, details, visuals, motion (each
   described in `workflows/unslop/unslop.md`). One signature living visual per product, blended
   into the page; use `build-animation` for its motion. Charts and visuals show only real data:
   no invented values, trends or targets, no distorted scales, no implied results that are not
   proven. (high) Essential information and actions never depend on hover. (high) Loading and
   no-data views show a clear processing or empty state, never a blank dashboard. (high)
5. **Hero and illustration assets:** an image tool when one is available (Codex image mode). Never
   present a placeholder as final; without an image tool, say so and leave a clearly marked slot.
6. **Verify:** the browser loop in `~/agent-skills/shared/creative/visual-loop.md`: runner into
   `.visual/after`, compared side by side with the before set, hover, keyboard and reduced
   motion checked. Iterate until every blocker and major is gone and it meets the bar.
7. **Report** before and after screenshot paths and what changed; open decisions as numbered
   options.
