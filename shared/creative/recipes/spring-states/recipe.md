# Spring states

Physical-feeling state changes (press, toggle, disclose) in CSS only, using `linear()` spring
easings with `cubic-bezier` fallbacks. Technique notes: `../../techniques/spring-feedback.md`.

**Use for** buttons, switches, accordions and any control whose state change should feel
answered. **Not for** large layout moves or anything that should feel calm and editorial: use a
plain ease there.

## Files

`recipe.css` only. No JavaScript, no runtime needed.

## API

| Token | Spring (stiffness / damping) | Settles in |
|---|---|---|
| `--spring-snappy`, `--spring-snappy-duration` | 400 / 32, no overshoot | 430 ms |
| `--spring-smooth`, `--spring-smooth-duration` | 170 / 26, no overshoot | 710 ms |
| `--spring-bouncy`, `--spring-bouncy-duration` | 260 / 16, overshoots | 790 ms |

Use as `transition: transform var(--spring-snappy-duration) var(--spring-snappy)`.

Ready-made classes: `.spring-press` (scale on `:active`), `.spring-toggle` (a checkbox styled as
a switch), `.spring-disclose` with `data-open` (height via grid rows, no measuring).

To generate other springs: `node ../_runtime/spring.mjs` exports `springLinear({ stiffness,
damping, mass })`, which returns the `linear()` string and its duration.

## Tiers

- **static, reduced motion:** `transition: none`. The state still changes at once.
- **low:** bouncy becomes snappy, so nothing overshoots.
- **balanced and up:** full springs.

## Accessibility

Real `<button>` and `<input type="checkbox">` elements: keyboard and screen readers get native
behaviour. `.spring-disclose` content must be made inert or `hidden` when closed if it holds
focusable children; set `aria-expanded` on the control. Scale stays within 3% so pressed text
does not blur or shift layout.

## Verify

Press, toggle and disclose by mouse and by keyboard; with `?quality=static` the state must still
change. Check `getComputedStyle(el).transitionTimingFunction` starts with `linear(` in a current
browser. Automated: "spring states" in `tests/recipes-browser.test.mjs`.
