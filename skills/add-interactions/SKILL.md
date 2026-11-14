---
name: add-interactions
description: Add hover, press, drag and pointer interactions that fit the product (magnetic hover, cursor light, tilt, springs, drag) with keyboard parity, touch fallbacks and reduced motion, browser-verified. Use for "add hover interactions" or "micro-interactions".
metadata:
  aliases: "add interactions, hover interactions, add hover interactions, micro-interactions, micro interactions, make it interactive, make it feel interactive, magnetic button, magnetic hover, cursor effect, tilt effect, drag interaction, press feedback"
  keywords: "interaction, hover, pointer, cursor, magnetic, tilt, drag, spring, press, feedback, touch, keyboard, focus"
  composes: "build-animation, audit-design, verify"
  requires: "browser"
  risk: "low"
---

# Add interactions

Interactions confirm actions and invite exploration; they never carry information alone.
Every pointer effect has a keyboard (`:focus-visible`) equivalent and a touch fallback, and
none shifts layout. For simple card and tile hovers, the hover-affordance workflow in
`build-animation` is enough; this skill covers the richer techniques.

Before building a component, interaction or effect, search Arsenal and reuse what fits; register
what you build there (`~/agent-skills/shared/creative/arsenal.md`). Extra selectable designs
follow `~/agent-skills/shared/creative/design-variants.md`.

## Steps

1. **Fit:** read `~/agent-skills/shared/creative/adaptation.md` for the product's mode and
   motion intensity (0–4). Operate surfaces get subtle feedback; Persuade surfaces can carry
   one expressive effect. Pick at most two techniques per page.
2. **Choose techniques** from `~/agent-skills/shared/creative/README.md` and load only those
   files, for example:
   - `shared/creative/techniques/magnetic-hover.md`
   - `shared/creative/techniques/cursor-light.md`
   - `shared/creative/techniques/interactive-tilt.md`
   - `shared/creative/techniques/spring-feedback.md`
   - `shared/creative/techniques/drag-interactions.md`
3. **Technology:** the simplest option in `~/agent-skills/shared/creative/selector.md`
   (CSS and Pointer Events first); reuse the project's motion library, never add a second.
4. **Implement** behind `(hover: hover) and (pointer: fine)` for pointer-only effects, with
   reduced motion handled as each technique file says ("reduce, don't remove").
5. **Verify** with `~/agent-skills/shared/creative/visual-loop.md`: hover and focus states
   screenshotted, keyboard path walked, touch viewport checked, and the `audit-design` runner
   clean on hover side effects, focus and reduced motion.

## Report

Which techniques went where, screenshot paths of the states, runner result, and anything
left unverified (for example real touch hardware).
