# Experience demos

Three sample products built from the same six recipes (`shared/creative/recipes/`) and the same
quality runtime, each made to look and behave like itself. They exist to show that the toolkit
adapts to a product instead of stamping one look on everything, and to give the bench and the
audit something real to measure. All content is sample data written for these pages.

Open `index.html` from disk (no server, no build, no dependencies). Add
`?quality=static|low|balanced|high|ultra` to any demo to hold a tier.

| | Signal | Field Notes | Lantern |
|---|---|---|---|
| Job | Operate: service health console | Read: long essay | Persuade: landing page |
| Type | DIN-style instrument headings and monospace observations | Old-style serif | Geometric humanist headings and Charter-style prose |
| Colour | Graphite and mineral paper, lime accent; neutral healthy state and clay failure state, with a shape key | Warm paper, oxblood accent | Aubergine plaster and warm limestone, copper accent |
| Recipes | spring-states, route-transition | scroll-reveal, spring-states, cursor-light | flow-hero, magnetic-target, cursor-light, scroll-reveal, spring-states |
| Interaction | Ten latency traces answer row hover and focus; service detail opens and returns (Enter, Esc, tap), deep-linkable | Footnotes open in place | An evening slider changes a pendant's shaped beam, in both colour themes |
| Cost at rest | No frames requested | No script frames; scroll effects run in CSS | One shader, tiered; a still gradient on `static` and with reduced motion |

Signal is a relay desk: an exception-first register with an unboxed fleet horizon and a compact
attention queue. Its voice is terse and observational. Lantern is an architectural light study:
a suspended pendant, a quiet table, a room plan and an evening told in three domestic moments.
Its voice is warm and unhurried. Both have a manual theme control and start from the system theme.

The earlier designs remain at [`v1/signal.html`](v1/signal.html) and
[`v1/lantern.html`](v1/lantern.html), with their local recipe paths repaired. The screenshot and
measurement sections below describe the earlier designs pending the orchestrator's new captures
and measurements; this redesign has not been browser-verified.

## Screenshots

Real captures from `audit-design` (headless Chromium, 1440×900 and 390×844), not mock-ups.

| | Dark | Light | Phone |
|---|---|---|---|
| Signal | ![](screenshots/signal-desktop-dark.png) | ![](screenshots/signal-desktop-light.png) | ![](screenshots/signal-mobile-dark.png) |
| Field Notes | ![](screenshots/field-notes-desktop-dark.png) | ![](screenshots/field-notes-desktop-light.png) | ![](screenshots/field-notes-mobile-light.png) |
| Lantern | ![](screenshots/lantern-desktop-dark.png) | ![](screenshots/lantern-desktop-light.png) | ![](screenshots/lantern-mobile-dark.png) |

`screenshots/` also holds the other phone theme for each demo.

## Measured

Lab numbers from one laptop, not field data and not real phones. `audit-design` bench in a
**headed Chromium 153 window with hardware acceleration** (renderer: ANGLE, NVIDIA GeForce RTX
2070 Super with Max-Q, Direct3D 11), Windows 11, Core i7-10750H, 16 GB, a display refreshing
about 300 times a second (one frame is 3.3 ms). Each cell is 5 runs unless it says otherwise,
shown as median (lowest–highest). INP comes from a scripted session per demo
(`scripts/<demo>.json`: open and close a row with mouse and keyboard, filter, scroll, open
footnotes, drag the slider, tap on the phone viewport). "Phone viewport" is a 390×844 touch
viewport in the same desktop browser: it checks layout and touch handling and says nothing
about a phone's processor or GPU. CLS was 0 in every cell except one run noted below. Signal and
Lantern were measured again on 2026-11-16 after their redesign (Lantern's session now also
switches the light and back); Field Notes was measured 2026-11-15. The reduced-motion and
slowed-processor rows for Signal and Lantern are on the dark theme.

