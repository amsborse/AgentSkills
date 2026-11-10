# Heavy hero performance (WebGL, canvas)

These lessons come from the 2026-11 portfolio revamp. The WebGL hero cost about 1100 ms of
Lighthouse Total Blocking Time on mobile: home TBT was 2266 ms with the hero and 1139 ms with
WebGL off.

## Frame governor

On a slow GPU or with software WebGL, every ambient frame becomes a long task that blocks taps
and scrolling. Watch the frame gaps and settle on a still frame when the device can't keep up:

- **Warmup:** skip the first 2 frames while shaders compile.
- **Judgement:** take the median gap over a window of 8. If it is above 34 ms (just under
  30fps), the device is slow.
- **Early verdict:** if 3 gaps in a row are more than twice the budget, decide right away
  instead of waiting for the full window.
- **Pauses:** call `reset()` after an offscreen or hidden-tab pause, so the gap isn't counted as
  a frame.
- **Sticky:** once judged slow, stay settled for the rest of the page's life. The hero still
  animates for things the user starts.

Unit-test the governor with synthetic timestamps:

- 60 and 40 fps keep motion.
- 10 fps settles.
- Six frames far over budget settle.
- Two isolated slow frames, or one long first-render gap, do not settle.
- A gap across a reset does not count.
- Once settled, it stays settled.

## Still first, then upgrade

- Render the hero as a still image plate (the same art the WebGL layer draws over) in the
  initial HTML.
- Load the WebGL bundle and start the loop after the first user input, or after
  `requestIdleCallback` (with a timeout), never during load.
- Keep three.js (or similar) out of the default bundle with a dynamic import.
- Offer a `?heroWebGL=off` query flag, so performance runs can measure the cost directly.

## Largest Contentful Paint

The largest element is usually the stage or plate art. If JS inserts it, the browser discovers
it late. Add `<link rel="preload" as="image" fetchpriority="high">` for it (with
`imagesrcset`/`imagesizes` when it is responsive), or render it in the initial HTML.

## Measure

- Run Lighthouse on mobile and desktop, before and after, with the flag on and off.
- Check CLS stays at 0.
- Report targets that were missed as missed, with the measured numbers.
