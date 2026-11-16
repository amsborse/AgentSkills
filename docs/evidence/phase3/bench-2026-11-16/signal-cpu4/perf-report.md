# Experience bench: http://127.0.0.1:8765/demos/experience/signal.html

**Lab data, not field data.** 5 run(s) per condition; each number is the median, shown with the observed range.

- Browser: chromium 153.0.8010.12 (headed)
- Renderer: ANGLE (NVIDIA, NVIDIA GeForce RTX 2070 Super with Max-Q Design (0x00001ED1) Direct3D11 vs_5_0 ps_5_0, D3D11)
- Machine: Intel(R) Core(TM) i7-10750H CPU @ 2.60GHz, 12 threads, win32 10.0.26300 x64
- CPU throttle: Chrome DevTools Protocol slowdown rate per condition; network: unthrottled
- Vitals source: built-in PerformanceObserver (web-vitals not installed in --project)
- Interaction: "signal: scan, open a service, go back, filter, legend, keyboard", 19 step(s), repeated 1x per run
- Result: **measured**

## desktop.dark.cpu4x.motion

5 of 5 runs completed.

| Metric | Median | Range | Runs |
|---|---|---|---|
| LCP | 760 ms | 676 ms to 812 ms | 5 |
| FCP | 760 ms | 676 ms to 812 ms | 5 |
| CLS | 0.000 | 0.000 to 0.000 | 5 |
| INP | 104 ms | 96 ms to 120 ms | 5 |
| Long task time | 724 ms | 620 ms to 1462 ms | 5 |
| Worst long animation frame | 597.8 ms | 541.3 ms to 645 ms | 5 |
| Frame gap p95 | 13.3 ms | 13.3 ms to 16.6 ms | 5 |
| Dropped frames | 42.3% | 37.7% to 42.8% | 5 |
| JS heap after GC | 1.74 MB | 1.74 MB to 1.74 MB | 5 |
| Heap growth per repeat | unknown | - | 0 |
| Bytes loaded | 69.6 KB | 69.6 KB to 70.1 KB | 5 |
| Script bytes | 16.7 KB | 16.7 KB to 16.7 KB | 5 |
| Requests | 5 | 5 to 6 | 5 |

## mobile.dark.cpu4x.motion

5 of 5 runs completed.

| Metric | Median | Range | Runs |
|---|---|---|---|
| LCP | 608 ms | 596 ms to 716 ms | 5 |
| FCP | 604 ms | 320 ms to 716 ms | 5 |
| CLS | 0.000 | 0.000 to 0.000 | 5 |
| INP | 96 ms | 88 ms to 128 ms | 5 |
| Long task time | 557 ms | 325 ms to 613 ms | 5 |
| Worst long animation frame | 479.9 ms | 302.6 ms to 588.1 ms | 5 |
| Frame gap p95 | 13.3 ms | 13.3 ms to 13.4 ms | 5 |
| Dropped frames | 38.6% | 37.5% to 39.6% | 5 |
| JS heap after GC | 1.76 MB | 1.76 MB to 1.77 MB | 5 |
| Heap growth per repeat | unknown | - | 0 |
| Bytes loaded | 69.6 KB | 69.6 KB to 69.6 KB | 5 |
| Script bytes | 16.7 KB | 16.7 KB to 16.7 KB | 5 |
| Requests | 5 | 5 to 5 | 5 |

## Budget

Source: default (Core Web Vitals "good" thresholds, indicative for lab data).

No measured metric is over budget.

## Not validated

- Field performance: these are lab numbers from one machine, not the 75th percentile of real users.
- Real mobile hardware, GPU thermals and battery: CPU throttling slows JavaScript only, it does not emulate a phone GPU.
- Energy use and GPU memory: no scriptable measurement exists.
- Safari and Firefox: this run measured Chromium only. Re-run with --browser firefox or webkit for those engines.
- Network conditions: loaded locally without network throttling.
- Memory growth: needs --repeats 4 or more with an interaction script; not measured.
