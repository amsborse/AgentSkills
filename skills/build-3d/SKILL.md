---
name: build-3d
description: Build interactive 3D/WebGL scenes, shaders and particle fields that stay fast and accessible: lightest engine, capped pixel ratio, paused offscreen, fallbacks, browser-verified. Use for "create an interactive 3D scene" or "add a WebGL effect".
metadata:
  aliases: "build 3d, 3d scene, interactive 3d, interactive 3d scene, create a 3d scene, webgl effect, webgl scene, shader effect, three.js scene, particle effect, 3d model viewer, product configurator"
  keywords: "3d, webgl, three, r3f, shader, glsl, particles, scene, camera, model, gltf, canvas, lighting"
  composes: "build-animation, create-visuals, audit-design, coordinate-agents, verify"
  requires: "browser, codex-bridge?"
  risk: "medium"
---

# Build 3D

3D is earned, never a default. First ask whether a flat technique does the job
(`~/agent-skills/shared/creative/adaptation.md`); 3D fits product configurators, spatial
data, games, art and brand heroes where depth carries meaning.

## Steps

1. **Engine:** follow `~/agent-skills/shared/creative/selector.md`. One WebGL engine per
   page: OGL for a single shader plane, three.js (or R3F in React) for real scenes, PixiJS
   for 2D. Reuse what the project has. Assets (models, HDRIs, textures) must be owned or
   licensed; note the source.
2. **Technique files** (load only what you use) from `~/agent-skills/shared/creative/README.md`:
   - `shared/creative/techniques/shader-distortion.md`
   - `shared/creative/techniques/fluid-particles.md`
   - `shared/creative/techniques/environmental-lighting.md`
   - `shared/creative/techniques/depth-parallax.md`
   - `shared/creative/techniques/scene-transitions.md`
3. **Budget from the start:** DPR capped at 2, canvas sized to its element, render loop
   paused by IntersectionObserver and `visibilitychange`, stopped when the scene is at rest,
   `webglcontextlost` handled, geometry instanced, textures compressed. A still poster renders
   first; the live scene upgrades after load. The heavy-hero-performance
   workflow in `build-animation` has the frame governor.
4. **Accessible:** the canvas is `aria-hidden` or labelled; every action in the scene has a
   DOM control; content never lives only inside the canvas. Reduced motion shows a still
   frame or a static camera.
5. **Delegate** heavy scene code to Codex in a worktree
   (`~/agent-skills/shared/creative/codex-orchestration.md`); review the result yourself.
6. **Verify** with `~/agent-skills/shared/creative/visual-loop.md`: screenshots in both themes
   and three viewports, WebGL-disabled fallback, and the `audit-design` runner clean on
   offscreen-render, idle-render, long frames and reduced motion. Use a seeded or virtual
   clock so screenshots are comparable.

## Report

Engine and why, asset sources, frame and idle measurements, screenshot paths, and fallbacks
tested.
