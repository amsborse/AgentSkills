# Environmental lighting

The page has a light environment: soft pools of light, ambient gradients, shadows that agree
on a light direction, glow that responds to time, scroll or the active section.

**Ready-made recipe:** `../recipes/flow-hero/` (tiered, tested, with a demo). Start from it and adapt; see
`../recipes/README.md` for the contract and `demos/experience/` for it in a real page.

## Use when

- Dark themes that should feel deep and layered instead of flat; product heroes; immersive
  sections. Light themes use soft shadows and warm surfaces instead of glow.
- Keep one consistent light direction across the page.

## Options

- **CSS:** layered `radial-gradient` backgrounds, `box-shadow` stacks that share one offset
  direction, `color-mix()` for tinted shadows, `@property` to animate gradient positions.
- **Section-reactive:** change custom properties (light color, position) per section with
  IntersectionObserver or `animation-timeline: view()`.
- **Pointer-driven:** see `cursor-light.md`.
- **3D:** environment maps (HDRI) and physically based lights in three/R3F; bake lighting where
  possible.
- Add subtle grain (an SVG noise overlay at low opacity) to prevent gradient banding.

## Dependencies

None for CSS. Three only with an existing 3D scene; HDRIs must be licensed (CC0 sources).

## Accessibility

Text contrast is measured on the brightest and darkest part of the gradient behind it.
Lighting carries no information.

## Performance

Low for static CSS; animated large gradients and `filter: blur()` on big layers repaint
expensively: animate `transform` or `opacity` of a gradient layer instead.

## Compatibility

All modern browsers; `@property` and `color-mix()` are Baseline. Provide a solid fallback
color.

## Reduced motion

Lighting stays, but static; no drifting or section-based color animation.

## Verify

- Screenshots in both themes: dark is layered (not flat black), light is designed (not
  inverted), shadows agree on direction.
- `visual-audit` contrast check over gradients; idle check shows no constant repaint.
