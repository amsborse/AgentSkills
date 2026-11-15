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

## Stage 2: adaptive quality runtime — pending
## Stage 3: experience composer — pending
## Stage 4: demos and integration — pending
## Stage 5: validation and review — pending

## Commits

## Codex findings

## Remaining work

Stages 2–5.
