# Organic masks

Non-rectangular, soft or blob-shaped masks that reveal images, video or sections, or that
blend a visual into the page instead of boxing it.

## Use when

- Blending a signature visual into the page (the owner's "no boxed canvas" rule).
- Reveals with a softer, more natural character than a wipe.
- Not as decoration on every card.

## Options

- **CSS `mask-image`:** radial or linear gradients for soft edges; an SVG shape for blobs.
- **SVG `<clipPath>` / `<mask>`** with an animated path (morph with SMIL-free JS, GSAP
  MorphSVG, or interpolating paths with equal point counts).
- **`clip-path: path()`** / `shape()` (newer; feature-detect) for hard organic edges.
- **Shader mask** with noise for liquid edges when WebGL is already on the page.

## Dependencies

None for CSS/SVG. GSAP for path morphing only if already present.

## Accessibility

Masked content that carries meaning must stay fully visible at rest. Do not mask text into
illegibility; check contrast where the mask fades.

## Performance

Low for static masks. Animated masks repaint the masked area every frame: keep areas small,
animate `mask-position`/`mask-size` rather than regenerating paths, avoid huge blurred masks.

## Compatibility

`mask-image` is Baseline (unprefixed since 2023). `clip-path: shape()` is newer: feature-detect.
SVG masks work everywhere.

## Reduced motion

Show the final masked state with no morph; a short opacity fade is fine.

## Verify

- Screenshots in both themes: edges blend with the page background, no visible box seams.
- Resize across widths: mask scales with the content.
- `visual-audit` reduced-motion check clean.
