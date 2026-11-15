# Cursor light

A soft highlight on a surface that follows the pointer, as if lit from the cursor. Technique
notes: `../../techniques/cursor-light.md`.

**Use for** a small set of cards or panels where hover should feel tactile. **Not for** every
surface on a page, text-heavy areas (the light lowers contrast if overdone) or touch-first
screens, where it does nothing.

## Files

`recipe.css`, `recipe.js`.

## API

```html
<a class="cursor-light" href="…">…</a>
<script src="recipe.js"></script>
<script>const stop = ExperienceCursorLight.init(/* scope = document */);</script>
```

- `.cursor-light`: the surface. A `::before` radial gradient is positioned by `--lx` / `--ly`.
- `ExperienceCursorLight.init(scope)` adds one delegated, passive `pointermove` listener to the
  scope and returns a clean-up function. Cards added later work without re-initialising.
- Tune the glow colour and size in `recipe.css` with the project's accent token; keep it subtle
  enough that text contrast on the surface still passes.

## Tiers

- **static, reduced motion:** the script does not track. Hover and focus show a fixed highlight
  from the top edge.
- **low and up:** the highlight follows a mouse or pen, one style write per frame.
- **Touch:** ignored; touch pointers never set the variables.

## Accessibility

Keyboard focus shows the same highlight at its default position, so the cue is not pointer-only
(tested). The light is decoration: it must not be the only sign of focus, so keep the
project's visible focus ring. The pseudo-element takes no pointer events.

## Performance

No loop. Work happens only on pointer movement over a `.cursor-light` surface, coalesced with
`requestAnimationFrame`; variables are cleared on leave. One `getBoundingClientRect` per frame
while moving.

## Verify

Move across a card, leave it (variables cleared), tab to it (highlight shows), and repeat with
`?quality=static` and touch emulation (no tracking). Automated: "cursor light" in
`tests/recipes-browser.test.mjs`.
