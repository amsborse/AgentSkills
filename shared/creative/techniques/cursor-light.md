# Cursor-following light

A soft highlight, border glow or spotlight follows the pointer across a surface or a grid of
cards, revealing material and inviting exploration.

## Use when

- Card grids, feature sections or hero surfaces where the light hints at interactivity.
- Dark themes take a glow; light themes take a subtle sheen or shadow shift instead (designed,
  not inverted).
- Not on text-heavy reading areas or as a full-page cursor replacement.

## Options

- **CSS radial gradient:** set `--x/--y` from `pointermove` on the container; each card uses
  `background: radial-gradient(circle at var(--x) var(--y), <token> , transparent 40%)`.
- **Border light:** same gradient on a masked pseudo-element (`mask-composite: exclude`) for a
  lit border.
- **`@property`** registered `<length-percentage>` vars let the light ease toward the pointer.
- **Canvas or WebGL** only when the light interacts with a 3D scene (`environmental-lighting.md`).

## Dependencies

None.

## Accessibility

Decorative: never carries meaning; the content stays readable with the light anywhere,
including over text (check contrast at the brightest point). Keyboard focus shows its own ring.

## Performance

Low. One listener on the container, rAF-coalesced variable writes. Avoid large blur filters
animated per frame; gradients are cheap.

## Compatibility

All modern browsers. `@property` is Baseline (2024); without it the light jumps instead of
easing, which is acceptable. Gate on `(hover: hover)`.

## Reduced motion

Keep a static light at a fixed position, or none; no tracking.

## Verify

- Move the pointer across cards in both themes; the light never washes out text.
- `visual-audit` contrast check passes; idle rAF stays 0 when the pointer is still.
