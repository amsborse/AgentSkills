# Experience bench: http://127.0.0.1:8765/demos/experience/lantern.html

**Lab data, not field data.** 5 run(s) per condition; each number is the median, shown with the observed range.

- Browser: chromium 153.0.8010.12 (headed)
- Renderer: ANGLE (NVIDIA, NVIDIA GeForce RTX 2070 Super with Max-Q Design (0x00001ED1) Direct3D11 vs_5_0 ps_5_0, D3D11)
- Machine: Intel(R) Core(TM) i7-10750H CPU @ 2.60GHz, 12 threads, win32 10.0.26300 x64
- CPU throttle: Chrome DevTools Protocol slowdown rate per condition; network: unthrottled
- Vitals source: built-in PerformanceObserver (web-vitals not installed in --project)
- Interaction: "lantern: look around the sky, move the evening, switch the light and back, follow the calls to action", 18 step(s), repeated 1x per run
- Result: **measured**

## desktop.dark.cpu1x.motion.tier-ultra

5 of 5 runs completed.

| Metric | Median | Range | Runs |
|---|---|---|---|
| LCP | 152 ms | 144 ms to 468 ms | 5 |
| FCP | 152 ms | 144 ms to 468 ms | 5 |
| CLS | 0.000 | 0.000 to 0.000 | 5 |
| INP | 32 ms | 24 ms to 80 ms | 5 |
| Long task time | 95 ms | 87 ms to 215 ms | 5 |
| Worst long animation frame | 91.9 ms | 84.6 ms to 278.4 ms | 5 |
| Frame gap p95 | 6.7 ms | 6.7 ms to 6.7 ms | 5 |
| Dropped frames | 11.1% | 9.6% to 11.3% | 5 |
| JS heap after GC | 1.86 MB | 1.86 MB to 1.86 MB | 5 |
| Heap growth per repeat | unknown | - | 0 |
| Bytes loaded | 73.4 KB | 73.4 KB to 73.9 KB | 5 |
| Script bytes | 31.0 KB | 31.0 KB to 31.0 KB | 5 |
| Requests | 12 | 12 to 13 | 5 |

## desktop.dark.cpu1x.motion.tier-high

5 of 5 runs completed.

| Metric | Median | Range | Runs |
|---|---|---|---|
| LCP | 148 ms | 140 ms to 172 ms | 5 |
| FCP | 148 ms | 140 ms to 172 ms | 5 |
| CLS | 0.000 | 0.000 to 0.000 | 5 |
| INP | 24 ms | 24 ms to 24 ms | 5 |
| Long task time | 99 ms | 93 ms to 150 ms | 5 |
| Worst long animation frame | 91.8 ms | 89.8 ms to 112.3 ms | 5 |
| Frame gap p95 | 6.6 ms | 3.5 ms to 6.6 ms | 5 |
| Dropped frames | 6.5% | 4.0% to 7.2% | 5 |
| JS heap after GC | 1.85 MB | 1.84 MB to 1.85 MB | 5 |
| Heap growth per repeat | unknown | - | 0 |
| Bytes loaded | 73.4 KB | 73.4 KB to 73.4 KB | 5 |
| Script bytes | 31.0 KB | 31.0 KB to 31.0 KB | 5 |
| Requests | 12 | 12 to 12 | 5 |

## desktop.dark.cpu1x.motion.tier-balanced

5 of 5 runs completed.

| Metric | Median | Range | Runs |
|---|---|---|---|
| LCP | 160 ms | 116 ms to 176 ms | 5 |
| FCP | 160 ms | 116 ms to 176 ms | 5 |
| CLS | 0.000 | 0.000 to 0.000 | 5 |
| INP | 24 ms | 24 ms to 32 ms | 5 |
| Long task time | 105 ms | 71 ms to 109 ms | 5 |
| Worst long animation frame | 103.1 ms | 73.5 ms to 109.2 ms | 5 |
| Frame gap p95 | 6.6 ms | 6.6 ms to 6.6 ms | 5 |
| Dropped frames | 6.8% | 5.8% to 7.8% | 5 |
| JS heap after GC | 1.85 MB | 1.84 MB to 1.85 MB | 5 |
| Heap growth per repeat | unknown | - | 0 |
| Bytes loaded | 73.4 KB | 73.4 KB to 73.4 KB | 5 |
| Script bytes | 31.0 KB | 31.0 KB to 31.0 KB | 5 |
| Requests | 12 | 12 to 12 | 5 |

## desktop.dark.cpu1x.motion.tier-low

5 of 5 runs completed.

| Metric | Median | Range | Runs |
|---|---|---|---|
| LCP | 164 ms | 144 ms to 180 ms | 5 |
| FCP | 164 ms | 144 ms to 180 ms | 5 |
| CLS | 0.000 | 0.000 to 0.000 | 5 |
| INP | 24 ms | 24 ms to 32 ms | 5 |
| Long task time | 106 ms | 95 ms to 117 ms | 5 |
| Worst long animation frame | 106.2 ms | 85.5 ms to 111.1 ms | 5 |
| Frame gap p95 | 3.5 ms | 3.5 ms to 3.6 ms | 5 |
| Dropped frames | 3.8% | 2.5% to 4.1% | 5 |
| JS heap after GC | 1.83 MB | 1.83 MB to 1.83 MB | 5 |
| Heap growth per repeat | unknown | - | 0 |
| Bytes loaded | 73.4 KB | 73.4 KB to 73.4 KB | 5 |
| Script bytes | 31.0 KB | 31.0 KB to 31.0 KB | 5 |
| Requests | 12 | 12 to 12 | 5 |

## desktop.dark.cpu1x.motion.tier-static

5 of 5 runs completed.

| Metric | Median | Range | Runs |
|---|---|---|---|
| LCP | 152 ms | 140 ms to 164 ms | 5 |
| FCP | 152 ms | 140 ms to 164 ms | 5 |
| CLS | 0.000 | 0.000 to 0.000 | 5 |
| INP | 16 ms | 16 ms to 528 ms | 5 |
| Long task time | 105 ms | 96 ms to 160 ms | 5 |
| Worst long animation frame | 99.1 ms | 90.1 ms to 100.5 ms | 5 |
| Frame gap p95 | 3.4 ms | 3.4 ms to 3.4 ms | 5 |
| Dropped frames | 0.1% | 0.0% to 0.3% | 5 |
| JS heap after GC | 1.65 MB | 1.64 MB to 1.65 MB | 5 |
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
