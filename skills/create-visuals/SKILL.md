---
name: create-visuals
description: Create visuals that fit the product: a signature living visual, illustrations, animated icons, organic masks, interactive diagrams, hero images when an image tool exists. Real data only, verified in both themes. Use for "create a hero visual", "add illustrations" or "make a diagram".
metadata:
  aliases: "create visuals, hero visual, signature living visual, add illustrations, animated illustration, animated icons, make a diagram, interactive diagram, explainer visual, brand visual, organic shapes, background visual"
  keywords: "visual, illustration, icon, diagram, chart, svg, lottie, rive, mask, blob, hero, image, graphic"
  composes: "build-animation, build-3d, audit-design, verify"
  requires: "browser, image-generation?"
  risk: "low"
---

# Create visuals

One signature visual per product acts as its brand mark: it belongs to the page, blended in
with masks and atmosphere, never boxed in a card. Every other visual explains something. The
look comes from the product's brand and `~/agent-skills/shared/creative/adaptation.md`, never
from a default style.

## Steps

1. **Purpose:** what should the visual communicate? If nothing, leave it out (removal test).
2. **Pick the form** and load only its technique file from
   `~/agent-skills/shared/creative/README.md`:
   - `shared/creative/techniques/organic-masks.md` (blending, shapes)
   - `shared/creative/techniques/animated-illustrations.md` (SVG, Rive, dotLottie)
   - `shared/creative/techniques/interactive-diagrams.md` (systems and data)
   - `shared/creative/techniques/fluid-particles.md` (living fields)
   - 3D goes to `build-3d`; motion of the visual to `build-animation`.
3. **Assets:** use the project's illustration language. Generate images only with an image
   tool that is available; never present a placeholder as final. Never copy protected art;
   note the license of anything sourced.
4. **Data visuals** show real values with honest scales and a legend; tooltips work on
   focus as well as hover.
5. **Verify** with `~/agent-skills/shared/creative/visual-loop.md`: both themes (light is
   designed, not inverted), three viewports, text over visuals passes contrast, reduced motion
   shows a meaningful still.

## Report

What each visual communicates, asset sources, screenshot paths, runner result.
