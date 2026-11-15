# Magnetic target

A primary action whose face leans toward an approaching pointer and springs home on leave. The
clickable area never moves. Technique notes: `../../techniques/magnetic-hover.md`.

**Use for** one or two primary actions on a page. **Not for** navigation lists, dense toolbars or
every button: many magnets side by side feel unstable and fight each other.

## Files

`recipe.css`, `recipe.js`. Uses the `--spring-bouncy` token from `spring-states/recipe.css` for
the release if it is loaded, with a plain fallback otherwise.

## API

```html
<button class="magnetic"><span class="magnetic__inner">Start a project</span></button>
<script src="recipe.js"></script>
<script>const stop = ExperienceMagnetic.init({ strength: 0.3, max: 12 });</script>
```

- `.magnetic`: the real control and the hit area. `--magnetic-field` (padding) sets how far
  out the pull begins.
- `.magnetic__inner`: the visible face, moved by `--mx` / `--my`.
- `init({ scope = document, strength = 0.3, max = 12 })`: `strength` is the share of pointer
  offset the face follows; `max` caps travel in pixels. Returns a clean-up function.

## Tiers

- **static, low, reduced motion:** no pull. The button is an ordinary button.
- **balanced and up:** the face follows within `max` pixels and springs back on leave.
- **Touch and pen:** ignored; only a mouse pulls.

## Accessibility

Because only the inner face moves, the hit area and focus ring stay where they are, so the
target never slides out from under a click (tested). Disabled and `aria-disabled` controls are
skipped. The padding field enlarges the hit area: check it does not overlap a neighbouring
control. Keep travel small; large pulls are disorienting.

## Performance

No loop. One delegated passive `pointermove`, one transform write per frame while the pointer
is inside a field, compositor-only (`transform`).

## Verify

Approach, click near the edge of the field (the click must land), leave (face returns to
zero), tab to it (no movement, focus ring in place). Repeat with `?quality=low`. Automated:
"magnetic target" in `tests/recipes-browser.test.mjs`.
