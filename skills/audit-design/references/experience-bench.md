# Experience bench

`visual-audit.mjs --perf` (or `perf-bench.mjs` directly) measures how a page performs in a
real browser, under stated conditions, several times, and compares it with a saved baseline.
It measures; it does not judge taste and it does not fix anything.

```
node ~/agent-skills/skills/audit-design/scripts/visual-audit.mjs --perf \
  --url http://localhost:3000 --project <dir with playwright> --out .visual/bench \
  --viewports desktop=1440x900,mobile=390x844 --cpu 1,4 --motion no-preference,reduce \
  --tiers default,low,static --script interactions.json --repeats 5 --runs 5 \
  --save-baseline .visual/bench/baseline.json
```

After a change, run the same command with `--baseline .visual/bench/baseline.json` instead of
`--save-baseline`. Same machine, same flags, nothing else heavy running.

## Lab, not field

Every report is lab data: one machine, one browser, synthetic input. It can show that a change
made this page faster or slower here. It cannot say what real visitors experience. Field data
(CrUX, or `web-vitals` reporting from real sessions) is a separate source and is never mixed
into a bench report. The report repeats this and lists what it could not validate (headless
frame pacing, software rendering, INP without an interaction script, real devices).

## What is measured

| Group | Metrics | Source |
| --- | --- | --- |
| Core Web Vitals | LCP, CLS (session windows), INP (worst interaction of the script) | PerformanceObserver; `web-vitals` from `--project` when installed |
| Loading | FCP, TTFB, load event | Navigation and paint timing |
| Main thread | long task count and total, worst long animation frame | `longtask`, `long-animation-frame` |
| Frames | p50, p95 and worst frame time, dropped frame share | `requestAnimationFrame` during the script, or for `--frames` ms when idle |
| Memory | heap after forced GC, heap growth per repeat of the script | CDP, Chromium only |
| Weight | bytes total, script and image bytes, request count | CDP network; file sizes for `file:` URLs |

A metric that could not be measured is `unknown` in the report, never zero and never a pass.
INP is unknown without `--script`; heap growth is unknown below four repeats.

## Conditions

One condition per combination of viewport, theme, CPU slowdown (`--cpu 4` is roughly a
mid-range phone), motion preference and quality tier. A tier is requested with `?quality=<tier>`
(`--tier-param` to rename) and checked against `data-quality` on `<html>`: a page that ignores
the request gets a note instead of numbers silently attributed to the wrong tier. Each condition
runs `--runs` times in a fresh browser context; the report gives the median and the observed
range.

## Interaction scripts

JSON, validated before the browser starts. Coordinates are fractions of the viewport; `scroll.by`
is in pixels.

```json
{ "name": "hero and menu", "steps": [
  { "type": "move", "path": [[0.2, 0.3], [0.8, 0.4]], "duration": 600 },
  { "type": "click", "selector": "#menu" },
  { "type": "scroll", "by": 1200, "duration": 800 },
  { "type": "press", "key": "Escape" },
  { "type": "wait", "ms": 250 }
] }
```

Step types: `wait`, `scroll`, `move`, `hover`, `click`, `press`, `type`, `drag`, `tab`.

## Comparison and budgets

- A difference counts only when it clears the metric's noise floor (absolute and relative) and
  the observed range of both sides. Otherwise the verdict is `no measurable change`. A missing
  side is `unknown`. Reports from different browsers, renderers or CPUs are flagged as not
  comparable.
- Default budget: the Core Web Vitals "good" thresholds (LCP 2500 ms, INP 200 ms, CLS 0.1),
  applied to lab numbers as an indication only. A project budget is a JSON file passed with
  `--budget`: `{ "budgets": { "lcp": 1800 }, "tradeoffs": [{ "metric": "lcp", "limit": 2200,
  "reason": "...", "date": "YYYY-MM-DD" }] }`. A trade-off without a reason and a date is
  rejected. Never raise a budget to make a run pass; record a trade-off the owner accepted.

## Exit codes and output

0 measured within budget, 3 over budget or regressed against the baseline, 2 incomplete
(Playwright missing, page did not load, too few runs completed, or a metric in the project's
own `--budget` file could not be measured, for example INP without an interaction script),
1 usage error. The built-in budget is indicative: its unmeasured metrics are listed as "not
measured, so not checked" and do not fail the run. Page weight is unknown, not a partial sum,
when any request could not be sized. Incomplete is
reported as incomplete and is never saved as a baseline. Output: `perf-report.json` (schema
`experience-bench/1`) and `perf-report.md` in `--out`; `--json` prints the report to stdout.