| Demo | Condition | LCP ms | INP ms |
|---|---|---|---|
| Signal | desktop light | 172 (164–324) | 32 (24–56) |
| Signal | desktop dark | 172 (144–192) | 24 (24–32) |
| Signal | phone viewport light | 156 (148–172) | 32 (32–40) |
| Signal | phone viewport dark | 168 (160–168) | 32 (24–40) |
| Signal | reduced motion (runs as `static`) | 188 (148–308) | 32 (24–48) |
| Signal | processor slowed 4×, desktop | 760 (676–812) | 104 (96–120) |
| Signal | processor slowed 4×, phone viewport | 608 (596–716) | 96 (88–128) |
| Signal | slow 4G, phone viewport (3 runs) | 1312 (1308–1388) | 32 (24–56) |
| Field Notes | desktop light | 168 (128–252) | 16 (16–16) |
| Field Notes | desktop dark | 160 (148–188) | 16 (16–24) |
| Field Notes | phone viewport light | 172 (144–264) | 32 (24–56) |
| Field Notes | phone viewport dark | 132 (124–192) | 32 (32–56) |
| Field Notes | reduced motion (runs as `static`) | 128 (112–156) | 16 |
| Field Notes | processor slowed 4×, desktop | 768 (652–868) | 32 (32–48) |
| Field Notes | processor slowed 4×, phone viewport | 648 (524–800) | 48 (40–72) |
| Field Notes | slow 4G, phone viewport (3 runs) | 1424 (1320–1492) | 40 |
| Lantern | desktop light | 144 (136–324) | 32 (24–56) |
| Lantern | desktop dark | 148 (128–156) | 24 (24–32) |
| Lantern | phone viewport light | 132 (128–212) | 24 (24–32) |
| Lantern | phone viewport dark | 144 (120–168) | 32 |
| Lantern | reduced motion (runs as `static`) | 140 (128–456) | 16 |
| Lantern | processor slowed 4×, desktop | 532 (512–764) | 64 (64–96) |
| Lantern | processor slowed 4×, phone viewport | 544 (468–612) | 72 (64–112) |
| Lantern | slow 4G, phone viewport (3 runs) | 1340 (1332–1496) | 32 (32–64) |

Frame pacing, unthrottled desktop: Signal holds the display's rate (95th-percentile frame
3.5 ms, 3–4% of frames late, under 1% on `static`). Lantern, whose session now includes two
theme reveals, shows 6.6 ms and 6–11% of frames late on `ultra`, `high` and `balanced`, 3.5 ms
and 4% on `low`, and 0.1% on `static`. Field Notes on its animated tiers shows 6.6 ms and
7–11% of frames late while scrolling, against 3.5 ms and 0.2% on `static`. With the processor
slowed 4×, Signal has 42% of frames late on the desktop viewport and 39% on the phone viewport,
Lantern 34% on both, Field Notes 23% on desktop.

Quality tiers, desktop dark, held with `?quality=`:

| Demo | ultra | high | balanced | low | static |
|---|---|---|---|---|---|
| Signal LCP / INP ms | 168 / 24 | 168 / 24 | 180 / 24 | 172 / 24 | 164 / 24 |
| Field Notes LCP / INP ms | 148 / 16 | 136 / 16 | 132 / 16 | 120 / 16 | 124 / 16 |
| Lantern LCP ms | 152 (144–468) | 148 (140–172) | 160 (116–176) | 164 (144–180) | 152 (140–164) |
| Lantern INP ms | 32 (24–80) | 24 | 24 (24–32) | 24 (24–32) | 16 (16–528) |

Every Signal and Lantern tier above completed 5 of 5 runs; the raw reports for all the Signal and
Lantern figures are in `docs/evidence/phase3/bench-2026-11-16/`. One Lantern `static` run recorded an
INP of 528 ms against 16 ms in the other four. The same thing happened in 3 of 5 runs of an
earlier reduced-motion pass (which also runs as `static`) and in none of the 10 runs of the
repeat pass shown in the table (the repeat overwrote the earlier pass's report, so that one is
not kept). The interaction responsible was not identified, so the cause is
unknown and it is not counted as fixed.

Weight (Chromium, transferred): Signal 69.6 KB in total, 16.7 KB of it script; Field Notes
43.5 KB, 19.3 KB; Lantern 73.4 KB, 31.0 KB. JavaScript heap after the session: 1.7–1.9 MB for
all three.

What the numbers say:

- On this GPU every tier of every demo is inside the budgets (LCP 2500 ms, INP 200 ms, CLS 0.1)
  by a wide margin, and the differences between Lantern's tiers are smaller than the spread
  between runs. The lower tiers buy nothing measurable here. Their value was shown on the
  software renderer in phase 2 (30 fps on `balanced`, misses on `high` and `ultra`) and is
  unproven on a real low-end GPU.
- Field Notes' scroll effects have a small real cost (the frame figures above). At 60 Hz it is
  invisible; on this 300 Hz display it is a few late frames while scrolling.
- With the processor slowed 4× the pages stay inside the budgets, with INP rising to 96–104 ms
  on Signal and 64–72 ms on Lantern. That is the cell to watch on a slow device.
