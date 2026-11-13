---
name: build-animation
description: Design and build motion that is calm, continuous and 60fps, respects reduced motion and pauses offscreen: hero animations, signature living visuals, transitions, scroll and micro-interactions, and WebGL, Canvas or SVG effects. Style add-ons (cinematic, claymorphism, glassmorphism) set the motion character on top of the shared calm feel. Includes cinematic-plate, which turns a reference image of a cinematic scene into a live web hero (a generated art plate plus thin live layers). Use for "add an animation", "hero animation", "make it move", a motion review, or replicating a cinematic reference.
metadata:
  aliases: "add animation, animate this, hero animation, make it move, motion design, cinematic plate, signature visual, review the animations, hover effect, card hover, tile hover, underline animation, arrow nudge, hover glow"
  keywords: "animation, motion, transition, webgl, shader, canvas, svg, three.js, hero, scroll, easing, framer motion"
  composes: "verify, revamp-ui, coordinate-agents"
  requires: "browser, image-generation?, codex-bridge?"
  risk: "low"
---

# Build animation

Motion rules are in the UI taste section of `~/agent-skills/working-agreements/AGENTS.md`: one
synchronized movement, things travel to their new place, no snaps or visible loop restarts, no
gimmicks, and every animation communicates something.

The feel is the same whatever the style: slow scroll, a single signature living visual, travel
instead of snaps, and still-first heavy visuals. The material and motion character come from a
style add-on in `~/agent-skills/styles/`: `cinematic.md` (weighted camera, plates),
`claymorphism.md` (springs with squash and give) and `glassmorphism.md` (a drifting field
under frosted depth). Read the project's chosen add-on first. If none has been chosen, use the
one the user names, or stay neutral.

## Pick the path

- **Micro-interaction or transition:** use the project's motion library or CSS. Animate transform
  and opacity only, 150–400 ms, with an ease-out curve and a `prefers-reduced-motion` fallback.
  Motion and hover never shift layout or change an element's size or position. (high) Motion
  never delays critical actions or content, does not replay on small scrolls and never hijacks
  scrolling. (high)
- **Hover affordance on tiles or cards:** follow `workflows/hover-affordance.md` (hover glow and
  elevation, lift, underline grow, arrow nudge, stretched link, focus parity, reduced motion).
- **Signature visual or hero effect:** one living element blended into the page with masks, not
  boxed. Canvas or WebGL in a single pass, with a devicePixelRatio cap, paused by
  IntersectionObserver and `visibilitychange`.
- **Reference image of a cinematic scene:** follow `workflows/cinematic-plate/cinematic-plate.md`
  (a generated text-free plate plus live layers; templates and scripts are in that folder).
- **Long chaptered page:** use the chapter rail and slow scroll in `workflows/chapter-rail.md`
  (a dot rail of in-page links with a spring-filled line, plus Lenis). The owner likes this pattern.
- **WebGL or canvas hero that must stay fast:** follow `workflows/heavy-hero-performance.md`. It
  covers the frame governor, rendering a still plate first and upgrading after input or idle, and
  preloading the largest image.
- **Isolated heavy effect:** delegate the implementation to Codex (UI work, per
  `~/agent-skills/shared/agent-routing.md`) with the `coordinate-agents` skill, then review it yourself.
- **Motion audit:** record or screenshot the states, then list snaps, jank, competing motions and
  missing reduced-motion handling, each with a fix.

## Verify

Check in the running app: frames at the start, middle and end, both themes, and reduced motion on.
Measure frame time with a Performance trace or `requestAnimationFrame` deltas. For heavy effects,
watch CPU with the page idle and scrolled offscreen.

Reduced motion must react to changes mid-visit. framer-motion's `useReducedMotion` doesn't, so
use a `useSyncExternalStore` matchMedia subscription (snippet in `workflows/chapter-rail.md`). Test
it by toggling `page.emulateMedia({ reducedMotion })` after the page has loaded.
