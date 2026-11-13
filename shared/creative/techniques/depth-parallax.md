# Depth-aware parallax

Layers move at different rates with scroll or pointer so the scene reads as having depth.
"Depth-aware" means rates follow an intended depth order, not random speeds.

## Use when

- Hero scenes built from layers (foreground, subject, background), illustrations, landing
  storytelling.
- Not behind body text, and not on Operate surfaces.

## Options

- **Scroll, CSS:** `animation-timeline: view()` with a `translate` keyframe per layer, rate
  proportional to depth.
- **Scroll, JS:** one IntersectionObserver to activate, one rAF loop reading scroll progress,
  writing `translate3d` per layer; stop the loop when out of view.
- **Pointer:** layers offset by pointer position × depth factor (small, ±10–20 px for the
  nearest layer).
- **3D:** CSS `perspective` with `translateZ` layers, or a camera in three.js (`build-3d`).
- Depth from a single image: generate separate layers with `create-visuals`, or a depth map
  in a shader (`shader-distortion.md`).

## Dependencies

None for CSS or vanilla JS. GSAP ScrollTrigger only for long scrubbed sequences already using GSAP.

## Accessibility

Large parallax causes motion sickness; keep the movement subtle and tied to user input.
Content order in the DOM stays logical; layers are `aria-hidden` when decorative.

## Performance

Medium. Transform only; promote layers sparingly; no scroll listeners that read layout.
Large images need correct sizes and `decoding="async"`.

## Compatibility

CSS scroll-driven animations are Baseline only since late 2026: feature-detect with
`@supports (animation-timeline: view())`, fall back to the JS path or a static layout.

## Reduced motion

Static composition with layers in their resting position.

## Verify

- Scroll through at normal speed: no jitter, layers keep depth order, no gaps at edges.
- `visual-audit`: offscreen rAF 0, reduced-motion check clean, CLS unchanged.
- Frame captures at 0/50/100 % of the section.
