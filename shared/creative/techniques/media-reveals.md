# Image and video reveals

Images and video enter with a purposeful reveal (mask wipe, scale settle, blur-to-sharp) and
video starts only when seen.

## Use when

- Galleries, product media, editorial images, case studies, hero video.
- Keep reveals short and consistent: one reveal style per product.

## Options

- **Clip or mask reveal:** `clip-path: inset()` animated from one edge, or a mask gradient
  (`organic-masks.md`), triggered by IntersectionObserver or `animation-timeline: view()`.
- **Scale settle:** image starts at `scale(1.08)` inside a clipped frame and settles to 1.
- **Progressive load:** low-quality placeholder or dominant-color background, then the full
  image with a short fade.
- **Video:** `muted playsinline loop` with a `poster`; play when in view, pause when out;
  hover-to-play previews only with `(hover: hover)`.

## Dependencies

None.

## Accessibility

Images keep meaningful `alt`; video has captions when it carries speech, and visible
play/pause controls if it lasts more than 5 seconds (WCAG 2.2.2). Never autoplay sound.

## Performance

Low to medium. Correct `width`/`height` or `aspect-ratio` to prevent layout shift;
`loading="lazy"` below the fold, `fetchpriority="high"` for the hero image; modern formats
(AVIF/WebP), compressed video, no autoplaying video on save-data.

## Compatibility

All modern browsers. Autoplay requires `muted`; iOS needs `playsinline`.

## Reduced motion

Media appears without the wipe or scale; video shows the poster and does not autoplay.

## Verify

- `visual-audit`: no broken images or missing alt, CLS ≤ 0.1.
- Scroll through: media plays only in view (offscreen check shows no decoding work).
- Reduced motion: posters, no autoplay.
