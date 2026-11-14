# Scroll-driven choreography

Elements enter, transform and hand off to each other as the user scrolls, telling a story in
sequence. Scroll drives progress; the user stays in control.

## Use when

- Landing pages, launches, editorial features, explainers (Persuade and Read surfaces).
- Not on app screens where people scroll to find things quickly.

## Options

- **CSS scroll-driven animations:** `animation-timeline: view()` for reveals and
  `scroll()` for progress; `animation-range` sets start and end.
- **IntersectionObserver + WAAPI or CSS classes:** one-shot reveals; the widest support.
- **GSAP ScrollTrigger:** pinned sections, long scrubbed timelines, many coordinated elements.
- **Motion `useScroll` + `useTransform`:** React projects already on Motion.
- **Smooth scroll (Lenis)** only if the owner wants it and it is already used; never hijack
  scroll speed or direction.

## Dependencies

None for CSS/IO. GSAP or Motion only when already present or the sequence needs pinning and
scrubbing that CSS cannot do.

## Accessibility

Content is readable without scrolling animation (no text that only appears mid-animation and
vanishes). Reveals run once and do not replay on small scrolls. Pinned sections must not trap
keyboard users; anchors and Tab still reach every section.

## Performance

Low for CSS, medium for JS. No scroll listeners reading layout; use the timeline APIs or one
rAF loop. Pinned sections recalculate on resize: debounce.

## Compatibility

CSS scroll-driven animations: Baseline since late 2026, still feature-detect with
`@supports (animation-timeline: view())` and fall back to IntersectionObserver or a static
page.

## Reduced motion

Content appears in place (opacity only or instant). No pinning, scrubbing or parallax.

## Verify

- Scroll top to bottom at normal and fast speed; no jank, no content stuck invisible.
- Full-page screenshot with reduced motion shows all content.
- `visual-audit`: CLS ≤ 0.1, no long frames during scroll, reduced-motion clean.
