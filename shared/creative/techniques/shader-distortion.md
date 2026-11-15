# Shader distortions

A fragment shader bends an image, video or text: ripples on hover, liquid displacement,
noise warps, RGB split on transition. The GPU does the work per pixel.

**Ready-made recipe:** `../recipes/flow-hero/` (tiered, tested, with a demo). Start from it and adapt; see
`../recipes/README.md` for the contract and `demos/experience/` for it in a real page.

## Use when

- Portfolio, agency, art, music and brand pages where one striking media moment carries the
  identity (Persuade, intensity 3–4).
- Never on app screens, forms, data or anything people read closely.

## Options

- **SVG filter** (`feTurbulence` + `feDisplacementMap`) for a light warp with no WebGL; slow
  when animated over large areas.
- **OGL** plane with a custom fragment shader: the smallest WebGL option for one effect.
- **three.js `ShaderMaterial`** or R3F when three is already in the project or a scene exists.
- **PixiJS filters** (`DisplacementFilter`) for 2D canvas apps already on Pixi.
- Drive uniforms (time, pointer, progress) from one rAF loop; ease the pointer value.

## Dependencies

None for SVG filters. OGL (Unlicense, ~30 kB) for a standalone effect; three only if present
or a 3D scene is planned (see `../selector.md`). One WebGL engine per page.

## Accessibility

The undistorted image or text exists in the DOM (real `<img alt>` or text, canvas is
`aria-hidden`). Distortion never hides content permanently. No rapid flashing.

## Performance

High. Cap DPR at 2, size the canvas to the element, render only while visible and while the
effect is moving (stop the loop when settled), handle `webglcontextlost`. Test on a mid-range
phone or with CPU throttling.

## Compatibility

WebGL 1/2 everywhere modern; provide the plain image when context creation fails. SVG filter
performance varies widely (Safari slower).

## Reduced motion

Show the plain image or text, no animated distortion. A static, subtle treatment is fine.

## Verify

- Screenshot with WebGL disabled or failing: plain media still shows.
- `visual-audit`: offscreen and idle render checks show no frames when the effect is out of
  view or at rest; no long frames on hover.
- Reduced motion: static.
