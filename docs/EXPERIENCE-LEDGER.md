# Experience engineering: ledger

Branch `feat/experience-engineering` (worktree `AgentSkills-worktrees/experience`), base 633422e.
Nothing is pushed. Decisions: `EXPERIENCE-DECISION-QUEUE.md`.

## Stage 1: foundation and experience bench

- Done: base integrated (D-001); `audit-design` gains `--perf` (`scripts/perf-bench.mjs`, logic
  in `scripts/lib/bench.mjs`); fixtures; `tests/perf-bench.test.mjs`; docs in `audit-design`,
  `night-performance`, `shared/creative/visual-loop.md`.
- Tests: `tests/perf-bench.test.mjs` 19 pass, 0 fail with Chromium 153 headless
  (`PLAYWRIGHT_PROJECT` set); 7 browser tests skip without it.
- Bench check, headless Chromium, software renderer, 3 runs, desktop 1280×800, median:

  | Fixture | LCP | CLS | INP | Long task time | Dropped frames | Heap growth per repeat | Exit |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | clean | 24 ms | 0 | 16 ms | 0 ms | 0% | 14.6 KB | 0 |
  | slow (planted defects) | not recorded here | 0.017 | 304 ms | 1686 ms | 44% | 796 KB | 3 |

- Not validated: `web-vitals` path (D-004); headed and GPU runs; Firefox and WebKit (heap, CPU
  slowdown and bytes are Chromium-only).

## Stage 2: adaptive quality runtime

- Done: `shared/creative/recipes/_runtime/quality.js` (five tiers: static, low, balanced, high,
  ultra; reduced motion > explicit choice > data saver > measured frame pacing > device hints;
  loops pause offscreen and in hidden tabs); six recipes with CSS, script, demo and `recipe.md`
  (spring-states, scroll-reveal, route-transition, cursor-light, magnetic-target, flow-hero);
  `recipes/README.md`, `recipes/adapters.md` (D-005).
- Fixed while measuring: the runtime never stepped down on a very slow device, because slow
  frames were discarded as pauses and a 60-frame window took too long to fill. Windows now close
  on time (2 s, 12 frames minimum) and three long gaps in a row count as a stall. Regression
  tests added. Scroll reveal faded content out on load on the script path; fixed and tested.
- Tests: `tests/quality-runtime.test.mjs` 26 pass; `tests/recipes-browser.test.mjs` 8 pass
  (Chromium headless, fallback modes included). Whole suite: 211 pass, 0 fail, 0 skipped.
- Bench, headed Chromium, RTX 2070 Max-Q, 300 Hz, 1280×800, 3 runs: all six demos on all tiers
  p95 frame 3.4–3.7 ms, worst under 10 ms, no long tasks, heap 0.79–0.93 MB. This machine cannot
  rank the tiers; automatic mode settles on high.
- Bench, flow hero, headless software renderer (worst case), 1× pixels, pinned tiers:

  | Tier | Frame rate | p95 frame | Long tasks |
  | --- | --- | --- | --- |
  | static | 60 fps (no canvas) | not applicable | none |
  | low | 60 fps page, shader at 30 | within budget | none |
  | balanced | 47–48 fps | 33.4 ms | none |
  | high | 29–31 fps | not recorded here | 63 ms |
  | ultra | 20 fps | 66.6 ms | 2,279 ms |

  Automatic mode on the same renderer at 2× pixels: high → balanced by about 4.5 s → low by
  about 8.5 s (before the fix it was still on high at 8.5 s).
- Not validated: real low-end phones and integrated GPUs; Firefox and WebKit; the framework
  wrappers in `adapters.md` are patterns, not tested code.

## Stage 3: experience composer — done

- New skill `skills/experience/SKILL.md`: decides and delegates only. Eight modes (audit, polish,
  transform, cinematic, interactions, performance, experiment, full), 13 steps, a selection
  table from audit signals to one primary skill plus recipes, and bounding rules (native first,
  one signature effect per run, keep-list out of scope, quality runtime for anything continuous).
- New workflow `skills/improve-visuals/workflows/explore.md`: three directions forced apart on
  eight axes (no two share more than two positions), direction cards before code, bounded
  prototypes, blind pairwise comparison with two seeds including the current design, then stop
  for the owner's pick. `transform` requires the owner to have asked for a redesign.
- Catalog budget (name + description, `tests/catalog-routing.test.mjs`, limit 16,000): 15,966
  with 45 skills. Made room by trimming 233 description characters from review-changes, night,
  research, run-autonomous, working-agreements, manage-skills and production-ready without
  removing a trigger phrase.
- Routing: the bare word "experience" is not an alias or keyword (it scored 13 on "improve the
  user experience of the API docs"); mode phrases and "next level" / "three directions" are.
  Held-out creative eval unchanged at 12/20 top-1.
- Tests: `tests/experience-skill.test.mjs` (registry entry, composed skills exist, referenced
  paths exist, modes and redesign guard, explore rules, routing incl. the negative case).
  Full suite 226 pass, 0 fail, 0 skipped.
- Not validated: the composer has not been run end to end by an agent on a real product; that
  is exercised partly by the Stage 4 demos and otherwise remains open.

## Stage 4: demos and integration — done

- Three demos in `demos/experience/` plus an index: **Signal** (service console: dense, mono,
  spring-states + route-transition), **Field Notes** (essay on warm paper: scroll-reveal,
  spring-states, cursor-light) and **Lantern** (landing page with a tiered shader sky:
  flow-hero, magnetic-target, cursor-light, scroll-reveal). A test asserts they share no
  typeface, background or accent.
- Evidence: `demos/experience/README.md` (per-tier bench table, method, limits) and
  `demos/experience/screenshots/` (12 real captures: desktop and phone, light and dark).
- Bench (lab, headless Chromium 153, SwiftShader software renderer, 1440×900, 3 runs, medians):
  Signal and Field Notes LCP 92–124 ms, CLS 0, no long tasks, 16.7 ms frames on every tier,
  about 40 KB transferred. Lantern: static 16.7 ms p50; low 16.7 / 33.3 p95; balanced 33.3;
  high 50.0; ultra 66.7 (p95 83.4), 53.1 KB. Automatic: high → balanced at about 4.2 s → low at
  about 7.8 s. INP not measured.
- `audit-design` passes on all three (both sizes, both themes): 0 blocker, major or minor.
- Defects found by the demos and fixed, each with a regression test that failed first:
  - `_runtime/quality.js` `loop()`: the observer's default margin was 100px, so a canvas kept
    drawing just off screen, and at exactly 0px an edge-touching element still counts as
    intersecting. Default is now `-1px`.
  - Signal painted its table empty on a slow processor and shifted when rows arrived (CLS
    0.023). The page script now runs before the library files are fetched; CLS 0.
- Catalog integration: `shared/creative/README.md` and `selector.md` point to the recipes; nine
  technique pages carry a "Ready-made recipe" line; `recipes/README.md` points to the demos.
- Tests: `tests/experience-demos.test.mjs` (10, real browser). Full suite 236 pass, 0 fail.
- Not validated: real GPUs and phones, Safari, Firefox, INP, throttled network; the demos are
  plain HTML, so framework wrappers remain documented patterns only.
## Stage 5: validation and review — pending

## Commits

- db4f1f4 Stage 1: foundation and experience bench
- 3b98214 Stage 2: adaptive quality runtime and six recipes
- f12f8aa Stage 3: experience composer skill and three-direction explore workflow
- Stage 4: experience demos, catalog integration, two runtime fixes (this commit)

## Codex findings

## Remaining work

Stage 5: full validation, discovery failures (D-002), independent Codex review, final report.
