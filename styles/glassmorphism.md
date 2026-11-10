# Style add-on: glassmorphism

Frosted panels float over a rich, slowly living background. Depth comes from blur, a fine edge
light and parallax between the background and the glass. Glass only works when there is
something worth seeing through it.

## Material and tokens

- **Glass surface:**
  - Fill: translucent, with `backdrop-filter: blur(16–24px) saturate(140%)`.
  - Edge: a 1px border in about 18% white (dark mode) or about 60% white (light mode), with a
    top highlight from `linear-gradient` on a `::before`.
  - Shadow: soft, large and low-opacity, to lift the panel off the background.
- **Solid enough backing (owner rule):** panels that carry text use a fill opacity of at least
  0.6 in light mode and 0.55 in dark mode, so text never sits on a busy background. Use
  `@supports not (backdrop-filter: blur(1px))` to fall back to a near-opaque fill, and
  `@media (prefers-reduced-transparency: reduce)` to make it opaque.
- **Background:** a living field, such as a slow gradient mesh, soft color blobs, or a
  cinematic plate. Dark: a deep layered gradient with pools of light. Light: warm, pale, tinted
  blobs on paper, not white glass on white.
- **Color:** the background carries the color, and the accent is used surgically on the glass
  (active state, primary action). Blob colors are two or three tints of the same family, so they
  never compete.

## Signature visual

The background field is the signature. It is a single slow, continuous, low-CPU canvas, shader
or CSS gradient animation behind all the glass. It can respond gently to scroll position, or to
the pointer with heavy damping. For a scene, use the cinematic add-on as the base and glass as
the accent.

## Motion character

- Background drift is very slow (20–60 s per cycle, continuous noise, no visible restart).
- Glass panels move a little less than the content scroll (0.9–0.95×), so depth reads, and they
  enter with fade and blur-in only through `opacity`. Never animate the `backdrop-filter`
  radius.
- Hover: the edge highlight brightens, with an optional sheen that follows the pointer at low
  opacity. Press: a slight scale of 0.98.
- Keep the shared feel: Lenis scroll, and the chapter dot rail on long pages, with the rail as a
  thin glass strip with a solid fill line.
- Under reduced motion: a static background, no parallax, instant scroll, and the fills stay
  readable.

## Performance

- `backdrop-filter` costs GPU on every frame where something behind it moves. Keep the number of
  blurred layers on screen at once small, about 6 or fewer, and never nest glass inside glass.
  Avoid full-screen blurred overlays on mobile.
- Draw the background at half resolution and scale it up, which is fine because it is blurred
  anyway. Cap the device pixel ratio, pause it offscreen, and apply the frame governor from
  `skills/build-animation/workflows/heavy-hero-performance.md`.
- Test scroll smoothness on a mid-range phone profile (Chrome CPU throttle 4×), because glass
  over a moving background is the usual jank source.

## Accessibility

- Check contrast against the worst point of the background behind each panel, not the
  average. Screenshot with the background at several moments of its animation.
- Borders and focus rings must stay visible on both the brightest and darkest parts of the
  background.

## Anti-patterns

- Glass over a flat background (it just looks grey).
- Low-opacity text panels.
- Rainbow blobs.
- Blur on everything.
- Animated blur radius.
- Glass inside glass.
- Hard white borders that read as wireframes.

## Verify

- Screenshots at 1440 and 390, light and dark, at two different moments of the background.
- Contrast checks at the worst point.
- A reduced-motion and reduced-transparency pass.
- A trace of a throttled mobile scroll, with no long frames from the background.
