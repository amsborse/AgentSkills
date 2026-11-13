# Kinetic typography

Type that moves: headlines that assemble letter by letter or line by line, words that shift
weight or width, text that reacts to scroll or pointer.

## Use when

- One headline per page at most on Persuade surfaces; title sequences; brand moments.
- Never on body text, labels or anything people need to read quickly.

## Options

- **Line or word reveal:** split into spans (by hand or GSAP SplitText), animate
  `transform`/`opacity` with a stagger; mask each line with `overflow: clip` for a rise-in.
- **Variable fonts:** animate `font-variation-settings` (weight, width, slant) on hover or
  scroll; registered custom properties for smooth interpolation.
- **Scroll-linked:** `animation-timeline: view()` on spans.
- **Canvas/SVG text** for path-following or distortion (pairs with `shader-distortion.md`).

## Dependencies

None for spans + CSS. GSAP SplitText (free) when splitting must survive responsive reflow and
GSAP is present. A variable font the project already licenses.

## Accessibility

Screen readers read the original string: keep it in an `aria-label` on the container and mark
split spans `aria-hidden`, or split visually without breaking words. Final state is static and
fully legible. No flashing (WCAG 2.3.1).

## Performance

Medium. Many spans × transforms is fine once; avoid per-frame layout (re-splitting on every
resize). Variable-font animation triggers text re-layout: keep it to short strings.

## Compatibility

All modern browsers. Variable font axes depend on the font file.

## Reduced motion

Show the final text immediately, or a single fade.

## Verify

- Screen reader or accessibility tree shows the whole sentence once.
- Screenshot at the end state: no clipped descenders or overlapping letters.
- Resize mid-animation: no broken lines.
