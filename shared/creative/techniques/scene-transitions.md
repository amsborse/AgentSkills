# Responsive scene transitions

Moving between pages, routes, steps or full-screen scenes with one continuous movement that
tells the user where they went, and adapts to screen size and input.

**Ready-made recipe:** `../recipes/route-transition/` (tiered, tested, with a demo). Start from it and adapt; see
`../recipes/README.md` for the contract and `demos/experience/` for it in a real page.

## Use when

- Route changes, multi-step flows, galleries opening to detail, slide-based storytelling,
  3D scene changes.
- For one element that persists across states, see `shared-element-transitions.md`.

## Options

- **View Transitions (same-document):** `document.startViewTransition()` with
  `::view-transition-old/new` animations; Baseline since October 2025. Framework routers can
  wrap navigation in it.
- **Cross-document View Transitions:** `@view-transition { navigation: auto; }` for multi-page
  sites; not Baseline yet, so treat it as progressive enhancement.
- **Motion `AnimatePresence`** for React route and step transitions.
- **GSAP timelines** for orchestrated scene sequences already built on GSAP.
- **3D:** animate camera and object states within one canvas instead of reloading scenes.
- Adapt per breakpoint: slides become fades on small screens; direction follows navigation
  (forward vs back).

## Dependencies

None for View Transitions. Motion or GSAP only if present.

## Accessibility

Move focus to the new scene's heading or main region; update the document title; the back
button works. Transitions never delay input for long (keep them under ~400 ms for navigation).

## Performance

Medium. View Transitions snapshot the page: avoid huge `view-transition-name` counts. Do not
block navigation waiting for animations; preload the next scene's data.

## Compatibility

Feature-detect `document.startViewTransition`; without it, navigate instantly. Cross-document
transitions: Chromium and Safari only at the time of writing.

## Reduced motion

Instant swap or a short crossfade; no sliding, zooming or camera moves.

## Verify

- Navigate forward and back with mouse and keyboard; focus lands on the new content.
- Record frames: one continuous movement, no flash of blank or double content.
- Mobile viewport variant behaves as designed; reduced motion is instant.
