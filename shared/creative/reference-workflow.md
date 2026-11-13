# Reference-driven workflow

For "make it like this site", "reproduce the interactions from this reference", a screenshot,
or a video. The output is an original adaptation in the project's own design language, or a
faithful reproduction only when the user owns the reference or is authorized to copy it.

## Ethics and limits

- Never copy protected assets (images, video, fonts, logos, illustrations, 3D models, audio) or
  proprietary source code. Study behaviour and principles; rebuild with your own code and
  assets (`create-visuals`) or the project's.
- Remote capture only when the user supplied the URL: read `robots.txt` first and respect it,
  stay logged out, load each page a few times at most, and never save the site's assets. Keep
  captures in the scratch or `.visual/` folder, not in the repository.
- `visual-audit.mjs` refuses remote URLs unless `--allow-remote` is passed; pass it only for a
  reference the user gave you.
- When authorization for a faithful copy is unclear, build the adaptation and ask once.

## Steps

1. **Inspect.** Open the reference. For a site: note framework hints and libraries
   (`window.gsap`, `window.__THREE__`, a Lenis class on `html`, `PIXI`), and scroll the whole
   page once. For a video: step through frames. For an image: zoom into details.
2. **Capture states.** Screenshots at desktop and mobile, before and during hover on key
   elements, mid-scroll at 25/50/75 %, and a short recording of signature motion
   (Playwright `recordVideo` or the screencast). Note timings by stepping frames.
3. **Analyze layout and motion.** Grid and columns, type scale and pairing (by role, not by
   font name), spacing rhythm, color roles, materials (flat, depth, texture), what moves, what
   triggers it, duration, easing character and how elements hand off to each other.
4. **Identify techniques.** Map each behaviour to a file in `techniques/` and a tool from
   `selector.md`. Mark anything that has no clean equivalent.
5. **Write the spec.** A short table: behaviour → technique → tool → trigger → timing →
   reduced-motion fallback → acceptance check. Include what you deliberately will not copy.
6. **Adapt.** Translate to the project's tokens, type, components and brand (`adaptation.md`).
   Keep the principle (e.g. "content reveals with a mask that follows scroll"), not the
   reference's colors, fonts or imagery.
7. **Implement** in the existing framework, with libraries already present where possible.
8. **Compare.** Render yours at the same viewports and states as the captures and view them
   side by side (`review-changes` can render pairs). List concrete differences: spacing,
   timing, easing, hierarchy, density.
9. **Iterate** on observable differences until the principles match, then run the full
   `visual-loop.md` gates. Report reference shots, final shots and remaining differences.
