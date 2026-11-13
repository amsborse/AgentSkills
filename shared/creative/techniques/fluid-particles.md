# Fluid and particle effects

Fields of particles, smoke, ink or liquid that move on their own and respond to the pointer or
scroll; often the signature living visual of a page.

## Use when

- A product needs one signature visual that expresses an idea (data flow, energy, community,
  calm). One per page, blended into the layout with masks, never boxed in a card.
- Not as decoration behind dense content, and not more than one living field per view.

## Options

- **CSS only:** a few dozen absolutely positioned elements with keyframes for drifting dots or
  bokeh; cheapest.
- **Canvas 2D:** up to a few thousand particles with simple forces; one rAF loop.
- **PixiJS** for many sprites with blending in 2D.
- **WebGL (OGL or three):** GPU particles (points with a vertex shader), or a stable-fluids
  simulation for ink and smoke; `InstancedMesh` for many 3D objects.
- Deterministic seeds so screenshots are comparable; a virtual clock for tests.

## Dependencies

None for CSS/Canvas. Pixi, OGL or three only per `../selector.md`; never two engines.

## Accessibility

Purely decorative: `aria-hidden`, no information only in the effect. Text placed over it
keeps contrast (scrim or mask under the text). Pointer reactions are optional delight.

## Performance

High. Particle count scales with viewport and device (`navigator.hardwareConcurrency`, DPR);
cap DPR at 2; pause when offscreen or the tab is hidden; reduce on `save-data`. Budget: no
long frames, steady frame rate on a throttled CPU.

## Compatibility

Canvas and WebGL everywhere modern; a static poster image or CSS gradient when WebGL fails.

## Reduced motion

A still frame of the field (render one frame, stop the loop), or very slow drift with no
pointer reaction.

## Verify

- Screenshots in both themes: the field blends in (no hard box edges), text over it passes
  contrast.
- `visual-audit`: offscreen-render and idle checks, long frames, reduced-motion still.
- Hide the tab or scroll away: frame callbacks stop.
