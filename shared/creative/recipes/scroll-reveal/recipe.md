# Scroll reveal

Content that settles into place as it enters the viewport, plus a reading-progress bar. Runs on
native scroll-driven animations (off the main thread) where the browser has them, and on a
small IntersectionObserver script where it does not. Technique notes:
`../../techniques/scroll-choreography.md`.

**Use for** long reading or marketing pages where sections should arrive gently. **Not for**
dense tools, tables or anything a user scans quickly: revealing there only delays them.

## Files

`recipe.css`, `recipe.js` (the script is the fallback path; it does nothing where native
support exists).

## API

```html
<div class="scroll-progress" aria-hidden="true"></div>
<section class="reveal">…</section>
<script src="recipe.js"></script>
<script>const stop = ExperienceScroll.init();</script>
```

- `.reveal`: fades and rises on entry. `--reveal-distance` (default 24px) sets the travel.
- `.scroll-progress`: scales on X with page scroll.
- `ExperienceScroll.init({ force })` returns a clean-up function. `force: true` uses the script
  path even where native support exists (for testing the fallback).

## How content stays visible

Elements are only hidden once the script has added `reveal-js` to `<html>`, and they are hidden
without a transition, so nothing fades out on load. With no JavaScript, an unsupported browser
or a script error, everything is simply visible. On the script path an element is revealed once
and stays revealed.

## Tiers

- **static, reduced motion:** everything visible, no animation. The progress bar still tracks.
- **low:** opacity only (`--reveal-distance: 0px`).
- **balanced and up:** fade and rise.

## Accessibility

Content is in the DOM and the accessibility tree from the start; only opacity and transform
change. Do not put a reveal on the element that holds the page's main heading above the fold.
In-page links and find-in-page land on revealed content because entry is tied to scroll position.

## Performance

Native path: compositor only, no script per frame. Script path: one IntersectionObserver and
one scroll listener, coalesced to one style write per frame; no layout reads in the handler.

## Verify

Load at the top, mid-page (reload while scrolled) and via an anchor link: nothing may be stuck
hidden. Repeat with `?fallback=1` on the demo and with `?quality=static`. Automated: "scroll
reveal" in `tests/recipes-browser.test.mjs`.
