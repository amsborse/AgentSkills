# Animation and rendering technology selector

Choose the simplest tool that does the job. Walk the list top to bottom and stop at the first
match. Before installing anything, check package.json: if the project already has a capable
engine, use it. One engine per job: do not add GSAP to a project already animating with Motion
(or the reverse) unless the existing one demonstrably cannot do the effect; write the reason in
the PR.

1. **CSS transitions and keyframes**: hover, focus, press, enter and exit of single elements,
   loaders. Add `@starting-style` for enter animations and `linear()` for spring-like easing.
2. **Native browser features**:
   - View Transitions API for shared-element and page-state transitions (same-document is
     Baseline since Oct 2025; cross-document is not Baseline: feature-detect, fall back to an
     instant swap).
   - CSS scroll-driven animations (`animation-timeline: scroll()/view()`) for scroll-linked
     progress and reveals (feature-detect with `@supports (animation-timeline: view())`; fall
     back to IntersectionObserver).
   - `@property` for animating custom properties (gradient stops, light position).
3. **Web Animations API** (`element.animate`): JS-controlled timelines, sequencing, reversing,
   scrubbing, without a library.
4. **Motion** (`motion`, MIT): React (or vanilla) UI transitions, layout animations, gestures,
   drag and springs.
5. **GSAP** (custom no-charge license, all plugins free since 2025; not OSI open source, and it
   bars use in tools that compete with Webflow): complex multi-element choreography, long
   scroll-scrubbed timelines, SVG morphing, text splitting.
6. **Rive** (MIT runtime; paid editor) or **dotLottie** (`@lottiefiles/dotlottie-web`, MIT;
   prefer it to `lottie-web`): designer-authored vector animation with states. Only when an
   authored file exists or will be made.
7. **OGL** (Unlicense, small, quiet project): a single lightweight WebGL effect (shader plane,
   distortion, gradient field) where three.js would be overkill.
8. **PixiJS** (MIT): many 2D sprites, particles or a 2D scene beyond what canvas 2D handles.
9. **three.js** (MIT) or **React Three Fiber + drei** (MIT, React projects): real 3D scenes,
   models, lighting, cameras.

Avoid: Theatre.js (development stalled; studio is AGPL), unmaintained wrappers, CDN script
tags in production, and any library whose license has not been checked.

## Matching guide

| Need | First choice | Escalate to |
|---|---|---|
| Hover, press, focus | CSS | Motion / WAAPI only for springs or pointer tracking |
| Pointer-tracking (magnetic, tilt, light) | CSS variables set from one pointer listener | Motion `useSpring` |
| Enter/exit, list reorder | CSS + `@starting-style`; View Transitions | Motion layout / AnimatePresence |
| Page or route transition | View Transitions | Motion, framework router transitions |
| Scroll reveal, progress | CSS scroll-driven | IntersectionObserver + WAAPI; GSAP ScrollTrigger for long scrubbed sequences |
| Text split and stagger | CSS per span | GSAP SplitText, Motion stagger |
| Authored character or icon | SVG + CSS | Rive or dotLottie |
| Shader effect on an image | OGL | three.js if the project already ships it |
| 2D particles | Canvas 2D | PixiJS |
| 3D scene, models | R3F (React) / three.js | none |

## Before installing

- Check the license and last release in the package registry; record it in the PR.
- Check bundle cost (import only what is used; lazy-load heavy engines after first paint).
- Check SSR or framework constraints (client-only components for WebGL).
- No package that the user did not approve when the change is large; one-line justification
  otherwise. Never vendor source code without a license and a source note in
  `docs/SOURCES.md` of the repository you are working in.
