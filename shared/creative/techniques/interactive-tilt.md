# Interactive tilt

A card or product image rotates slightly in 3D toward the pointer, optionally with a glare
layer, to suggest a physical object.

## Use when

- Product cards, collectibles, covers, portfolio tiles: objects that benefit from tactility.
- Not on cards full of text or controls, and not on more than one row at a time.

## Options

- **CSS:** parent has `perspective: 800px`; child gets
  `transform: rotateX(var(--rx)) rotateY(var(--ry))` with angles from pointer position, clamped
  to ±6–10°. Glare as a gradient pseudo-element driven by the same variables.
- **Motion:** `useSpring` + `useTransform` for spring return.
- Inner layers at different `translateZ` give parallax inside the card (`depth-parallax.md`).

## Dependencies

None for CSS. Motion only if already used.

## Accessibility

Decorative; the card works without it. Keep the clickable area stable (tilt an inner wrapper).
Avoid large angles that make text hard to read.

## Performance

Low. rAF-coalesced writes; `will-change: transform` only while hovered. Cache the bounding box
on `pointerenter`.

## Compatibility

All modern browsers. Gate on `(hover: hover) and (pointer: fine)`. Safari can flicker with
`preserve-3d` plus `overflow: hidden`; test it.

## Reduced motion

No rotation; keep a flat hover state (shadow or border change).

## Verify

- Hover corners and center: angles stay small, return eases, text stays crisp.
- `visual-audit` hover check: feedback present, no layout move.
- Test in Safari or WebKit if available (Playwright `webkit`).
