# Spring-based physical feedback

Presses, toggles, drops and selections respond with a short spring (a small overshoot and
settle) so the interface feels physical and confirms the action.

**Ready-made recipe:** `../recipes/spring-states/` (tiered, tested, with a demo). Start from it and adapt; see
`../recipes/README.md` for the contract and `demos/experience/` for it in a real page.

## Use when

- Buttons, toggles, chips, likes, add-to-cart, drag drops: moments that confirm an action.
- Every product type, at its intensity: barely visible on Operate surfaces, bouncier for games.

## Options

- **CSS `linear()` easing** that encodes a spring curve (generate the points from a spring
  function), on `transform: scale()` for press and release.
- **WAAPI** with the same `linear()` easing for JS-triggered moments.
- **Motion:** `whileTap`, `type: "spring"` with stiffness and damping; `useSpring` for values.
- Tune by feel: press 0.96–0.98 scale, 120–200 ms; settle without visible oscillation on
  Operate surfaces.

## Dependencies

None for CSS/WAAPI. Motion only if already in the project.

## Accessibility

Feedback also exists for keyboard activation (Space/Enter), not only pointer. State changes
are announced by the element's semantics (`aria-pressed`, `aria-checked`), not by motion.

## Performance

Low. Transform only, short-lived. Avoid springs on layout properties.

## Compatibility

`linear()` easing is widely available (2023+). Older browsers fall back to the declared ease.

## Reduced motion

Keep the state change (color, icon, checkmark) and drop the overshoot; an instant or 100 ms
non-bouncy change is fine.

## Verify

- Click and press keys on each element: response is immediate, settles cleanly.
- Record frames of a press; no layout shift in `visual-audit`.
- Reduced motion: state still visibly changes.
