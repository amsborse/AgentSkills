# Experience bench: http://127.0.0.1:8765/demos/experience/lantern.html

**Lab data, not field data.** 3 run(s) per condition; each number is the median, shown with the observed range.

- Browser: chromium 153.0.8010.12 (headed)
- Renderer: ANGLE (NVIDIA, NVIDIA GeForce RTX 2070 Super with Max-Q Design (0x00001ED1) Direct3D11 vs_5_0 ps_5_0, D3D11)
- Machine: Intel(R) Core(TM) i7-10750H CPU @ 2.60GHz, 12 threads, win32 10.0.26300 x64
- CPU throttle: Chrome DevTools Protocol slowdown rate per condition; network: shaped to the slow-4g preset
- Vitals source: built-in PerformanceObserver (web-vitals not installed in --project)
- Interaction: "lantern: look around the sky, move the evening, switch the light and back, follow the calls to action", 18 step(s), repeated 1x per run
- Result: **measured**

## mobile.dark.cpu1x.motion

3 of 3 runs completed.

| Metric | Median | Range | Runs |
|---|---|---|---|
| LCP | 1340 ms | 1332 ms to 1496 ms | 3 |
| FCP | 1340 ms | 1332 ms to 1496 ms | 3 |
| CLS | 0.000 | 0.000 to 0.000 | 3 |
| INP | 32 ms | 32 ms to 64 ms | 3 |
| Long task time | 0 ms | 0 ms to 55 ms | 3 |
| Worst long animation frame | 724.6 ms | 706.7 ms to 729.2 ms | 3 |
| Frame gap p95 | 3.7 ms | 3.5 ms to 6.6 ms | 3 |
| Dropped frames | 5.5% | 3.8% to 7.3% | 3 |
| JS heap after GC | 1.90 MB | 1.90 MB to 1.91 MB | 3 |
| Heap growth per repeat | unknown | - | 0 |
| Bytes loaded | 73.4 KB | 73.4 KB to 73.9 KB | 3 |
| Script bytes | 31.0 KB | 31.0 KB to 31.0 KB | 3 |
| Requests | 12 | 12 to 13 | 3 |

## Budget

Source: default (Core Web Vitals "good" thresholds, indicative for lab data).

No measured metric is over budget.

## Not validated

- Field performance: these are lab numbers from one machine, not the 75th percentile of real users.
- Real mobile hardware, GPU thermals and battery: CPU throttling slows JavaScript only, it does not emulate a phone GPU.
- Energy use and GPU memory: no scriptable measurement exists.
- Safari and Firefox: this run measured Chromium only. Re-run with --browser firefox or webkit for those engines.
- Network: shaped to the slow-4g preset in the browser, which is not a real radio link.
- Memory growth: needs --repeats 4 or more with an interaction script; not measured.
