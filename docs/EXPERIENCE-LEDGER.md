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
## Stage 5: validation and review: done

- Full suite with a real browser (`PLAYWRIGHT_PROJECT` set): 243 pass, 0 fail, 0 skipped.
- `node scripts/validate.mjs` from this worktree: all checks passed, exit 0, with two warnings
  that are true until the branch is merged: installation is checked against the primary
  checkout, and `experience` cannot be installed from a worktree. Description budget 15,385 of
  16,000 characters. Before the fixes below the same run had 6 failures.
- Fixed: `skills/experience/SKILL.md` pointed at a workflow file that lives in another skill.
- Fixed (D-002): the OpenCode and Cursor discovery failures came from running validate in a
  worktree; the check is now worktree-aware and still fails a missing link.
- Fixed (D-004): the `web-vitals` path could never activate; now verified against 6.2.3.
- Independent Codex review (read-only, `codex-bridge review --base main`, one call): five
  findings, all confirmed, all fixed with a test that failed first. See "Codex findings".
- Not re-measured after the runtime fix: the bench numbers in `demos/experience/README.md`
  (the change only affects pages whose long frame gaps recur; the demo tests still pass).
- Not validated: real GPUs and phones, Safari, Firefox, INP in the demos, throttled network.

## Phase 3, stage 1: integration — done

- `main` fast-forwarded to `feat/experience-engineering` at 9bd3fed (7 commits, no merge
  commit, working tree clean before and after). Not pushed.
- From `main`: full suite 243 pass, 0 fail, 0 skipped; `validate.mjs` exit 0.
- Installer: 45 skills linked for 4 agents, 0 conflicts. `experience` is linked in
  `~/.claude/skills`, `~/.claude-work/skills` and `~/.agents/skills`.
- Invocation, tested by asking each agent to load the skill and list its modes:
  - Codex: verified. It was offered the skill in its catalog, loaded
    `~/.agents/skills/experience/SKILL.md` and listed all eight modes.
  - Claude Code: verified (listed in the session and invoked through the Skill tool in stage 3).
  - OpenCode: not verified. The run failed with "This API key has expired" (D-009).
  - Cursor: not verified. No headless agent command on this machine (D-009).
- Found: the `codex` command shim outside the repository is stale (D-008); `install.mjs` has
  no help flag, so `--help` runs an install.

## Phase 3, stage 2: real browser and hardware validation — done, with limits

Environment: headed Chromium 153, renderer ANGLE NVIDIA GeForce RTX 2070 Super with Max-Q on
Direct3D 11 (hardware acceleration confirmed from the renderer string), Core i7-10750H, 16 GB,
Windows 11, 300 Hz display. Phone results are a touch viewport in the desktop browser, never a
real device. Full figures: `demos/experience/README.md`, "Measured".

- Measured: 21 cells (3 demos × base in both themes and both viewports, five tiers, reduced
  motion, processor slowed 4×, slow 4G, Firefox, WebKit), 5 runs each (3 for slow 4G and the
  other engines), with a scripted interaction session per demo so INP is real.
- Result: every Chromium cell is inside the budgets. Tier differences on this GPU are smaller
  than run-to-run spread. Field Notes' scroll effects cost a few late frames at 300 Hz. INP under
  a 4× slowed processor is 72–120 ms on Signal, the tightest cell.
- Bench work this stage needed: `--browser`, `--network`, a `tap` step, sizes without the
  DevTools protocol, layout-shift sources in the report, and an observed frame timing drift
  note (`frameRateDrift`). Frame intervals alone cannot establish a display-rate change. Each
  has a test.
- Incidents, all reported rather than smoothed over:
  - The first matrix run was killed for low memory; it was restarted once memory was free.
  - Timing slowed to about 30 frames a second during the Lantern tier cells. Those cells were
    discarded and re-measured. The original session attributed this to the display, but frame
    intervals alone cannot establish that cause; the drift note above records the observation.
  - During the re-measure other programs took free memory to about 470 MB: two Lantern runs lost
    their page and one stalled at about 1 fps. The original "4 of 5" included-run claim cannot
    be verified without the raw Lantern reports; included counts for high and balanced are unknown.
  - Firefox headed stalled or crashed in about one run in four. Cause unknown.
  - Playwright WebKit crashes on Signal when a real key press or click goes back through the
    view transition. Seven probes: not reproducible from script, on `static`, on the forward
    transition, or on cut-down pages. Recorded as an engine-build fault; Safari itself is
    unverified (D-012).
  - Signal, processor slowed 4×, desktop: one run of 5 recorded CLS 0.345 (main column and a
    link moved at 506 ms). 20 more runs of that cell: CLS 0 in all. Once in 25, cause unknown,
    left open.
- Resilience (Lantern): context loss falls back to the still background and stops requesting
  frames; a covered tab renders 0 frames and resumes; 40 enable/disable cycles leave one canvas
  and no heap growth trend. A regression test covers the context-loss path.
- Open, measured but not acted on: after a lost context the shader never restarts. That is the
  conservative choice and is left as is.
- Not done: a real phone, Safari, a low-end GPU, a 60 Hz display.

## Phase 3, stage 2: review fix round (2026-11-15)

- Interrupted work: a browser regression and `leave.json` / `leaves.html` fixtures for scripts
  that navigate away and lose earlier interactions. Preserved all three and added the missing
  runner guard: a changed document time origin fails the run at the script step; same-document
  routes remain allowed. The retained browser regression still needs the orchestrator's run.
