---
name: revamp-ui
description: Revamp, redesign, polish or audit a UI (website, app, dashboard, landing page) to the owner's premium bar. It audits, picks a direction, fixes spacing, color, type, layout, details, visuals and motion, generates hero visuals when an image tool exists, and verifies with real screenshots in both themes. Scales from a quick polish to a full redesign with Codex concepts. Attaches a style add-on (cinematic, claymorphism, glassmorphism) on top of the general method. Includes unslop (remove AI-looking UI tells) and visual review against a reference. Use for "revamp my website UI", "make it look premium", "make it claymorphic/glassy/cinematic", "unslop", "redesign", "UI audit" or "match this reference".
metadata:
  aliases: "revamp ui, revamp my website, redesign, redesign the ui, unslop, polish the ui, make it look premium, looks ai generated, ui audit, design concepts, match this design, claymorphism, clay ui, glassmorphism, glass ui, cinematic ui"
  keywords: "ui, ux, design, website, landing page, dashboard, layout, typography, color, theme, dark mode, light mode, visual, polish, css, tailwind, clay, glass, neumorphism, style add-on"
  composes: "verify, build-animation, coordinate-agents"
  requires: "browser, image-generation?, codex-bridge?"
  risk: "medium"
---

# Revamp a UI

The bar is the UI taste section of `~/agent-skills/working-agreements/AGENTS.md`, with details and
anti-patterns in `~/agent-skills/working-agreements/ui-quality.md`. A repository's design system
wins on specifics. Never replace a design the owner liked: add the new one as an option or toggle.
New pages reuse the existing components and CSS; no new design language or UI library. (high)

UI implementation is Codex's work by default (`~/agent-skills/shared/agent-routing.md`): hand
isolated components, pages and assets to Codex through the `coordinate-agents` skill, keep the
direction, review and verification yourself, and fall back to Antigravity, then yourself, when
Codex reports `quotaExhausted`.

## Size it

- **Polish** (one screen, "clean this up"): screenshot it, then run the audit and passes from
  `workflows/unslop/unslop.md` for that screen only, then verify.
- **Audit only** ("what's wrong with this UI"): screenshot both themes, list findings ranked by
  visual impact with the exact selector and property fix, and stop. For a second opinion, use
  the review mode in `workflows/codex-visual.md`.
- **Full revamp** (site or app): the steps below.
- **Reference image of a cinematic scene:** match it closely with the `build-animation` skill
  (cinematic-plate workflow).

## Full revamp

1. **Capture the current state:** real screenshots at 1440 and 390 wide, light and dark
   (`~/agent-skills/shared/browser.md`). Note what the owner liked so you keep it.
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
6. **Verify:** after-screenshots at the same widths and themes, compared side by side with the
   before set. Check contrast, reduced motion and layout shift. Iterate until it meets the bar.
7. **Report** before and after screenshot paths and what changed; open decisions as numbered
   options.
