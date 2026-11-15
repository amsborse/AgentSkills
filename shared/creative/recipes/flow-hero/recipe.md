# Flow hero

A slow, living colour field behind a hero: domain-warped noise in a raw WebGL fragment shader,
in three brand colours. No library. It starts as a CSS gradient and the shader fades in over it
only when the device can afford it. Technique notes: `../../techniques/shader-distortion.md`
and `../../techniques/environmental-lighting.md`.

**Use for** one signature surface per product: a landing hero or a brand moment. **Not for**
backgrounds behind long text, more than one instance per view, or dashboards. This is the only
recipe with a continuous render cost.

## Files

`recipe.css` (the still gradient and the fade), `recipe.js`, and `../_runtime/quality.js`
(required).

## API

```html
<section class="flow-hero" style="--flow-a:#0d1d1a; --flow-b:#1f6b58; --flow-c:#b9763a">…</section>
<script src="../_runtime/quality.js"></script>
<script src="recipe.js"></script>
<script>const flow = ExperienceFlow.mount(document.querySelector('.flow-hero'));</script>
```

- `--flow-a` (base), `--flow-b`, `--flow-c`: any CSS colour. Set them per theme.
- `mount(el, { quality, speed = 1 })` returns `{ loop, refresh(), destroy() }`.
- `refresh()`: call after changing the colours from script (a theme toggle). A system
  colour-scheme change is picked up automatically.
- `el.dataset.flow` is `still` or `live`, for styling or tests.

## Tiers

| Tier | What draws |
|---|---|
| static, reduced motion, no WebGL | The CSS gradient. No canvas, no context, no frames. |
| low | 30 fps, 2 noise octaves, 1× pixels at 62% scale |
| balanced | 60 fps, 3 octaves, up to 1.5× pixels at 75% scale |
| high | 60 fps, 4 octaves, up to 2× pixels at 87% scale |
| ultra | Display rate, 5 octaves, up to 2× pixels at full scale |

Octave sums are normalised, so brightness and colour stay the same on every tier; only the
fine detail changes. Measured numbers per tier are in `../README.md`.

## Resource lifecycle

The canvas and GL context exist only while the hero is on screen, the tab is visible and the
tier is above static. Scrolled away or hidden: the loop stops. After 15 s away, or on a switch
to static: buffers and program are deleted, the context is released with `WEBGL_lose_context`
and the canvas is removed. They are rebuilt on return. A lost context or a shader that fails
to compile leaves the gradient in place and logs one warning.

## Accessibility

The canvas is `aria-hidden` and takes no pointer events. Text sits on moving colour, so check
contrast against the brightest colour the field can reach (`--flow-b` and `--flow-c`), not only
the base, and add a scrim or text shadow as the demo does. Movement is slow and has no flashing.
Reduced motion gets the still gradient.

## Performance

One full-screen triangle, one fragment shader; cost scales with canvas pixels times octaves,
which is what the tiers reduce. On a software renderer the top tiers are slow (see the measured
table), which is why automatic mode steps down and why `ultra` should stay opt-in.

## Verify

Check `data-flow` goes `still` → `live`, that scrolling the hero offscreen stops frames, that
`?quality=static` leaves no `<canvas>`, and that both themes read well. Run the bench across
tiers on the target hardware. Automated: "flow hero" in `tests/recipes-browser.test.mjs`.