- Preserved `docs/evidence/phase3/portfolio/` untouched (two JSON reports and three PNGs).
  They record portfolio arrival, hover, keyboard, reduced-motion and touch behavior before and
  after a change; the JSON shows BUTTON becoming ARTICLE and touch/arrival lighting added.
  No portfolio implementation changes were left in this worktree, and no ledger or decision-queue
  entry explains its remaining work. Further portfolio work is outside this fix round and left intact.
- P2-1: network presets now participate in comparison identity and the environment warning;
  absent/null network fields remain equivalent for older unthrottled reports.
- P2-2: timing drift reports an observation with cause unknown, including page workload as a
  possibility; it no longer asserts a display-rate change or declares INP incomparable.
  Reference and measurement caveats now use the same wording.
- P3: no raw Lantern reports exist in the evidence folder. The README now states unknown
  included run counts for high and balanced; all recorded measurement values are unchanged.
- Regression evidence: three new tests (network identity, sustained-overload drift wording,
  unknown Lantern counts) each failed before the fix and pass afterwards. Existing assertions
  were retained. `node --test --test-isolation=none tests/perf-bench.test.mjs`: 21 pass,
  2 fail with `spawn EPERM` (subprocess tests), 6 browser tests skipped (no Playwright project).
  With `--test-skip-pattern='usage errors|without Playwright'`: 21 pass, 0 fail, 6 browser skips.
  Both changed scripts pass `node --check`; `git diff --check` passes.
- Unverified: browser navigation regression, full suite and real-browser measurements; the
  orchestrator must run them outside this subprocess-restricted sandbox. No commit or release.

## Phase 3, stage 3: Lantern slow key release (2026-11-17)

- Symptom: on the static tier, 3 of 20 headed bench runs recorded a `keyup` on `#hour` of about
  520 ms, all of it presentation delay (no paint until the next visual change).
- Bisect (headed, 25 runs per copy of the page): a bare range input 0; no slider listener 0; no
  `paintLight()` or no `flow.refresh()` still stalled; dropping only the readout text update 0.
- Mechanism, measured: the readout sat in an auto-width grid column, so "Midnight · 00:00"
  (124.8 px) against "Dusk"/"Dawn" (93.6 px) shrank the slider from 661.3 to 641.5 px at
  1440 wide. Why Chrome then waits about 520 ms to present is unknown.
- Fix: the readout reserves the width of its longest reading (`min-width: 16ch`). Headed probe
  on the fixed copy: 0 of 25 (the unfixed copy: 4–11 of 25). Headless does not reproduce the
  stall even on the unfixed page, so headless runs cannot confirm the fix.
- Regression test: `lantern: the slider keeps its width while the readout changes` failed before
  the fix (661.3 / 641.5 / 661.3) and passes after; demo and bench suites 40 of 40.
- Headed bench, windows off screen (perf-bench default), 1440x900 dark, static tier, 40 runs each,
  run one after the other. Off-screen placement still reproduces the stall (a 20-run probe of the
  parent hit INP 520 ms with a 1,076 ms frame).

  | commit | runs with INP >= 200 ms | INP median / worst | worst frame (max) | CLS max | errors |
  |---|---|---|---|---|---|
  | 092b02c (parent) | 8 of 40 | 16 / 528 ms | 47 ms | 0 | 0 |
  | 815557e (fix) | 0 of 40 | 16 / 32 ms | 33 ms | 0 | 0 |

- 320 px header: the theme switch overflowed the page by 30 px (right edge at 350 px), before and
  after the slider fix. Below 360 px the header now uses a 16 px gutter, smaller gaps and logo, and
  a switch that sizes to its label. At 320 px the switch spans 188 to 289 px, 44 px tall, with
  the full label in both themes and both states. 390 and 1440 px are unchanged. Tests:
  `no demo scrolls sideways on a phone, down to 320px` and `lantern: the theme switch stays whole,
  named and usable at 320px`, red on 815557e (30 px overflow; switch at 232..350) and green after.
  Demo and bench suites: 42 of 42.

## Commits

- db4f1f4 Stage 1: foundation and experience bench
- 3b98214 Stage 2: adaptive quality runtime and six recipes
- f12f8aa Stage 3: experience composer skill and three-direction explore workflow
- Stage 4: experience demos, catalog integration, two runtime fixes (d9c8cca)
- aa79d88 Stage 5: validation, discovery and web-vitals fixes, Codex review fixes

## Codex findings

1. P1, bench: a budgeted metric that was not measured passed with exit 0 and could become a
   baseline. Now incomplete (exit 2) for a project budget file; the built-in budget lists the
   gap (D-007).
2. P2, bench: page weight was a partial sum when a request could not be sized. Now unknown.
3. P2, bench: built-in INP ranked only the interactions of 16 ms or more. Now ranked against
   the page's interaction count, unknown when the ranked one was below the threshold.
4. P2, quality runtime: long gaps alternating with normal frames never stepped down and could
   be promoted. Recurring long gaps in a window now count as slow frames; an isolated pause is
   still a pause.
5. P2, flow-hero: a failed WebGL set-up left the frame loop running for ever. It now stops, and
   the runtime honours a loop stopped from its own set-up.

## Remaining work

Nothing in Phase 2. For the owner: merge `feat/experience-engineering` (not pushed), then run
the installer so `experience` is discoverable; re-run the bench on a real GPU with `--headed`
and an interaction script before quoting frame or INP numbers.
