# Experience bench: http://127.0.0.1:8765/demos/experience/lantern.html

**Lab data, not field data.** 5 run(s) per condition; each number is the median, shown with the observed range.

- Browser: chromium 153.0.8010.12 (headed)
- Renderer: ANGLE (NVIDIA, NVIDIA GeForce RTX 2070 Super with Max-Q Design (0x00001ED1) Direct3D11 vs_5_0 ps_5_0, D3D11)
- Machine: Intel(R) Core(TM) i7-10750H CPU @ 2.60GHz, 12 threads, win32 10.0.26300 x64
- CPU throttle: Chrome DevTools Protocol slowdown rate per condition; network: unthrottled
- Vitals source: built-in PerformanceObserver (web-vitals not installed in --project)
- Interaction: "lantern: look around the sky, move the evening, switch the light and back, follow the calls to action", 18 step(s), repeated 1x per run
- Result: **measured**

## desktop.dark.cpu4x.motion

5 of 5 runs completed.

| Metric | Median | Range | Runs |
|---|---|---|---|
| LCP | 532 ms | 512 ms to 764 ms | 5 |
| FCP | 532 ms | 512 ms to 764 ms | 5 |
| CLS | 0.000 | 0.000 to 0.000 | 5 |
| INP | 64 ms | 64 ms to 96 ms | 5 |
| Long task time | 174 ms | 58 ms to 294 ms | 5 |
| Worst long animation frame | 352.3 ms | 335 ms to 375.2 ms | 5 |
| Frame gap p95 | 16.7 ms | 16.7 ms to 19.9 ms | 5 |
| Dropped frames | 34.1% | 32.6% to 34.3% | 5 |
| JS heap after GC | 1.86 MB | 1.86 MB to 1.86 MB | 5 |
| Heap growth per repeat | unknown | - | 0 |
| Bytes loaded | 73.4 KB | 73.4 KB to 73.9 KB | 5 |
| Script bytes | 31.0 KB | 31.0 KB to 31.0 KB | 5 |
| Requests | 12 | 12 to 13 | 5 |

## mobile.dark.cpu4x.motion

5 of 5 runs completed.

| Metric | Median | Range | Runs |
|---|---|---|---|
| LCP | 544 ms | 468 ms to 612 ms | 5 |
| FCP | 544 ms | 468 ms to 612 ms | 5 |
| CLS | 0.000 | 0.000 to 0.000 | 5 |
| INP | 72 ms | 64 ms to 112 ms | 5 |
| Long task time | 303 ms | 125 ms to 429 ms | 5 |
| Worst long animation frame | 371.3 ms | 326.4 ms to 412 ms | 5 |
| Frame gap p95 | 16.7 ms | 16.7 ms to 16.7 ms | 5 |
| Dropped frames | 33.6% | 33.2% to 36.0% | 5 |
| JS heap after GC | 1.89 MB | 1.89 MB to 1.89 MB | 5 |
| Heap growth per repeat | unknown | - | 0 |
| Bytes loaded | 73.4 KB | 73.4 KB to 73.4 KB | 5 |
| Script bytes | 31.0 KB | 31.0 KB to 31.0 KB | 5 |
| Requests | 12 | 12 to 12 | 5 |

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
