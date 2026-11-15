# Recipes

Working code for the techniques in `../techniques/`. A technique file says when to use an effect
and what to watch for; a recipe is that effect built once, with its fallbacks, so it does not have
to be re-derived for every project. Recipes are plain CSS and plain browser JavaScript: no
framework, no build step, no dependency.

**Copy, then adapt.** Copy the recipe's files into the project, rename tokens to the project's
design system, and keep the tier and reduced-motion rules. Never load a recipe from this
repository at run time.

| Recipe | Files | Size (unminified) | Needs the runtime | Technique |
|---|---|---|---|---|
| `spring-states/` | `recipe.css` | 4.4 kB | no (CSS reads `data-quality` if present) | `spring-feedback.md` |
| `scroll-reveal/` | `recipe.css`, `recipe.js` | 2.2 + 2.2 kB | no | `scroll-choreography.md` |
| `route-transition/` | `recipe.css`, `recipe.js` | 1.6 + 2.3 kB | no | `shared-element-transitions.md`, `scene-transitions.md` |
| `cursor-light/` | `recipe.css`, `recipe.js` | 1.2 + 2.1 kB | no | `cursor-light.md` |
| `magnetic-target/` | `recipe.css`, `recipe.js` | 1.6 + 2.5 kB | no | `magnetic-hover.md` |
| `flow-hero/` | `recipe.css`, `recipe.js` | 0.9 + 8.2 kB | **yes** | `shader-distortion.md`, `environmental-lighting.md` |

`_runtime/quality.js` (12.6 kB unminified) is the adaptive quality runtime. `_runtime/spring.mjs`
generates the spring easing values. `_runtime/demo.css` and `demo.js` are chrome for the demo
pages only: do not copy them into a product.

Each recipe folder has a `recipe.md` (use, API, tiers, accessibility, verification) and a
`demo.html` that opens straight from disk. Add `?quality=static|low|balanced|high|ultra` to a
demo URL to pin a tier.

To see the recipes combined in real pages with three different characters (a console, an essay
and a landing page), open `demos/experience/index.html`; its `README.md` has screenshots and
per-tier measurements.

## The contract every recipe keeps

1. **Still first.** The page is complete and readable before any script runs and if every script
   fails. Motion is added on top; nothing is hidden waiting for JavaScript.
2. **Tiers through one attribute.** Behaviour changes only through `:root[data-quality="…"]`
   and the runtime's `budget`. A recipe never sniffs the device itself.
3. **Reduced motion is the static tier.** `prefers-reduced-motion: reduce` gives the static
   behaviour even without the runtime, through a media query in the recipe's own CSS.
4. **No idle work.** No `requestAnimationFrame` loop while nothing changes. Pointer and scroll
   handlers are passive and write at most once per frame. Continuous rendering goes through
   `quality.loop()`, which pauses offscreen and in hidden tabs and frees resources after 15 s away.
5. **Input parity.** Whatever a pointer reveals, keyboard focus reveals too. Touch gets a
   sensible default, not a broken hover.
6. **Clean exit.** Every `init`/`mount` returns a function or object that removes listeners,
   observers, inline styles and canvases.

## Tiers

| Tier | Pixel ratio cap | Frame cap | Detail | Meant for |
|---|---|---|---|---|
| `static` | 1 | none drawn | 0 | Reduced motion, no WebGL, a page that cannot draw |
| `low` | 1 | 30 | 0.25 | Data saver, weak or thermally limited devices |
| `balanced` | 1.5 | 60 | 0.5 | Default starting point for most devices |
| `high` | 2 | 60 | 0.75 | Devices that show headroom |
| `ultra` | 2 | display rate | 1 | Opt-in, or sustained headroom on a strong device |

Who decides, strongest first: reduced motion (always static), an explicit choice (`set()`,
`?quality=`, a stored preference), data saver (caps at low), measured frame pacing, device hints.
Measurement only happens while a `quality.loop()` is running, so a page with no continuous
effect never spends a frame on it.

What each recipe does per tier:

| Recipe | static | low | balanced / high / ultra |
|---|---|---|---|
| spring-states | State changes at once, no transition | Springs without overshoot | Full springs |
| scroll-reveal | Everything visible, progress bar still tracks | Fade only, no travel | Fade and rise |
| route-transition | Instant swap, focus still moved | Cross-fade only | Shared elements travel |
| cursor-light | Fixed highlight on hover and focus | Follows the pointer | Follows the pointer |
| magnetic-target | No pull | No pull | Face leans, springs home |
| flow-hero | CSS gradient, no canvas | 30 fps, 2 octaves, 1× pixels | 60 fps or display rate, 3–5 octaves |

## Runtime API

```html
<script src="_runtime/quality.js"></script>
<script>
  const q = ExperienceQuality.shared();          // one per page
  q.tier; q.mode; q.budget;                      // 'balanced', 'auto' | 'forced', { dpr, fps, detail }
  const off = q.on(({ tier, previous, reason }) => {});
  q.set('low');                                  // remembered; q.set('auto') clears it
  const loop = q.loop({ element, setup, render, dispose, still });
  loop.stop();
</script>
```

Bundlers and tests import `_runtime/quality.mjs` instead. `createQuality({ window, min, max,
start, storageKey, param })` makes a private instance.

## Measured

Lab numbers from one machine, taken with `audit-design`'s bench
(`visual-audit.mjs --perf --tiers default,static,low,balanced,high,ultra --runs 3`), 1280×800,
Chromium 153, Windows 11, Core i7-10750H. They show how the tiers behave relative to each other.
They are not field data and say nothing about phones, Safari or Firefox.

**All six demos, real GPU (RTX 2070 Max-Q, headed window, 300 Hz panel), every tier:** frame
time p95 3.4–3.7 ms against a 3.3 ms refresh interval, worst frame under 10 ms, no long tasks,
no page errors, JS heap 0.79–0.93 MB. On this hardware no tier is expensive, so these runs
confirm the recipes are idle-cheap but cannot rank the tiers.

**Flow hero, software renderer (SwiftShader, headless, no GPU), tier pinned:** the worst case
for a shader, and the only run here that separates the tiers.

| Tier | Canvas at 1280×800, 2× display | Octaves | Frames per second | Frame time p95 | Long tasks |
|---|---|---|---|---|---|
| static | none | – | 60 (page idle) | 16.8 ms | 0 ms |
| low | 800×390 (0.31 MP) | 2 | 60 page, 30 drawn | 16.8 ms | 0 ms |
| balanced | 1440×702 (1.0 MP) | 3 | 47–48 | 33.4 ms | 0 ms |
| high | 2240×1092 (2.4 MP) | 4 | 29–31 | 33.4 ms | 63 ms |
| ultra | 2560×1248 (3.2 MP) | 5 | 20 | 66.6 ms | 2,279 ms |

Canvas sizes were read at a 2× device pixel ratio; the frame numbers were taken at 1×, where
the canvases are smaller, so real 2× software rendering is slower than this table.

**Automatic mode on the same software renderer at 2×:** starts at high, reaches balanced within
about 4.5 s and low within about 8.5 s, then holds. (Before the timed-window fix in this
runtime it was still on high after 8.5 s.)

Not measured: INP and interaction frame pacing (no interaction script was run), memory growth,
energy, real mobile hardware, network transfer size (`file://` pages report decoded bytes).

## Verify after adapting

Run the project's own checks, then the bench from `audit-design` across the tiers the page
exposes, with and without reduced motion. `tests/recipes-browser.test.mjs` in this repository
shows the assertions worth keeping: content never left hidden, focus parity, no frames while
idle, canvas removed on static.

Framework notes: `adapters.md`.
