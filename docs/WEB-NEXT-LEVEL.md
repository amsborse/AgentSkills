# Web experience engineering: next level

Status: **Phase 1 proposal, awaiting approval.** Nothing here is implemented. Written 2026-11-14
on branch `docs/web-next-level` (based on `feat/improve-visuals`, commit 026afd2).

How to read this: sections 1 to 2 are what exists and what the outside world offers. Sections 3
to 6 are what to change. Section 7 ranks it and names the first three investments. Section 8 is
the demo plan. Section 9 is how every claim would be validated. Section 10 lists the decisions
that need the owner.

Evidence rules used in this document:

- Repository facts come from files read on this branch, or from the `docs/future-skills`
  worktree where stated.
- External facts come from two research passes run on 2026-11-14. Browser support is from the
  `web-features` 3.46.0 dataset; library licences and versions from the npm registry; sizes from
  Bundlephobia or the jsDelivr build listing. Each carries its link. I did not re-open every link
  myself, so treat the support dates as "as reported by that dataset on that day".
- Anything not confirmed is marked **unverified**. There are no benchmark numbers in this
  document except two that already exist in the repository, quoted with their source.

---

## 1. Existing capability audit

### 1.1 What is already here

| Layer | What exists | Where |
|---|---|---|
| Creative skills (9) | `build-ui`, `revamp-ui`, `improve-visuals`, `audit-design`, `add-interactions`, `build-animation`, `build-3d`, `create-visuals`, `replicate-design` | `skills/` |
| Shared creative layer | Surface modes (Operate / Read / Persuade), motion intensity 0 to 4, craft floor, engine selector, 17 technique sheets, visual loop, reference workflow, Codex orchestration, learning ledger | `shared/creative/` |
| Style add-ons | cinematic, claymorphism, glassmorphism, each optional | `styles/` |
| Measurement | `visual-audit.mjs`: Playwright runner, 3 viewports x 2 themes, deterministic checks, exit codes | `skills/audit-design/scripts/` |
| Taste judging | Blind pairwise rounds, 10-dimension rubric, lever bank, keep-list | `skills/improve-visuals/` |
| Before/after evidence | Screenshot capture, pixel diff, report pages | `skills/review-changes/scripts/` |
| Heavy-visual performance | Frame governor, still-first-then-upgrade, kill switch, Lighthouse before/after | `skills/build-animation/workflows/heavy-hero-performance.md` |
| Overnight loops | `night` supervisor plus `night-visual`, `night-performance`, `night-accessibility`, `night-evolve-skills` | `skills/night*` |
| Agent split | Claude directs and reviews, Codex implements in a worktree through `codex-bridge` | `shared/creative/codex-orchestration.md` |
| Evals and registry | Held-out routing evals, generated registry, description budget check, 149 tests | `evals/creative/`, `registry/`, `scripts/validate.mjs`, `tests/` |
| Demos | Three static studies (Operate, Read, Persuade), no build step | `demos/creative/` |
| Third-party (not installed) | Emil Kowalski `review-animations`, `break-ui`, `learn-taste` (MIT); Anthropic `frontend-design`, `webapp-testing` (Apache-2.0); others | `vendor/` on branch `docs/future-skills` only |

### 1.2 What it does well

- **It is already style-agnostic by construction.** `adaptation.md` makes the product's purpose
  choose the mode and intensity, and the style add-ons are opt-in. This matches the mission's
  "never impose one aesthetic" and should not be redesigned.
- **Lightest engine first** is written down (`selector.md`: CSS, native APIs, WAAPI, Motion, GSAP,
  Rive, OGL, PixiJS, three.js) with licence notes.
- **Evidence over assertion.** The audit runner returns `unknown` when it cannot measure
  (contrast over images), has exit codes, and the visual loop requires before/after captures.
- **Taste is judged blind and pairwise**, which is what current research supports (see 2.6).
- **Keep or revert discipline** in the night loops: independent verification, isolated worktree,
  no push or merge.
- **Technique sheets have a uniform shape** (Use when, Options, Dependencies, Accessibility,
  Performance, Compatibility, Reduced motion, Verify). That shape is the right skeleton for
  recipes.

### 1.3 What should improve

1. **Performance evidence is thin.** The runner measures layout shift, long animation frames and
   idle frame rate. It does not measure LCP, INP, frame pacing during interaction, memory growth,
   transfer or bundle size, or behaviour under CPU throttling. `night-performance` is generic
   (repeat runs, median, noise band) and has no web-specific probe. Mentions of LCP, Lighthouse
   or bundle size appear in two workflow files only.
2. **Adaptive quality exists once, as prose.** The frame governor in `heavy-hero-performance.md`
   is a good design but it is binary (animate or settle), described in text, tied to one
   workflow, and has no shared implementation or test. Nothing implements quality tiers.
3. **Techniques are descriptions, not runnable code.** Agents re-derive each effect from prose
   every time. The only templates (`cinematic-plate`) are React and TypeScript.
4. **No colour-system or typography tooling.** Colour is checked (WCAG AA) but never generated:
   no OKLCH scale builder, no gamut mapping, no colour-vision simulation, no fluid type scale, no
   font loading or fallback-metric help.
5. **Motion is verified with still screenshots.** Nothing captures a frame sequence, so "snaps",
   "two-step flips" and "visible loop restarts" from the working agreements cannot be evidenced.
6. **No divergent exploration.** `improve-visuals` keeps the direction; `revamp-ui` picks one.
   Nothing prototypes three different directions cheaply and compares them.
7. **No single entry point.** A user has to choose between nine creative skills. Held-out routing
   evals sit at 12 of 20 top-1 (`docs/OPEN-QUESTIONS.md`), so the router does not rescue this.
8. **Browser verification gaps are recorded but open.** `demos/creative/README.md` states that
   browser verification is outstanding because Chromium could not launch in that workspace, and
   `OPEN-QUESTIONS.md` records hidden-tab pausing as unverified.
9. **The selector predates several now-usable platform features** (see 2.1).
10. **The work is split across branches.** The creative layer lives on `feat/improve-visuals`;
    `vendor/` and `docs/FUTURE-SKILLS.md` live on `docs/future-skills`; `main` has neither. Phase
    2 needs one base.

### 1.4 Overlap analysis

