---
name: build-animation
description: Design and build motion that is calm, continuous and 60fps, respects reduced motion and pauses offscreen: hero animations, signature living visuals, transitions, scroll and micro-interactions, and WebGL, Canvas or SVG effects. Includes cinematic-plate, which turns a reference image of a cinematic scene into a live web hero (a generated art plate plus thin live layers). Use for "add an animation", "hero animation", "make it move", a motion review, or replicating a cinematic reference.
metadata:
  aliases: "add animation, animate this, hero animation, make it move, motion design, cinematic plate, signature visual, review the animations"
  keywords: "animation, motion, transition, webgl, shader, canvas, svg, three.js, hero, scroll, easing, framer motion"
  composes: "verify, revamp-ui, coordinate-agents"
  requires: "browser, image-generation?, codex-bridge?"
  risk: "low"
---

# Build animation

Motion rules are in the UI taste section of `~/agent-skills/working-agreements/AGENTS.md`: one
synchronized movement, things travel to their new place, no snaps or visible loop restarts, no
gimmicks, and every animation communicates something.

## Pick the path

- **Micro-interaction or transition:** use the project's motion library or CSS. Animate transform
  and opacity only, 150–400 ms, with an ease-out curve and a `prefers-reduced-motion` fallback.
- **Signature visual or hero effect:** one living element blended into the page with masks, not
  boxed. Canvas or WebGL in a single pass, with a devicePixelRatio cap, paused by
  IntersectionObserver and `visibilitychange`.
- **Reference image of a cinematic scene:** follow `workflows/cinematic-plate/cinematic-plate.md`
  (a generated text-free plate plus live layers; templates and scripts are in that folder).
- **Isolated heavy effect:** you may delegate the implementation to Codex with the
  `coordinate-agents` skill, then review it yourself.
- **Motion audit:** record or screenshot the states, then list snaps, jank, competing motions and
  missing reduced-motion handling, each with a fix.

## Verify

Check in the running app: frames at the start, middle and end, both themes, and reduced motion on.
Measure frame time with a Performance trace or `requestAnimationFrame` deltas. For heavy effects,
watch CPU with the page idle and scrolled offscreen.
