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

## Stage 3: experience composer — pending
## Stage 4: demos and integration — pending
## Stage 5: validation and review — pending

## Commits

- db4f1f4 Stage 1: foundation and experience bench

## Codex findings

## Remaining work

Stages 3–5.
