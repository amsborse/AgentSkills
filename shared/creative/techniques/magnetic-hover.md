# Magnetic hover

An element (usually a primary button or icon link) drifts a few pixels toward the pointer when
the pointer is near, and springs back on leave.

## Use when

- One or two hero calls to action on a Persuade surface, or playful products.
- Not on dense Operate screens, form controls, or more than a couple of elements per view.

## Options

- **CSS variables + one listener:** on `pointermove` over a hit area larger than the element,
  set `--mx/--my` (clamped to ±6–10 px); the element uses
  `transform: translate(var(--mx), var(--my))` with a `transition` for the return.
- **Motion:** `useSpring` on x/y from pointer offset for a physical settle.
- **GSAP:** `quickTo` for x/y when GSAP is already in the project.
- Move the label slightly less than the container for depth.

## Dependencies

None for the CSS variant. Motion or GSAP only if already present (`../selector.md`).

## Accessibility

Hover-only flourish: the button must look and work the same without it. Keep the hit box still
(move an inner layer) so the click target never escapes the pointer. Focus-visible gets its own
clear state; do not animate focus with magnetism.

## Performance

Low. One `pointermove` listener, writes coalesced in `requestAnimationFrame`, transform only.
Do not read layout (`getBoundingClientRect`) on every move; cache on `pointerenter` and resize.

## Compatibility

All modern browsers. Gate with `@media (hover: hover) and (pointer: fine)` so touch devices
never see it.

## Reduced motion

Disable the drift; keep the normal hover color or elevation change.

## Verify

- Hover in the running app: drift is small, return is smooth, no jitter at edges.
- `visual-audit` hover check reports no layout move; mobile shows no effect.
- With reduced motion emulated, the element stays put but hover feedback remains.
