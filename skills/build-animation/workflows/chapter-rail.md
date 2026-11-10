# Chapter rail and slow scroll

A navigation pattern for long, chaptered pages (portfolio home, long essays, product stories). The
owner liked it in the 2026-11 portfolio revamp; reuse it rather than inventing a new one.

- **Rail:** a thin fixed line on the right edge that fills with spring-eased scroll progress, and
  one dot per chapter. Every dot is a plain in-page link, so it is navigation, not decoration.
  The active chapter's dot is marked; labels appear on hover or keyboard focus.
- **Slow scroll:** Lenis with a long expo ease, so wheel scrolling and dot jumps glide.

## Rail (React + framer-motion)

```tsx
export function ChapterRail({ chapters }: { chapters: { id: string; label: string }[] }) {
  const reduce = usePrefersReducedMotion(); // reactive; see "Reduced motion" below
  const { scrollYProgress } = useScroll();
  const eased = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.4 });
  const [active, setActive] = useState(chapters[0].id);

  useEffect(() => {
    const sections = chapters
      .map((c) => document.getElementById(c.id))
      .filter((n): n is HTMLElement => n !== null);
    // A chapter is current while it crosses the middle 10% of the viewport.
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-45% 0px -45% 0px" }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [chapters]);

  return (
    <nav className="chapter-rail" aria-label="Chapters on this page">
      <span className="chapter-rail__track" aria-hidden="true">
        <motion.span className="chapter-rail__current"
          style={{ scaleY: reduce ? scrollYProgress : eased }} />
      </span>
      <ol>
        {chapters.map((c) => (
          <li key={c.id}>
            <a href={`#${c.id}`} className="chapter-rail__stop"
              aria-current={active === c.id ? "location" : undefined}>
              <span className="chapter-rail__label">{c.label}</span>
              <span className="chapter-rail__dot" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

CSS essentials:

- `.chapter-rail` is `position: fixed; top: 50%; right: ~1.1rem; transform: translateY(-50%)`.
  Show it only where there is room (`min-width: 1280px and min-height: 560px`); hide it on phones.
- The track is a 1px line in the strong border color. The fill uses `transform-origin: top`,
  the accent color and a soft accent glow. Animate only `scaleY`.
- Stops are at least 44px tall (`min-height: 2.75rem`) for touch and pointer targets.
- Dots are a radial gradient: an ink core, a ring in the background color, then transparent. That
  makes the dot cut the line cleanly in both themes. The current dot scales up with a 300ms
  ease-out.
- Labels sit on an elevated surface with a border. They are hidden (`opacity: 0`, nudged 6px)
  until `.chapter-rail:hover` or `:focus-within`. Add a `:focus-visible` outline in the accent.

## Slow scroll (Lenis)

```ts
const lenis = new Lenis({
  duration: 1.5,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  anchors: { offset: -80 }, // clears a fixed header when a dot link is clicked
});
```

Skip Lenis entirely under reduced motion, and destroy it on unmount.

## Reduced motion

framer-motion's `useReducedMotion` reads the setting once and does not update when the user
changes it mid-visit. Subscribe to the media query instead:

```ts
const query = "(prefers-reduced-motion: reduce)";
function subscribe(onChange: () => void) {
  const mq = window.matchMedia(query);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
```

Under reduced motion, the fill follows raw scroll progress with no spring, and dot jumps are
instant.

## Tests

- Clicking a dot lands its chapter below the fixed header, and `aria-current` moves to that dot.
- Scrolling through each chapter moves `aria-current` in order.
- The rail is hidden at phone width and visible at 1440.
- Reduced motion toggled mid-visit (Playwright `page.emulateMedia({ reducedMotion: "reduce" })`
  after load) takes effect without a reload.
- Check IntersectionObserver claims in a real browser. A review once claimed that this
  `rootMargin` misses short chapters, and a Chromium probe showed the claim was wrong.
