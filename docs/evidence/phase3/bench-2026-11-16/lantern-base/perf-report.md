# Experience bench: http://127.0.0.1:8765/demos/experience/lantern.html

**Lab data, not field data.** 5 run(s) per condition; each number is the median, shown with the observed range.

- Browser: chromium 153.0.8010.12 (headed)
- Renderer: ANGLE (NVIDIA, NVIDIA GeForce RTX 2070 Super with Max-Q Design (0x00001ED1) Direct3D11 vs_5_0 ps_5_0, D3D11)
- Machine: Intel(R) Core(TM) i7-10750H CPU @ 2.60GHz, 12 threads, win32 10.0.26300 x64
- CPU throttle: Chrome DevTools Protocol slowdown rate per condition; network: unthrottled
- Vitals source: built-in PerformanceObserver (web-vitals not installed in --project)
- Interaction: "lantern: look around the sky, move the evening, switch the light and back, follow the calls to action", 18 step(s), repeated 1x per run
- Result: **measured**

## desktop.light.cpu1x.motion

5 of 5 runs completed.

| Metric | Median | Range | Runs |
|---|---|---|---|
| LCP | 144 ms | 136 ms to 324 ms | 5 |
| FCP | 144 ms | 136 ms to 324 ms | 5 |
| CLS | 0.000 | 0.000 to 0.000 | 5 |
| INP | 32 ms | 24 ms to 56 ms | 5 |
| Long task time | 97 ms | 87 ms to 241 ms | 5 |
| Worst long animation frame | 90.3 ms | 83.5 ms to 260.6 ms | 5 |
| Frame gap p95 | 6.6 ms | 6.6 ms to 6.7 ms | 5 |
| Dropped frames | 8.3% | 7.3% to 10.3% | 5 |
| JS heap after GC | 1.87 MB | 1.87 MB to 1.87 MB | 5 |
| Heap growth per repeat | unknown | - | 0 |
| Bytes loaded | 73.4 KB | 73.4 KB to 73.9 KB | 5 |
| Script bytes | 31.0 KB | 31.0 KB to 31.0 KB | 5 |
| Requests | 12 | 12 to 13 | 5 |

## desktop.dark.cpu1x.motion

5 of 5 runs completed.

| Metric | Median | Range | Runs |
|---|---|---|---|
| LCP | 148 ms | 128 ms to 156 ms | 5 |
| FCP | 148 ms | 128 ms to 156 ms | 5 |
| CLS | 0.000 | 0.000 to 0.000 | 5 |
| INP | 24 ms | 24 ms to 32 ms | 5 |
| Long task time | 95 ms | 84 ms to 100 ms | 5 |
| Worst long animation frame | 90.1 ms | 82.6 ms to 96.2 ms | 5 |
| Frame gap p95 | 6.6 ms | 6.6 ms to 6.7 ms | 5 |
| Dropped frames | 8.7% | 6.4% to 10.0% | 5 |
| JS heap after GC | 1.87 MB | 1.86 MB to 1.87 MB | 5 |
| Heap growth per repeat | unknown | - | 0 |
| Bytes loaded | 73.4 KB | 73.4 KB to 73.4 KB | 5 |
| Script bytes | 31.0 KB | 31.0 KB to 31.0 KB | 5 |
| Requests | 12 | 12 to 12 | 5 |

## mobile.light.cpu1x.motion

5 of 5 runs completed.

| Metric | Median | Range | Runs |
|---|---|---|---|
| LCP | 132 ms | 128 ms to 212 ms | 5 |
| FCP | 132 ms | 128 ms to 212 ms | 5 |
| CLS | 0.000 | 0.000 to 0.000 | 5 |
| INP | 24 ms | 24 ms to 32 ms | 5 |
| Long task time | 0 ms | 0 ms to 62 ms | 5 |
| Worst long animation frame | 89.2 ms | 88.1 ms to 112.2 ms | 5 |
| Frame gap p95 | 6.6 ms | 3.5 ms to 6.6 ms | 5 |
| Dropped frames | 5.6% | 4.0% to 6.0% | 5 |
| JS heap after GC | 1.90 MB | 1.90 MB to 1.90 MB | 5 |
| Heap growth per repeat | unknown | - | 0 |
| Bytes loaded | 73.4 KB | 73.4 KB to 73.4 KB | 5 |
| Script bytes | 31.0 KB | 31.0 KB to 31.0 KB | 5 |
| Requests | 12 | 12 to 12 | 5 |

## mobile.dark.cpu1x.motion

5 of 5 runs completed.

| Metric | Median | Range | Runs |
|---|---|---|---|
| LCP | 144 ms | 120 ms to 168 ms | 5 |
| FCP | 144 ms | 120 ms to 168 ms | 5 |
| CLS | 0.000 | 0.000 to 0.000 | 5 |
| INP | 32 ms | 32 ms to 32 ms | 5 |
| Long task time | 0 ms | 0 ms to 72 ms | 5 |
| Worst long animation frame | 98.9 ms | 84.6 ms to 122 ms | 5 |
| Frame gap p95 | 3.5 ms | 3.5 ms to 6.4 ms | 5 |
| Dropped frames | 4.4% | 2.9% to 5.3% | 5 |
| JS heap after GC | 1.90 MB | 1.90 MB to 1.90 MB | 5 |
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
