# Style add-on: cinematic

The page reads like a film. It has deep layered scenes, atmosphere, light that comes from inside
the picture, and chapters you move through. This is the style of the 2026-11 portfolio revamp.

## Material and tokens

- **Surfaces:** these are scenes, not cards. Use full-bleed plates with masked edges that fade
  into the page background (`mask-image` gradients top and bottom), so there is never a visible
  image edge.
- **Dark:** a deep tinted night (navy or ink, never `#000`) with pools of light from the scene's
  own sources (lanterns, horizon, screen glow). Light: warm paper and a dawn version of the same
  scene, not an inverted one.
- **Accent:** a single light-source color, such as lantern amber or signal teal. Use it for the
  active state, the progress fill and the focus ring, nothing else.
- **Type:** editorial. A confident display face for chapter titles, calm body text, and generous
  spacing.

## Signature visual

A generated, text-free art plate with thin live layers on top, such as drifting particles, a
moving light, water shimmer, or parallax between two or three depth planes. Follow
`skills/build-animation/workflows/cinematic-plate/cinematic-plate.md`. Generate plates through
the image tool the routing names (Codex image mode), never as placeholders.

## Motion character

- Slow and weighted, like a camera:
  - Lenis scroll (duration 1.5, expo ease).
  - A sprung camera on the hero (stiffness about 140, damping about 28).
  - Parallax of 2–8% between planes.
- Section entrances: a slow fade and rise (600–900 ms) that is tied to scroll position, not a
  timer.
- Long pages get the chapter dot rail. Its fill reads as a light line.
- Anything ambient loops without a visible restart: use continuous noise or time, never keyframe
  loops.

## Performance

WebGL or canvas heroes start as the still plate and upgrade after input or idle. A frame governor
settles slow devices, and the LCP plate is preloaded
(`skills/build-animation/workflows/heavy-hero-performance.md`). Pause offscreen and in hidden tabs.

## Accessibility

- Text over a plate sits on a scrim or a masked region dark (or light) enough for 4.5:1
  contrast. Check this in both themes.
- Under reduced motion: a still plate, no parallax, and instant scroll.

## Anti-patterns

- Boxed hero canvases.
- Stock-photo plates.
- Lens flares, film-grain gimmicks and letterbox bars.
- Several competing light colors.
- Plates that leave dead space above the fold.
- Text baked into generated art.

## Verify

- Screenshots at 1440 and 390, light and dark, with frames at the start, middle and end of the
  hero.
- Lighthouse on mobile, with CLS at 0 and TBT measured with the hero on and off.