- On slow 4G all three paint in about 1.3–1.5 s; the pages are small enough that latency, not
  weight, sets that.
- One layout shift is unexplained, on the previous Signal design (the redesigned page recorded
  CLS 0 in every run). In the first 5 runs of Signal with the processor slowed 4×
  (desktop, dark), one run recorded CLS 0.345: the main column and a link moved 506 ms in, about
  when the page first painted. Twenty further runs of the same cell recorded CLS 0 every time
  (LCP 612 ms (480–956), INP 64 ms (56–144)). So it happened once in 25 runs and the cause is
  not known; it is not counted as fixed.

Other engines (measured 2026-11-15, so the Signal and Lantern rows describe their previous
designs, now under `v1/`, and have not been repeated; headed, Playwright's builds, 3 runs each; processor and network cannot be
slowed there):

| Demo | Firefox 155 | WebKit 26.6 (Playwright's Windows build, not Safari) |
|---|---|---|
| Signal | LCP 180 (171–401), INP 32 (24–40) | **Incomplete: the page process crashes** when going back from a service (below) |
| Field Notes | 2 of 3 runs: LCP 316 (139–493), INP 16. A first attempt crashed the tab on a wheel scroll | LCP 81 (59–119), INP 24, frame p95 67 ms, 28.9% of frames late |
| Lantern | LCP 188 (172–29,122: one run stalled), INP 16 (16–48) | No WebGL in this build, so it runs as `static`: LCP 542 (222–621), INP 64 (48–216), frame p95 141 ms |

- Firefox masks its GPU name (it reported a "GeForce GTX 980"), so hardware acceleration there
  is unconfirmed. Its headed runs stalled or crashed about one time in four on this machine;
  the cause is unknown, so its numbers are indicative only.
- The WebKit crash: on `low` and above, a real key press or click that goes back from a service
  to the list kills the page process. The same code called from script does not crash, the
  forward transition does not, `static` (no view transition) does not, and cut-down pages making
  the same calls do not. A page cannot legitimately crash its renderer, so this is recorded as a
  fault of that engine build. **Whether Safari on a Mac or an iPhone is affected is unknown**
  and needs a real device.

Resilience (Lantern, same headed GPU session):

- WebGL context lost (`WEBGL_lose_context`): the shader canvas is removed, the still background
  takes over, no more frames are requested and the page stays readable
  (`screenshots/lantern-after-context-loss.png`). It does not try to restart the shader
  afterwards, even when a higher tier is asked for.
- Another tab in front: 151 frames per 500 ms before, 0 while covered, 151 after returning. The
  harness cannot tell whether the runtime's own pause or the browser's throttling did it.
- 40 enable/disable cycles of the effect: heap went from 1.85 MB to 1.90 MB with no upward
  trend, and one canvas at the end.

Not measured: any real phone or tablet, Safari, a low-end or integrated GPU, battery saver, a
60 Hz display, field data.

Reproduce one cell (needs a folder with Playwright installed, and the repository served over
HTTP):

```
node skills/audit-design/scripts/perf-bench.mjs --project <folder-with-playwright> --headed \
  --url http://127.0.0.1:<port>/demos/experience/lantern.html \
  --script demos/experience/scripts/lantern.json --out <dir> \
  --viewports desktop=1440x900,mobile=390x844 --themes light,dark --runs 5
```

`perf-bench.mjs` with no arguments lists the options for tiers, a slowed processor, a shaped
network, reduced motion and the other browsers.

## Checked

`tests/experience-demos.test.mjs` (real browser; set `PLAYWRIGHT_PROJECT`) covers: every demo on
every tier in both themes without errors; no sideways scroll on a phone; the three demos share
no typeface, background or accent; keyboard open/close with focus following (Signal); a deep
link and reduced motion (Signal); tap on touch (Signal, Lantern); footnotes and end-of-page
visibility (Field Notes); no frames at rest; no layout shift on a slowed processor (Signal); the
shader absent on `static` and with reduced motion and stopped the moment the hero leaves the
screen (Lantern).

`audit-design` passes on all three at both sizes and both themes with no blocker, major or minor
finding. Its remaining notes are text over gradients whose contrast a script cannot measure;
those were checked by eye in the screenshots.

## Framework neutrality

The demos are plain HTML, CSS and script on purpose. The recipes they use are the same files a
React, Vue or Svelte project would import; `shared/creative/recipes/adapters.md` shows the
wrapper patterns, which are documented patterns and have not been run inside those frameworks.
