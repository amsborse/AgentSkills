# Experience bench: http://127.0.0.1:8765/demos/experience/signal.html

**Lab data, not field data.** 5 run(s) per condition; each number is the median, shown with the observed range.

- Browser: chromium 153.0.8010.12 (headed)
- Renderer: ANGLE (NVIDIA, NVIDIA GeForce RTX 2070 Super with Max-Q Design (0x00001ED1) Direct3D11 vs_5_0 ps_5_0, D3D11)
- Machine: Intel(R) Core(TM) i7-10750H CPU @ 2.60GHz, 12 threads, win32 10.0.26300 x64
- CPU throttle: Chrome DevTools Protocol slowdown rate per condition; network: unthrottled
- Vitals source: built-in PerformanceObserver (web-vitals not installed in --project)
- Interaction: "signal: scan, open a service, go back, filter, legend, keyboard", 19 step(s), repeated 1x per run
- Result: **measured**

## desktop.light.cpu1x.motion

5 of 5 runs completed.

| Metric | Median | Range | Runs |
|---|---|---|---|
| LCP | 172 ms | 164 ms to 324 ms | 5 |
| FCP | 172 ms | 164 ms to 324 ms | 5 |
| CLS | 0.000 | 0.000 to 0.000 | 5 |
| INP | 32 ms | 24 ms to 56 ms | 5 |
| Long task time | 125 ms | 0 ms to 278 ms | 5 |
| Worst long animation frame | 127.9 ms | 0 ms to 170.7 ms | 5 |
| Frame gap p95 | 3.5 ms | 3.4 ms to 3.5 ms | 5 |
| Dropped frames | 3.9% | 3.4% to 5.7% | 5 |
| JS heap after GC | 1.73 MB | 1.73 MB to 1.74 MB | 5 |
| Heap growth per repeat | unknown | - | 0 |
| Bytes loaded | 69.6 KB | 69.6 KB to 70.1 KB | 5 |
| Script bytes | 16.7 KB | 16.7 KB to 16.7 KB | 5 |
| Requests | 5 | 5 to 6 | 5 |

## desktop.dark.cpu1x.motion

5 of 5 runs completed.

| Metric | Median | Range | Runs |
|---|---|---|---|
| LCP | 172 ms | 144 ms to 192 ms | 5 |
| FCP | 172 ms | 144 ms to 192 ms | 5 |
| CLS | 0.000 | 0.000 to 0.000 | 5 |
| INP | 24 ms | 24 ms to 32 ms | 5 |
| Long task time | 136 ms | 0 ms to 163 ms | 5 |
| Worst long animation frame | 126.9 ms | 0 ms to 148.5 ms | 5 |
| Frame gap p95 | 3.5 ms | 3.4 ms to 3.6 ms | 5 |
| Dropped frames | 3.2% | 2.5% to 5.8% | 5 |
| JS heap after GC | 1.73 MB | 1.73 MB to 1.73 MB | 5 |
| Heap growth per repeat | unknown | - | 0 |
| Bytes loaded | 69.6 KB | 69.6 KB to 69.6 KB | 5 |
| Script bytes | 16.7 KB | 16.7 KB to 16.7 KB | 5 |
| Requests | 5 | 5 to 5 | 5 |

## mobile.light.cpu1x.motion

5 of 5 runs completed.

| Metric | Median | Range | Runs |
|---|---|---|---|
| LCP | 156 ms | 148 ms to 172 ms | 5 |
| FCP | 156 ms | 148 ms to 172 ms | 5 |
| CLS | 0.000 | 0.000 to 0.000 | 5 |
| INP | 32 ms | 32 ms to 40 ms | 5 |
| Long task time | 0 ms | 0 ms to 0 ms | 5 |
| Worst long animation frame | 112.9 ms | 108.6 ms to 120.7 ms | 5 |
| Frame gap p95 | 3.5 ms | 3.4 ms to 3.5 ms | 5 |
| Dropped frames | 2.6% | 2.0% to 4.6% | 5 |
| JS heap after GC | 1.76 MB | 1.76 MB to 1.76 MB | 5 |
| Heap growth per repeat | unknown | - | 0 |
| Bytes loaded | 69.6 KB | 69.6 KB to 69.6 KB | 5 |
| Script bytes | 16.7 KB | 16.7 KB to 16.7 KB | 5 |
| Requests | 5 | 5 to 5 | 5 |

## mobile.dark.cpu1x.motion

5 of 5 runs completed.

| Metric | Median | Range | Runs |
|---|---|---|---|
| LCP | 168 ms | 160 ms to 168 ms | 5 |
| FCP | 168 ms | 160 ms to 168 ms | 5 |
| CLS | 0.000 | 0.000 to 0.000 | 5 |
| INP | 32 ms | 24 ms to 40 ms | 5 |
| Long task time | 0 ms | 0 ms to 0 ms | 5 |
| Worst long animation frame | 120.7 ms | 111.9 ms to 129.1 ms | 5 |
| Frame gap p95 | 3.5 ms | 3.5 ms to 3.5 ms | 5 |
| Dropped frames | 2.8% | 2.5% to 4.2% | 5 |
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