| Overlap | Today | Proposal |
|---|---|---|
| `revamp-ui` / `improve-visuals` / `night-visual` | Three ways to make an existing UI better: pick a direction and rebuild, iterate blind-judged rounds, one fix per night | Keep all three; they differ in scope. State the boundary in each description's first clause and let the Composer choose: direction change = revamp, same direction = improve, unattended = night. No merge |
| `add-interactions` / `build-animation` `hover-affordance` | Hover behaviour is specified in two places | Move `hover-affordance.md` under `add-interactions`, leave a pointer |
| `audit-design` / `verify` / `review-changes` capture | Three scripts open a browser and take screenshots | One shared capture module in `shared/creative/` used by all three. Behaviour unchanged |
| `build-animation` motion review / vendored `review-animations` | Motion review exists as a use, without a checklist | Adopt the ten standards as `build-animation/workflows/review.md` after the vendor audit |
| `audit-design` / vendored `break-ui` | Audit runs on the content it is given | Add a stress mode (worst-case content) to `audit-design` |
| `build-ui` direction step / vendored `frontend-design` | Both describe choosing a direction | Fold the "ground it in the subject matter" and self-critique passes into `build-ui`; no new skill |
| `history-learning` / vendored `learn-taste` | Both mine corrections | No action; `history-learning` already covers it |
| `build-3d` / `build-animation` WebGL heroes | Both can build a WebGL hero | Leave; the selector decides. Both adopt the shared quality runtime |

### 1.5 Hard constraint: the description budget

`scripts/validate.mjs` caps the catalog's combined descriptions at 16,000 characters and the
catalog is at 15,838. There is room for **one** short new description, and only after trimming
elsewhere. `OPEN-QUESTIONS.md` already sets the precedent that new ideas become modes of
existing skills. This proposal therefore adds exactly one skill (the Composer) and delivers
everything else as modes, shared helpers, recipes and eval tools.

### 1.6 Baseline check state (before any change)

- `node --test tests/*.test.mjs`: 149 pass, 0 fail, 1 skipped.
- `node scripts/validate.mjs`: exits 1 with 2 failures, both "discovers skills via
  `~/.claude/skills`" for OpenCode and Cursor. These concern the machine's installed links, not
  repository content, and were present before this branch changed anything. Cause not
  investigated.

---

## 2. Research findings

Labels: **Production** = usable now, with the stated fallback. **Emerging** = use as progressive
enhancement. **Experimental** = one engine or unstable; demos only.

### 2.1 Native platform, zero bytes

Source for support: web-features 3.46.0, https://unpkg.com/web-features@3.46.0/data.json
(C / F / S = Chrome / Firefox / Safari).

| Feature | Support as reported | Label | Replaces |
|---|---|---|---|
| `linear()` easing | C113 / F112 / S17.2, widely available | Production | JS spring libraries for simple springs |
| `@starting-style` + `transition-behavior: allow-discrete` | C117 / F129 / S17.5 | Production | Enter/exit animation JS |
| `@property` | C85 / F128 / S16.4 | Production | JS-driven gradient and variable-font tweens |
| View Transitions, same document (+ `view-transition-class`) | C111 / F144 / S18 | Production | FLIP libraries for layout moves |
| Scroll-driven animations (`animation-timeline`) | C115 / F159 / S26, newly Baseline 2026-10-27 | Production with fallback | Scroll listeners, simple ScrollTrigger uses |
| `light-dark()`, `color-mix()`, relative colour, OKLCH | Baseline | Production | Theme JS, preprocessor colour maths |
| `contrast-color()` | C147 / F146 / S26 | Emerging | Hand-picked foregrounds |
| Anchor positioning | C125 / F147 / S26, newer sub-features incomplete | Emerging | Tooltip positioning libraries |
| Popover, invoker commands | Baseline 2025 | Production | Overlay JS |
| `sibling-index()` / `sibling-count()` | C138 / F154 / S26.2 | Emerging | JS stagger |
| `text-wrap: balance` | Baseline 2024-05 | Production | Balance-text scripts |
| `text-wrap: pretty`, `text-box` trim | No Firefox | Emerging | - |
| `shape()` | C135 / F148 / S18.4 | Emerging | Clip-path workarounds |
| Container style queries | Baseline 2026-05 | Emerging | - |
| Cross-document view transitions | C126 / S18.2, no Firefox | Emerging | SPA-only page transitions |
| Scroll-state queries, `interpolate-size`, `corner-shape`, scroll-triggered animations, element-scoped and nested view transitions, scroll-snap events, interest invokers | Chromium only | Experimental | - |
| Houdini `paint()` | Chromium only, stalled | Avoid | - |
| OffscreenCanvas | C69 / F105 / S16.4 | Production | Main-thread canvas work |

Interop 2026 focus areas include anchor positioning, scroll-driven animations, scroll snap,
`shape()`, view transitions and `contrast-color()`:
https://webkit.org/blog/17818/announcing-interop-2026/

**Consequence for the repository:** `selector.md` should gain a "native first" rung listing the
Production rows, because five of them remove a dependency the selector currently reaches for.

### 2.2 Graphics

- **WebGPU** is not Baseline. Chrome and Edge desktop, Chrome Android and Safari 26 ship it;
  Firefox ships on Windows and Apple Silicon macOS, not Linux or Android.
  https://web.dev/blog/webgpu-supported-major-browsers ,
  https://github.com/gpuweb/gpuweb/wiki/Implementation-Status . Label: Emerging, always with a
  WebGL2 path.
- **three.js WebGPURenderer and TSL**: three is r187, MIT. Secondary sources report an automatic
  WebGL2 fallback, but compute paths do not run there.
  https://www.utsubo.com/blog/webgpu-threejs-migration-guide . Whether it is officially
  "production ready" is **unverified** (sources conflict).
- **Size of three.js r187, gzip**: `three.core.min.js` 106 KB, `three.module.min.js` 90 KB,
  `three.webgpu.min.js` 124 KB. https://cdn.jsdelivr.net/npm/three@0.187.0/build/
- **Lighter engines** (npm registry and Bundlephobia, whole package before tree-shaking): twgl.js
  23 KB MIT; curtains.js 24 KB MIT; OGL 34 KB Unlicense; regl 38 KB MIT. Phenomenon and PicoGL
  are unmaintained. Theatre.js is stale (the selector already says avoid).
- **Raw GLSL heroes** need no library at all: https://alexharri.com/blog/webgl-gradients and the
  reverse-engineered Stripe gradient,
  https://www.bram.us/2021/10/13/how-to-create-the-stripe-website-gradient-effect
- **Assets**: KTX2/Basis is the only one of KTX2, Meshopt and Draco that reduces GPU memory; the
  other two reduce download only. https://app.cinevva.com/guides/optimize-glb-for-web (secondary).
