# /cinematic-plate

Proven on the amsborse.github.io hero (2026-11-07): a procedural three.js scene could not get
close to the reference; plate + live layers matched it in a few iterations at 1 draw call, 60 fps
and ~100 KB per image. Reuse the templates; do not re-derive them.

## Files here (copy, then adapt — read only the parts you change)

- `templates/plateMap.ts` — plate size, anchor points in plate pixels, `fitPlate` (cover with
  top slack, bottom-aligned, focus rect kept visible on narrow screens), `platePercent`.
- `templates/plateGL.ts` — WebGL1 single full-screen pass: water ripples, falls streaks, ring
  light, glow pulse, failure/recovery tint; exported `FRAGMENT` for tests. Smooth noise only.
- `templates/HeroPlate.tsx` — `<img>` plate (LCP-safe fallback), canvas, SVG elbow leaders,
  callouts with icons, hotspot buttons, offscreen/hidden/reduced-motion pause.
- `templates/plate.css` — stage, mask fade, callout, hotspot, veil, breakpoint rules.
- `templates/hero-plate-map.test.ts` — framing + shader regression tests.
- `scripts/export-plate.py` — PNG → `<name>.webp` + `<name>-960.webp` (PIL, q80).
- `scripts/shoot.mjs` — real Playwright screenshots at 1440/1920/834/390, both themes.

## Steps

1. **Read the reference and the site.** Note the composition (where the subject sits, what is
   empty for text), the elements that must be live, and the site's tokens/theme mechanism.
   Decide scope with the user only if it is unclear; otherwise state it in one line.
2. **Generate the plate** with the image mode of `~/agent-skills/skills/revamp-ui/workflows/codex-visual.md` (free via codex-bridge), attaching the
   reference: "text-free, no UI, no labels, same framing, subject on the right ~40–92% width,
   empty dark space left for type, <W>x<H>", one dark and one light variant (light = warm
   paper, soft shadows, not inverted). Open the PNGs and reject ones that miss key elements
   (count rings, falls, objects against the reference) — regenerate rather than patch.
   Keep sources in `design/` (never committed).
3. **Export:** `python -I ~/agent-skills/skills/build-animation/workflows/cinematic-plate/scripts/export-plate.py <png> public/<dir> plate-dark` (and light).
4. **Map anchors:** open the plate once, read pixel positions of each module/subject feature,
   and fill `plateMap.ts` (modules, sphere/rings/falls/horizon/ripple, focus rect). These drive
   the shader masks, hotspots and leaders — wrong anchors are the main source of drift.
5. **Wire** the templates into the project's hero, keeping any existing renderer behind a URL
   option (`?hero=3d`) rather than deleting it. Add deterministic URL params (`heroTime`,
   `heroState`) so screenshots are reproducible.
6. **Iterate on real screenshots:** start the dev server in the background, then
   `node ~/agent-skills/skills/build-animation/workflows/cinematic-plate/scripts/shoot.mjs <project> <scratchpad> http://localhost:<port> "?heroTime=4" <themeKey>`.
   Read dark-1440 next to the reference first; fix the biggest gap, re-shoot. Check every width.
7. **Verify and record:** typecheck, unit, e2e, build; regression test per bug (failing first);
   update the project's QA/perf docs with measured numbers only. Commit by path, no push.

## Pitfalls already hit (check these first)

- Plate scaled to cover full height crowds the copy and clips right callouts → `TOP_SLACK`,
  bottom-align, and a top `mask-image` fade under the header.
- Per-cell hash twinkle (`floor(p / 16.)`) draws visible square blocks → smooth noise.
- Callouts clipping the viewport → per-callout `maxWidth: min(13rem, calc(<room>% - 1.25rem))`
  so captions wrap; e2e test that every callout rect is inside the viewport at 1280/1440/1920.
- Media-query hide rule lost on specificity (`.a` vs `.a.b`) → callouts leaked onto tablet;
  match the base selector, and e2e-test labels and leaders hide together below the breakpoint.
- Duplicate captions (group label reused) → use a per-item caption; test uniqueness.
- Callouts peeking out from behind an open info panel → hide callouts while a panel is open.
- Failure-state URL params need the item id (`failure:<id>`); a bare value silently no-ops.
- Light-mode shader streaks drew a rectangle → gate by local contrast; light plate is its own image.
- LCP: the plate `<img>` under the canvas is not counted; measure on a warm browser.

## Rules

- Screenshots come from the real running app only. No invented metrics or captions that imply a
  real employer system — labels are a reading aid.
- Don't paste template files into context to "review" them; copy with `cp`, then edit the
  specific constants and selectors.