- **SDF text**: troika-three-text, MIT, 46 KB gzip, actively published.
- **Gaussian splatting**: three.js r186 added a native splat renderer
  (https://github.com/mrdoob/three.js/releases/tag/r186); Spark is MIT
  (https://sparkjs.dev/docs/overview/). Label: Experimental for product UI.
- **Rive** runtime about 87 KB gzip, MIT. **dotLottie-web** 31 KB of JS plus a WASM file whose
  size was not measured.
- **detect-gpu**: 3 KB, MIT, but last published 2025-02 and its benchmark source stopped updating
  in December 2025; it also fetches data from a CDN by default.
  https://github.com/pmndrs/detect-gpu . Do not use it as the only quality gate.

### 2.3 Licensing

| Tool | Finding | Link |
|---|---|---|
| GSAP | Free for commercial use including former Club plugins; not open source; Webflow can terminate; barred from tools that compete with Webflow | https://gsap.com/community/standard-license/ |
| Motion | Library MIT; Motion+ is paid ($399 one person, teams per seat per year) | https://motion.dev/pricing |
| Rive | Runtimes MIT, no runtime fees; free editor plan exports with a splash screen; paid plans from $9 per seat per month | https://rive.app/pricing |
| Lottie | Both runtimes MIT | npm registry |
| Spline | Free plan watermarked; code export needs Pro; self-hosting Enterprise only; npm runtime has no licence field | https://www.spline.design/pricing |
| Unicorn Studio | Free plan is non-commercial; commercial licence $168 per year; SDK licence **unverified** | https://www.unicorn.studio/docs/pricing/ |
| apca-w3 | Restrictive "W3 License for Compliant Code Only" | https://raw.githubusercontent.com/Myndex/apca-w3/master/LICENSE.md |
| Kenney Interface Sounds | CC0, 100 files | https://kenney.nl/assets/interface-sounds |

Policy that follows: recipes default to native APIs and MIT/Unlicense libraries. GSAP stays
allowed with its licence note. Spline and Unicorn embeds are never a default; they need the
owner's paid plan and are recorded as a decision.

### 2.4 Case studies worth learning from

1. Bruno Simon, folio-2025: a drivable world as navigation, MIT source, compressed-texture build
   step. Portfolio-grade, not product-grade payload. https://github.com/brunosimon/folio-2025
2. Alex Harri, flowing WebGL gradient: noise plus gradient lookup, no library.
   https://alexharri.com/blog/webgl-gradients
3. GitHub homepage: a WebGL globe kept inside Core Web Vitals.
   https://github.blog/engineering/user-experience/making-githubs-new-homepage-fast-and-performant/
4. Shader.se: UI rendered inside the GPU pipeline so post-processing applies to it. Costs DOM
   accessibility.
   https://tympanus.net/codrops/2026/05/19/80s-business-tech-seamless-scene-transitions-inside-shader-ses-scroll-driven-webgpu-pipeline/
5. Infinite Liquid Glass Grid: cloth solver in TSL compute, no WebGL2 path.
   https://tympanus.net/codrops/2026/09/08/building-an-infinite-liquid-glass-grid-with-three-js-webgpu-and-tsl/
6. Jitter site: CSS `linear()` beside GSAP.
   https://tympanus.net/codrops/2025/09/02/a-behind-the-scenes-look-at-the-new-jitter-website/
7. Lusion, Oryzo: offline scenes brought to real time through splats.
   https://blog.lusion.co/oryzo-bts-part-2-7-3d-design-and-motion-graphics

Codrops pages returned 403 to direct fetch, so items 4 to 6 rest on search summaries. No
first-party engineering posts were found for Active Theory, Resn, Linear, Vercel or Stripe.

The pattern across the good ones: **one signature effect, built with the smallest possible
engine, on a page that works without it.** That is already the working agreements' "one
signature living visual"; the research supports it rather than changing it.

### 2.5 Interaction

- Physics: Rapier (Apache-2.0) compat builds are about 1.3 to 1.6 MB gzip because the WASM is
  inlined, so lazy-load. Matter.js MIT 26 KB, last published 2024-06.
- Gestures: `@use-gesture` is MIT but last published 2024-03. Prefer raw Pointer Events with
  `setPointerCapture` for simple drags.
- Haptics: Vibration API is Chrome and Edge only. The iOS switch-input trick is reported patched
  (by library authors, not confirmed by Apple). https://bugs.webkit.org/show_bug.cgi?id=285120 .
  Label: Experimental.
- Sound: Howler MIT 10 KB (last published 2023). Many "free" UI sound packs are CC-BY or forbid
  redistribution; only CC0 packs are safe to ship in recipes.
- FLIP is largely replaced by same-document View Transitions; its remaining niche is
  interruptible or concurrent moves.

### 2.6 Measurement

- **Thresholds**: good is LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1 at the 75th percentile of field
  data. https://web.dev/articles/vitals . A local run is lab data and must be labelled so.
- **web-vitals** 6.2.3, Apache-2.0, attribution build gives long-animation-frame attribution for
  INP. https://raw.githubusercontent.com/GoogleChrome/web-vitals/main/README.md
- **API reach**: LCP and Event Timing are in all three engines since late 2025; CLS and Long
  Animation Frames are Chromium only.
  https://web.dev/blog/lcp-and-inp-are-now-baseline-newly-available
- **Lighthouse** 13.6.0: default throttling is simulated; `--throttling-method=devtools` applies
  it for real. Simulated scores are not comparable across Lighthouse versions (secondary source).
  INP in user flows needs real clicks or keys.
  https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md ,
  https://github.com/GoogleChrome/lighthouse/blob/main/docs/user-flows.md
- **Chrome DevTools Protocol**: `Emulation.setCPUThrottlingRate`, `Emulation.setEmulatedMedia`,
  `Performance.getMetrics`, `Tracing.start` are stable.
  https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/json/browser_protocol.json
- **Frame pacing**: traces carry per-frame presented/dropped events.
  https://chromium.googlesource.com/chromium/src/+/HEAD/docs/life_of_a_frame.md . How
  `requestAnimationFrame` paces in headless mode is **unverified**, so the harness must record
  the GPU renderer string and whether it ran headed.
- **Software GPU**: automatic SwiftShader fallback is deprecated and must be opted into.
  https://chromium.googlesource.com/chromium/src/+/HEAD/docs/gpu/swiftshader.md . Frame numbers
  under a software renderer say nothing about real devices.
- **Memory**: memlab 2.0.6 (MIT) diffs heap snapshots across scripted scenarios; fuite 5.0.9
  repeats a navigation. GPU memory has no page API.
- **Energy**: no scriptable energy number was found for Chrome or Safari. Unmeasurable here.
- **Pixel diff**: Playwright `toHaveScreenshot`, pixelmatch 8 (ISC), odiff 4.5 (MIT).
- **Model judges**: pairwise comparison is more reliable than absolute scores, scores flip on
  re-run, and there is position bias. https://arxiv.org/pdf/2602.06013 ,
  https://arxiv.org/abs/2604.25235 , https://arxiv.org/pdf/2505.05026v1 . Designers themselves
  disagree substantially: https://arxiv.org/pdf/2511.20513v1 . This supports the existing blind
  pairwise design and argues for always swapping order and repeating.

### 2.7 Adaptive quality signals

- Runtime frame time is the only signal available in every browser. drei's `PerformanceMonitor`
  is the reference design (sample window, incline/decline/fallback callbacks).
  https://drei.docs.pmnd.rs/performances/performance-monitor
- `deviceMemory`, Battery Status, Compute Pressure, Network Information and
  `prefers-reduced-transparency` are Chromium only. `prefers-reduced-data` ships nowhere.
  https://developer.mozilla.org/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-data
- `prefers-reduced-motion`, `prefers-contrast`, `forced-colors` and `hardwareConcurrency` are
  available everywhere.

Consequence: tiers must be decided by **measured frames plus user preferences**, with hardware
hints only as a starting guess. This is what the mission asked for and it is also the only
design that works outside Chromium.

### 2.8 Colour, type, images, accessibility

- OKLCH is Baseline. Browsers clip out-of-gamut colours instead of reducing chroma, which shifts
  hue, so gamut mapping belongs in a build step. https://github.com/w3c/csswg-drafts/issues/9449
- Libraries: culori 4.0.2 (MIT), colorjs.io 0.7.1 (MIT), Leonardo (Apache-2.0).
- **Contrast roles**: WCAG 2.2 is the standard (https://www.w3.org/TR/WCAG22/). APCA was removed
  from the WCAG 3 draft and its replacement is undecided
  (https://adrianroselli.com/2026/04/wcag3-contrast-as-of-april-2026.html). So: **gate on WCAG
  2.x, report APCA as advisory at most**, and never claim APCA conformance.
- Colour-vision simulation: Machado 2009 for protan and deutan, Brettel 1997 for all three types.
  https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html . The npm
  packages are stale; the matrices are small enough to implement directly.
- Fonts: glyphhanger and subfont (MIT) for subsetting; fontaine and Capsize for fallback metrics.
  `ascent-override` does not work in Safari.
- Images: AVIF and WebP are Baseline. JPEG XL is not (no Edge). sharp 0.35.5 (Apache-2.0) covers
  AVIF and WebP; its JXL output is experimental. `sizes="auto"` has no Safari support.
  Placeholders: CSS-only LQIP (https://leanrada.com/notes/css-only-lqip/) or ThumbHash
  (https://evanw.github.io/thumbhash).
- Accessibility automation: axe-core 4.14 (MPL-2.0). Deque's own study puts automated coverage at
  57% of issues by volume
  (https://www.deque.com/blog/automated-testing-study-identifies-57-percent-of-digital-accessibility-issues),
  so a clean axe run is never "accessible". Scriptable WCAG 2.2 checks relevant to creative work:
  2.5.8 target size, 1.4.13 hover content, 2.2.2 pause control for motion over 5 s, and partly
  2.5.7 drag alternatives.

### 2.9 What an agent can and cannot honestly measure locally

Can: lab LCP, CLS and INP in Chromium with scripted real input; presented and dropped frames
with the renderer recorded; JS heap growth over repeated scenarios; transfer and bundle bytes;
pixel diffs; WCAG 2.x contrast, axe violations, target sizes, focus order, reduced-motion
behaviour; pairwise judge preference with order swapped.

Cannot, and must report as unmeasured: field vitals; real mobile GPU and thermal behaviour;
energy; per-page GPU memory; CLS and long frames in Safari and Firefox; the accessibility issues
automation misses; any absolute "design quality" score.

---

## 3. Proposed skill improvements

Ordered by value. None adds a skill.

| Skill or file | Change | Why |
|---|---|---|
| `shared/creative/selector.md` | Add a "native first" rung from 2.1 with support labels; add WebGPU guidance (always a WebGL2 path, no compute-only effects in products); add twgl and raw GLSL below OGL; note detect-gpu's frozen data | Removes dependencies; the selector is the highest-leverage file because every creative skill reads it |
| `audit-design` | New `--perf` mode (see 4.1), `--stress` mode (worst-case content, from `break-ui`), colour-vision and forced-colors passes, WCAG 2.2 checks 1.4.13 and 2.2.2, touch-emulated run | Closes most of the evaluation gaps in 1.3 with one runner users already know |
| `night-performance` | A web profile: uses the perf mode as its metric source, `night-keep: metric-up` with the noise band from repeated runs | Makes overnight performance work web-aware without a new loop |
| `build-animation` | Replace the prose frame governor with the shared quality runtime (4.2); add `workflows/review.md` from `review-animations`; move `hover-affordance.md` to `add-interactions`; add a framework-neutral cinematic-plate template beside the React one | One implementation, tested once |
| `build-3d` | Adopt the quality runtime; add asset rules (KTX2, Meshopt, lazy physics WASM); require renderer string in reports | Same |
| `improve-visuals` | Add an `explore` option to the first round: three divergent directions instead of one, judged pairwise, then continue as today (4.5); always swap judge order | Divergent exploration without a new skill |
| `build-ui`, `revamp-ui` | Call the colour and type helpers (4.6, 4.7) at the direction step; fold in `frontend-design`'s subject-grounding and self-critique | Systems instead of hand-picked values |
| `add-interactions` | Pointer-type branching as a rule (fine/coarse/none), 2.5.7 drag alternative required, recipes instead of re-derivation | Input diversity |
| `shared/creative/visual-loop.md` | Add a Measure step before Design (baseline) and motion evidence (4.8) to Capture | Baseline-first is in the mission and absent today |
| `shared/creative/learning.md` | New ledger kind `experiment` with the recipe it produced or why it was dropped | Feeds "successful experiments become recipes" |
| `replicate-design` | Map each captured effect to a recipe id when one exists | Reuse |
| `verify`, `review-changes` | Use the shared capture module | Removes triple implementation |

---

## 4. New capability candidates

Eleven candidates. One is a skill; the rest are helpers, recipes or eval tools, because of the
description budget (1.5). "Measure" lists what would be compared before and after; no result is
predicted.

### 4.1 Experience bench (eval tool)

- **Purpose**: one command that produces honest, repeatable lab performance evidence for a page
  and an interaction script.
- **Why**: every other proposal claims to improve or protect performance, and today nothing in
  the repository can check that claim. The Composer and the quality runtime both depend on it.
- **Novelty**: not Lighthouse-in-a-box. It replays a scripted interaction (scroll, hover path,
  drag, route change) and reports frame pacing and INP for *that* interaction, across a matrix,
  with spread.
- **Extends**: `audit-design/scripts/visual-audit.mjs` as `--perf`; `night-performance`.
- **Design**: Playwright plus CDP. Per condition: lab LCP, CLS, INP via web-vitals attribution;
  long animation frames; presented and dropped frames from a trace; JS heap after N repeats of
  the scenario; transfer bytes by type; renderer string; headed or headless. Matrix: viewport x
  theme x CPU throttle (1x, 4x) x motion preference x quality tier. At least 5 runs per cell,
  median and spread reported, changes inside the noise band reported as "no measurable change".
- **Frameworks**: any; it tests a URL.
- **Complexity**: medium (about 600 to 900 lines plus tests on fixture pages).
- **Performance implication**: none at runtime; dev-time only.
- **Accessibility**: includes reduced-motion and forced-colors conditions.
- **Measure**: on the three existing demos, baseline numbers recorded for the first time.
- **Validation**: fixture pages with a known injected long task, a known layout shift and a known
  leak must be detected; a no-op change must report "no measurable change".
- **Risks**: headless frame pacing is unverified, so frame metrics are reported only from headed
  runs with a hardware renderer, otherwise marked unknown. Lighthouse is optional, not required.
  Dependencies: `web-vitals` (Apache-2.0), existing Playwright.

### 4.2 Adaptive quality runtime (helper)

- **Purpose**: a small framework-neutral module that picks and maintains a quality tier (Ultra,
  High, Balanced, Low, Static) and tells effects what to do at each.
- **Why**: the mission's central performance idea, and the repository's frame governor shows the
  owner already wanted it. Today each heavy effect reinvents it or omits it.
- **Novelty**: tiers are a *contract*: every recipe declares what it renders at each tier, and
  Static is a designed still, not an absence. Starts conservative and climbs, so first paint is
  never paid for by the effect.
- **Extends**: `heavy-hero-performance.md` governor (median over a window, warm-up skip, reset
  after pauses, sticky verdicts), `build-3d`, `build-animation`.
- **Design**: plain ES module, no dependency, target under 2 KB gzip (to be measured, not
  promised). Inputs: user preferences (reduced motion forces Static or Low; `forced-colors`;
  Save-Data where present), a first guess from `hardwareConcurrency` and viewport pixels, then
  measured frame time. Outputs: a tier, a `data-quality` attribute for CSS, a change event, a
  URL override (`?quality=low`) for testing, and pause on hidden tab and offscreen. Hysteresis so
  it never oscillates. Thin adapters for React, Vue and Svelte are ten-line wrappers.
- **Frameworks**: all five targets.
- **Complexity**: medium; the logic is small, the tests matter.
- **Accessibility**: preferences outrank measurements; a user toggle recipe is included.
- **Measure**: with the bench, the same page at each forced tier and at CPU 4x; whether the
  runtime settles on a tier that holds the frame budget.
- **Validation**: unit tests with a fake clock (the governor's decisions are deterministic given
  frame gaps); bench runs per tier; screenshots per tier ("degradation rehearsal", 4.10).
- **Risks**: frame time is a late signal, so the first seconds must be cheap by design.

### 4.3 Experience Composer (skill)

The one new skill. Full design in section 5.

### 4.4 Recipe catalog (recipes)

Runnable versions of the technique sheets. Full design in section 6.

### 4.5 Direction lab (mode)

- **Purpose**: prototype three genuinely different directions fast, compare them on evidence,
  keep one.
- **Why**: it is the mission's "creative experimentation", and the cheapest way to avoid
  polishing a mediocre direction.
- **Novelty**: directions are forced apart on named axes (type voice, colour temperature,
  density, motion intensity, signature visual) so they cannot converge; each is built in its own
  worktree by a cheaper agent; judged blind pairwise *and* gated by the bench.
- **Extends**: `improve-visuals` (judging, keep-list), `codex-orchestration.md`, `coordinate-agents`.
- **Type**: mode (`improve-visuals explore`, reachable as `/experience experiment`).
- **Complexity**: low to medium; mostly orchestration prose plus a small "direction card" format.
- **Measure**: judge preference with order swapped; bench deltas per direction.
- **Risks**: token cost of three builds. Bounded to first viewport plus one interaction per
  direction. Uses Codex or Claude subagents only, no paid API.

### 4.6 Colour system builder (helper + eval)

- **Purpose**: generate a full token set from one or two brand colours: OKLCH scales, light and
  dark themes, semantic roles, gamut-mapped sRGB and P3 values, with contrast checked at build.
- **Novelty**: generation and verification in one script; colour-vision simulation and
  "meaning never by colour alone" checks; outputs plain CSS custom properties, so every
  framework can use it.
- **Extends**: `build-ui`, `revamp-ui`, `audit-design` contrast check.
- **Design**: Node script using culori (MIT) as a dev-time dependency of the script, never of the
  user's app. WCAG 2.x is the gate; APCA is not shipped by default because of its licence, and
  if added later is advisory only.
- **Complexity**: medium. **Measure**: contrast failures before and after on a real project;
  pairs that become indistinguishable under simulation.
- **Risks**: must respect existing design systems: it proposes tokens, it does not overwrite.

### 4.7 Type system helper (helper)

- **Purpose**: fluid type scale with `clamp()`, measure and line-height rules, fallback-metric
  overrides to stop font-swap layout shift, subsetting advice, `text-wrap` use.
- **Extends**: `build-ui`, `revamp-ui`, rubric dimension 2.
- **Complexity**: low. **Measure**: CLS attributable to font swap, font transfer bytes.
- **Risks**: `ascent-override` has no Safari support; state it.

### 4.8 Motion evidence (eval tool)

- **Purpose**: make motion reviewable: a filmstrip of an interaction, an inventory of running
  animations, and checks for the motion rules in the working agreements.
- **Novelty**: detects, from `document.getAnimations()` and frame sequences, loops that restart
  visibly, two-step transitions, animation of layout properties, motion that continues offscreen
  or in a hidden tab (closing an open question), and motion over 5 s without a pause control.
- **Extends**: `visual-audit.mjs`, `visual-loop.md`, `build-animation` review.
- **Complexity**: medium. **Measure**: defects found on existing demos.
- **Risks**: screenshot sequences are not real-time video; label them as sampled frames.

### 4.9 Spring and easing generator (helper)

- **Purpose**: turn spring parameters (stiffness, damping, mass) into a CSS `linear()` curve and
  duration, so springs need no runtime library.
- **Extends**: `spring-feedback` technique, `add-interactions`.
- **Complexity**: low (a pure function with unit tests). **Measure**: bytes removed where a
  motion library was used only for springs.

### 4.10 Degradation rehearsal (eval tool)

- **Purpose**: force every tier, every preference and JS-off, screenshot each, and fail if any
  state is broken, blank or undesigned.
- **Why**: fallbacks are the least-tested code in creative work. "Reduced motion still feels
  designed" is in the rubric but unchecked.
- **Extends**: the quality runtime's URL override, `visual-audit.mjs`.
- **Complexity**: low once 4.1 and 4.2 exist.

### 4.11 Asset pipeline helper (helper)

- **Purpose**: one script for responsive AVIF/WebP sets, placeholders, video poster frames and
  KTX2 texture compression, emitting the `<picture>` markup.
- **Extends**: `create-visuals`, `media-reveals`, `build-3d`.
- **Design**: uses sharp (Apache-2.0) if the project has it; otherwise prints what to install.
  Never installs globally.
- **Complexity**: low to medium. **Measure**: image transfer bytes and LCP before and after.

### 4.12 Ideas beyond the brief

| Idea | What it is | Why it matters | How it differs |
|---|---|---|---|
| **Experience budget file** | `.experience/budget.json` in the project: budgets per metric, the accepted trade-offs with their reason and date | Turns "justified trade-off" from a sentence in a report into a checked contract that night loops must respect | Lighthouse budgets cover load only; this covers interaction frames, memory and approved exceptions |
| **Interaction scripts as fixtures** | A tiny declarative format for a pointer path, scroll or drag, replayed by the bench | The same gesture, identically, before and after; makes INP and frame claims comparable | Most tooling measures load, not a designed gesture |
| **Cost labels on recipes** | Each recipe carries its measured cost per tier on the reference machine, with date and renderer | Lets the Composer choose by evidence and say "this costs X here" | Technique sheets today describe performance in words |
| **Effect ablation** | The bench toggles each effect off in turn and reports its marginal cost | Finds the one effect that costs most of the budget | Whole-page numbers cannot assign blame |
| **Keep-list as a guard** | The owner's liked elements are captured as locked screenshots that later rounds must not change beyond a threshold | Enforces "never replace a design the owner liked" mechanically | Today the keep-list is prose |
| **Signature visual brief** | A one-page card per product: the one living visual, its still, its tiers, where it may appear | Stops multiple competing hero effects accumulating over nights | Prevents effect sprawl rather than adding effects |
| **Sound and haptics, opt-in** | Recipes exist but are off by default, user-initiated, CC0 assets only | Real differentiator when wanted; harmful when imposed | Labelled experimental, never auto-applied |

---

## 5. Experience Composer

### 5.1 Shape

A single skill, `experience`, that **decides and delegates**. It contains no design guidance of
its own; that stays in `shared/creative/` and the existing skills. This keeps it short and means
improvements to the underlying skills reach it automatically.

Frontmatter sketch (description kept under 200 characters to fit the budget):

```yaml
name: experience
description: One entry point for making a web product look, feel and perform better. Audits,
  then runs the smallest set of creative skills that fits. Use for "/experience" or "make this
  site next level".
metadata:
  aliases: [experience-composer]
  composes: [audit-design, improve-visuals, revamp-ui, build-ui, add-interactions,
             build-animation, build-3d, create-visuals, replicate-design, verify]
  requires: [playwright?, codex-bridge?]
  risk: medium
```

### 5.2 Modes

Follows the repository's `/skill mode` convention (as in `/night tests`).

| Command | Does | Delegates to | Writes code |
|---|---|---|---|
| `/experience audit` | Baseline: visual audit plus bench, ranked findings, proposed plan | `audit-design` (+ `--perf`) | No |
| `/experience polish` | Same direction, better execution | `improve-visuals`, colour and type helpers | Yes |
| `/experience transform` | New direction | Direction lab, then `revamp-ui` | Yes |
| `/experience cinematic` | One signature moment | `build-animation` or `build-3d`, quality runtime, `styles/cinematic` if chosen | Yes |
| `/experience interactions` | Interaction layer | `add-interactions`, recipes | Yes |
| `/experience performance` | Faster at equal or better looks | Bench, ablation, asset helper, quality runtime | Yes |
| `/experience experiment` | Three directions, compare, stop for a choice | Direction lab | Prototypes only |
| `/experience full` | Audit, then the modes the audit justifies, in order | All of the above | Yes |

With no mode it runs `audit` and proposes one.

### 5.3 The thirteen steps

1. **Inspect** purpose, users, surface mode, brand, design system, framework, existing budgets
   and keep-list.
2. **Baseline**: visual audit and bench. No change is made before this exists.
3. **Diagnose**: rank findings by user impact; separate taste findings from measured ones.
4. **Choose intensity** from `adaptation.md` (0 to 4) and say why.
5. **Select** the smallest skill and recipe set (5.4).
6. **Plan** with explicit budgets; state any trade-off before making it.
7. **Explore** directions only when the mode or the diagnosis calls for it.
8. **Implement**, directly or through Codex in a worktree for larger slices.
9. **Capture** after-state screenshots and motion evidence in both themes.
10. **Measure** again with the same matrix.
11. **Judge** blind and pairwise for looks; compare numbers for performance and accessibility.
12. **Decide**: keep, revise or revert, by the policy in section 9.
13. **Report and learn**: evidence, what was not validated, ledger entries, recipe candidates.

### 5.4 Selection logic

Decision order, first match wins for the primary skill; helpers attach by need.

| Signal from inspect and baseline | Primary | Attach |
|---|---|---|
| Blocker or major findings in the audit | Fix those first through `improve-visuals` guardrail fixes | - |
| Bench shows a budget breach | `performance` mode | Ablation, asset helper |
| No UI yet | `build-ui` | Colour, type helpers |
| Owner says "different", or rubric median is low on hierarchy, type and colour together | Direction lab then `revamp-ui` | Colour, type helpers |
| Direction is fine, finish is not | `improve-visuals` | - |
| Flat, static feel; states missing | `add-interactions` | Spring generator, recipes |
| No signature visual, surface is Persuade | `create-visuals` or `build-animation` | Quality runtime |
| 3D or shader explicitly wanted, or reference demands it | `build-3d` | Quality runtime, asset helper |
| A reference is supplied | `replicate-design` | Recipes by mapped id |

Rules that bound it:

- Surface mode caps intensity: Operate products do not get cinematic treatment unless asked.
- At most one new signature effect per run.
- Never more than the diagnosis justifies; `full` is a sequence, not "everything".
- Anything on the keep-list is out of scope unless the owner says otherwise.
- Native rung of the selector first; a dependency needs a stated reason.

### 5.5 What it does not do

It does not publish, deploy, call paid APIs, install global packages, or edit skills. It does
not replace the direct skills: users who know what they want still call `/improve-visuals`.

---

## 6. Reusable recipe catalog

### 6.1 Architecture

```
shared/creative/recipes/
  README.md                 index, how to use, licence table
  _runtime/quality.js       the adaptive quality runtime (4.2)
  _runtime/spring.mjs       spring to linear() generator (4.9)
  <recipe-id>/
    recipe.md               the card (fields below)
    recipe.css / recipe.js  framework-neutral source, no build step, no dependency by default
    demo.html               runs from file://, both themes, tier switch
    adapters.md             short notes for React, Next.js, Vue, Svelte
    recipe.test.mjs         node:test, audit and bench expectations on the demo
```

Principles:

- **Copy-in, not installed.** A recipe is source the agent copies and adapts to the project's
  tokens and conventions. There is no package, no version to track in user projects, and no
  component framework. This is what keeps it light.
- **Web-standard core.** CSS first, then a small ES module, optionally a custom element. Those
  run unchanged in all five target stacks; adapters only cover lifecycle (mount, cleanup, SSR
  guard).
- **Each recipe is a technique sheet made runnable.** The existing eight sections stay; the card
  adds the fields the mission asks for.
- **Tiers are mandatory.** No recipe is accepted without a designed Static state.

### 6.2 Recipe card fields

`id`, purpose, product types and surface modes it suits (and where it is wrong), technique and
engine rung, framework compatibility, dependencies and licence, performance notes plus measured
cost label (date, machine, renderer; `unknown` until measured), accessibility (keyboard, touch,
screen reader, reduced motion, forced colors), tier table (Ultra to Static), customization
options (tokens and parameters), visual examples (real screenshots of the demo, both themes),
tests, browser support label, provenance and attribution.

### 6.3 Initial catalog (proposed order)

Chosen to cover the spectrum with the least code and to start on the native rung.

| # | Recipe | Engine | Spectrum area | From technique |
|---|---|---|---|---|
| 1 | Spring states (hover, press, enter, exit) | CSS `linear()`, `@starting-style` | Interaction | spring-feedback |
| 2 | Shared-element route transition | View Transitions | Motion | shared-element-transitions |
| 3 | Scroll progress and reveal | Scroll-driven animations with IntersectionObserver fallback | Motion | scroll-choreography |
| 4 | Cursor light | CSS custom properties, pointer events | Interaction | cursor-light |
| 5 | Magnetic target | Pointer events, fine pointers only | Interaction | magnetic-hover |
| 6 | Flowing gradient hero | Raw GLSL, still-first, tiered | Visuals | shader-distortion |
| 7 | Kinetic headline | Variable font axes via `@property` | Typography | kinetic-typography |
| 8 | Media reveal with placeholder | AVIF/WebP, LQIP, `content-visibility` | Visuals | media-reveals |
| 9 | Staggered list | `sibling-index()` with fallback | Motion | - (new) |
| 10 | Anchored tooltip and popover | Popover, anchor positioning with fallback | Interaction | - (new) |
| 11 | Drag with keyboard and single-pointer alternative | Pointer capture | Input diversity | drag-interactions |
| 12 | Particle field | Canvas 2D or OGL by tier, OffscreenCanvas | Visuals | fluid-particles |

Later, after the first twelve prove the format: depth parallax, organic masks, interactive
diagram, environmental lighting, scene transition, tilt, sound and haptics (opt-in).

### 6.4 How experiments become recipes

A direction-lab or night experiment that is kept, passes its guardrails and is judged better is
logged as kind `experiment` in the ledger. `night-evolve-skills` may *draft* a recipe from a
repeated pattern on a branch. A person approves it. Nothing is promoted automatically.

---

## 7. Prioritized roadmap

Scores are judgement, 1 (poor) to 5 (best); for effort and maintenance, 5 means cheap.

| Rank | Item | User value | Reuse | Creative potential | Perf impact | Effort | Maintenance | Compatibility |
|---|---|---|---|---|---|---|---|---|
| 1 | Experience bench (4.1) + `night-performance` web profile | 4 | 5 | 2 | 5 | 3 | 4 | 5 |
| 2 | Adaptive quality runtime (4.2) + degradation rehearsal (4.10) + first six recipes | 5 | 5 | 4 | 5 | 3 | 3 | 5 |
| 3 | Experience Composer (4.3) with direction lab (4.5) | 5 | 4 | 5 | 3 | 3 | 4 | 5 |
| 4 | Selector native-first update and remaining six recipes | 4 | 5 | 4 | 4 | 4 | 3 | 4 |
| 5 | Motion evidence (4.8) + animation review workflow | 4 | 4 | 3 | 3 | 3 | 4 | 5 |
| 6 | Colour system builder (4.6) | 4 | 4 | 3 | 1 | 3 | 4 | 5 |
| 7 | Audit stress mode and input-diversity checks | 3 | 4 | 1 | 1 | 4 | 4 | 5 |
| 8 | Type helper (4.7), spring generator (4.9) | 3 | 4 | 3 | 2 | 5 | 5 | 4 |
| 9 | Asset pipeline helper (4.11) | 3 | 3 | 2 | 4 | 3 | 3 | 5 |
| 10 | Shared capture module, overlap clean-up | 2 | 4 | 1 | 1 | 4 | 5 | 5 |
| 11 | Budget file, ablation, keep-list guard (4.12) | 3 | 3 | 2 | 4 | 3 | 3 | 5 |
| 12 | WebGPU/TSL, splats, sound, haptics recipes | 2 | 2 | 5 | 1 | 2 | 1 | 2 |

### 7.1 Recommended first three

The brief suggested Composer, Adaptive Visual Runtime, Creative Interaction Lab, and asked for
that to be challenged. After reading the repository I recommend a different order and one
substitution.

1. **Experience bench first.** It is an upgrade to an existing skill, not a new one. The
   repository's strongest habit is evidence, and performance is the one place it has none. The
   Composer's steps 2, 10 and 12 and the runtime's tier contract cannot be honest without it.
   Building it first also gives the first real baseline of the existing demos.
2. **Adaptive quality runtime with its first six recipes.** This is where the visible quality
   jump comes from, and it is the piece most reusable across the owner's projects. It ships with
   the rehearsal check so fallbacks are proven, not assumed.
3. **Experience Composer, thin, with the direction lab inside it.** With measurement and recipes
   in place the Composer is mostly routing, which is cheap to write and easy to keep correct.
   Built first, it would be a router over prose with nothing to measure against.

The "Creative Interaction Lab" does not get its own slot: its content is recipes 1, 4, 5, 10 and
11 plus the direction lab, which arrive in items 2 and 3.

### 7.2 Why the others wait

- **Motion evidence, colour builder, type helper**: valuable and independent, but none unblocks
  another item. Next after the top three.
- **Stress mode and input checks**: small; fold into the bench work if time allows.
- **Asset helper**: its value shows only once the bench can measure LCP and bytes.
- **Overlap clean-up**: no user-visible gain; do it when touching those files anyway.
- **WebGPU, splats, sound, haptics**: support and tooling are not there (2.2, 2.5). Demos only.

### 7.3 Sequence if approved

Phase 2a bench (fixtures, tests, baseline of demos). Phase 2b runtime, rehearsal, recipes 1 to 6.
Phase 2c Composer, direction lab, routing evals, description trims. Each phase ends on its own
branch with tests and a short evidence report, and stops for review.

---

## 8. Demonstration plan

Three experiences, deliberately unlike each other, to show the toolkit adapts instead of
imposing a look. Not built in Phase 1. Each is static, runs from `file://`, has no network
requests, and ships with its bench report, tier screenshots and audit output.

| | Demo A: "Signal" | Demo B: "Field Notes" | Demo C: "Lantern" |
|---|---|---|---|
| Surface mode | Operate | Read | Persuade |
| Fictional product | Live operations console | Long-form illustrated essay | Product launch page |
| Art direction | Dense, precise, monochrome with one status accent | Warm paper, large serif, wide margins | Dark, layered, one glowing signature visual |
| Intensity | 1 | 2 | 4 |
| Engine | Native only, zero library bytes | Native plus variable fonts | Raw GLSL hero, tiered |
| Shows | Spring states, anchored popovers, shared-element drill-in, staggered rows, numbers counting up | Scroll-driven progress and reveals, kinetic headline, media reveal with placeholders | Flowing gradient hero, cursor light, magnetic targets, scene transition, live tier switch |
| Proves | Premium without spectacle; keyboard-first | Typography and pacing as the experience | Cinematic at Ultra and still designed at Static |
| Stack variant | Plain HTML | Plain HTML, plus one section as a Svelte adapter example | Plain HTML, plus the hero as a React adapter example |

Each demo page carries a small panel: current tier, why it was chosen, and a control to force
any tier or preference. The evidence report for each lists what was measured, on which machine
and renderer, and what was not validated.

Relation to the existing `demos/creative/` studies: those stay as technique studies. The new
three live in `demos/experience/` and are the first consumers of recipes and runtime. First task
of Phase 2 is to get a browser launching here so both sets can be audited for real, since the
existing demos' browser verification is still recorded as outstanding.

---

## 9. Measurement and validation

### 9.1 Protocol

1. Baseline before any change, same commit, same machine, same matrix.
2. Matrix: 3 viewports x 2 themes x CPU 1x and 4x x motion preference x forced tier, plus one
   scripted interaction per page. Trim cells that cannot differ, and say which were trimmed.
3. At least 5 runs per cell; report median and spread; a difference inside the spread is "no
   measurable change".
4. Record machine, OS, browser version, headed or headless, renderer string, throttle method.
5. Looks are judged blind and pairwise, order swapped, on real screenshots.
6. Every report ends with "Not validated" listing what could not be measured (see 2.9).

### 9.2 Decision policy

- **Keep** when looks are judged better and no budget is breached, or when performance improves
  beyond noise and looks are judged equal or better.
- **Keep with a recorded trade-off** when looks improve, a metric worsens beyond noise but stays
  inside the project's budget, and the report states the cost. The trade-off is written to the
  budget file.
- **Revert** on any audit blocker or major, a budget breach, a broken Static or reduced-motion
  state, a new accessibility violation, or a change to a keep-list element.
- **Report as a limitation**, never as a pass, anything unmeasured.

Default budgets when a project has none (lab, mid-tier throttle): the Core Web Vitals "good"
thresholds from 2.6, no dropped-frame regression beyond noise on the scripted interaction, no
heap growth across repeats, no increase in blocking transfer bytes without a stated reason.
Projects override these in their budget file.

### 9.3 Checks for this toolkit itself

`node scripts/validate.mjs`, `node --test tests/*.test.mjs`, routing evals for the new
`experience` skill (held-out cases must not drop for existing skills), recipe tests, and the
bench's own fixture tests. Pre-existing failures (1.6) are listed separately in every report.

### 9.4 Agents and overnight work

| Work | Agent | Bounds |
|---|---|---|
| Direction, diagnosis, review, keep or revert | Claude | - |
| Recipe and bench implementation from a written brief | Codex in a worktree via `codex-bridge` | One slice per brief; Claude reviews the diff and reruns checks |
| One measured fix per iteration | `night-performance` (web profile), `night-visual`, `night-accessibility` | Existing supervisor: isolated branch, independent verification, revert on regression, no push |
| Recipe drafts from repeated ledger patterns | `night-evolve-skills` | Draft on a branch only; a person approves; held-out evals stay green |

No loop publishes, promotes a recipe, or edits its own engine. Everything a night run does is a
commit on a run branch that can be dropped.

### 9.5 Third-party material

The vendored skills in `vendor/` are not installed and `getsentry/skill-scanner` has not been run
on them. Before any content is adopted: read each file fully, run the scanner, confirm licence
and add NOTICE and `docs/SOURCES.md` entries, per the existing policy. Until then section 3
refers to them only as sources of ideas.

---

## 10. Decisions needed from the owner

1. **Approve Phase 2?** Options: (a) the recommended top three in order, one phase at a time;
   (b) the brief's original order; (c) bench only, then reassess.
2. **Base branch.** The creative layer is on `feat/improve-visuals`, vendor material on
   `docs/future-skills`, and `main` has neither. Options: (a) merge `feat/improve-visuals` to
   `main` first and build from there (recommended); (b) keep building on top of
   `feat/improve-visuals`.
3. **New skill name.** `experience` (recommended, matches the brief) or fold the Composer into
   `revamp-ui` as modes and add no skill. The first needs about 200 characters trimmed from
   other descriptions.
4. **Dev-time dependencies** for scripts only: `web-vitals` and `culori`. Options: (a) allow as
   optional, detected like Playwright is today (recommended); (b) implement without them.
5. **GSAP** stays allowed with its licence note, or becomes opt-in only? Recommended: stays as is.
6. **Demos**: three new ones in `demos/experience/` (recommended) or upgrade the existing three.
