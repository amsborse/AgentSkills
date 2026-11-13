# Hover affordance on tiles and cards

Hover effects that make a card obviously clickable: the tile glows or rises, its link underline
grows, its arrow nudges forward. Taken from the 2026-11 portfolio project grid
(`amsborse.github.io`, `src/components/projects/projects.css`). Use two or three of these
together, never all at once on one element, and give every one a keyboard-focus twin.

## The vocabulary

- **Hover elevation / glow:** the border shifts to the accent line colour and the shadow grows.
  In dark mode the shadow carries a faint accent ring (controlled glow); in light mode it is a
  soft warm drop shadow, never a glow.
- **Lift:** the card, or one element inside it (an emblem, an image), rises with
  `translateY(-2px … -4px)`.
- **Underline grow (animated underline):** a pseudo-element under the link text scales from 0 to
  full width with `transform: scaleX()`, from the left.
- **Arrow nudge:** a trailing `→` (with `aria-hidden="true"`) slides right with `translateX(4px)`.
- **Stretched link (whole-card hover):** one real link inside the card whose `::after` covers
  the card, so the entire tile is a single click target and a single tab stop.
- **Focus parity:** every `:hover` rule is written as `:is(:hover, :focus-within)` on the card
  (or `:focus-visible` on the link), so keyboard users see the same affordance.

## Rules

- Animate `transform`, `opacity`, `box-shadow` and `border-color` only. Never width, height,
  margin, padding or font-weight: hover never shifts layout or neighbours.
- 150–400 ms with an ease-out curve (`cubic-bezier(0.22, 1, 0.36, 1)` or the project's token).
  Leaving hover runs the same transition back; nothing snaps.
- Colours come from theme tokens (`--color-accent-line`, `--shadow-card-hover`) defined for both
  themes. No hard-coded dark colours.
- One primary action per card. Secondary links stay above the stretched link
  (`position: relative; z-index: 1`) so they remain clickable.
- `prefers-reduced-motion: reduce` drops the movement (lift, nudge, scale) but keeps the colour
  and shadow change, so the affordance is still visible.
- Touch devices have no hover. Gate movement with `@media (hover: hover)` if it would stick after
  a tap; the card must read as clickable without hover anyway.

## CSS

```css
/* Theme tokens: dark glows, light casts a soft shadow. */
:root {
  --ease-out-luxe: cubic-bezier(0.22, 1, 0.36, 1);
  --color-accent-line: rgba(242, 169, 59, 0.4);
  --shadow-card: 0 1px 0 rgba(255, 255, 255, 0.04), 0 6px 16px -8px rgba(0, 0, 0, 0.8);
  --shadow-card-hover:
    0 1px 0 rgba(255, 255, 255, 0.06), 0 8px 20px -6px rgba(0, 0, 0, 0.9),
    0 28px 56px -20px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(242, 169, 59, 0.18);
}
[data-theme="light"] {
  --color-accent-line: rgba(154, 74, 6, 0.35);
  --shadow-card: 0 1px 0 #fff, 0 6px 16px -8px rgba(68, 64, 60, 0.14);
  --shadow-card-hover:
    0 1px 0 #fff, 0 8px 20px -6px rgba(68, 64, 60, 0.16),
    0 28px 56px -20px rgba(68, 64, 60, 0.2), 0 0 0 1px rgba(154, 74, 6, 0.16);
}

/* Card: elevation/glow on hover or keyboard focus. */
.card {
  position: relative;
  border: 1px solid var(--color-border-strong);
  box-shadow: var(--shadow-card);
  transition:
    border-color 360ms var(--ease-out-luxe),
    box-shadow 360ms var(--ease-out-luxe),
    transform 360ms var(--ease-out-luxe);
}
.card:is(:hover, :focus-within) {
  border-color: var(--color-accent-line);
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-3px); /* lift; or lift only an inner emblem */
}

/* Stretched link: the whole card is one target and one tab stop. */
.card__link::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
}
.card__secondary { position: relative; z-index: 1; }

/* Underline grow. */
.card__link {
  position: relative;
  text-decoration: none;
}
.card__link-text {
  background: linear-gradient(currentColor, currentColor) 0 100% / 100% 1px no-repeat;
  background-size: 0 1px;
  transition: background-size 300ms var(--ease-out-luxe);
}
.card:is(:hover, :focus-within) .card__link-text { background-size: 100% 1px; }

/* Arrow nudge. */
.card__arrow {
  display: inline-block;
  transition: transform 300ms var(--ease-out-luxe);
}
.card:is(:hover, :focus-within) .card__arrow { transform: translateX(4px); }

/* Visible focus ring on the real link (the card glow alone is not a focus indicator). */
.card__link:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 4px;
}

/* Reduced motion: keep the colour and shadow change, drop the movement. */
@media (prefers-reduced-motion: reduce) {
  .card, .card__arrow, .card__link-text { transition: none; }
  .card:is(:hover, :focus-within),
  .card:is(:hover, :focus-within) .card__arrow { transform: none; }
}
```

The underline uses `background-size` rather than a `::after` with `scaleX`, because the
stretched link already owns `::after`. On a plain link with no stretched target, the `::after`
version is equivalent:

```css
.link { position: relative; }
.link::after {
  content: "";
  position: absolute;
  left: 0; right: 0; bottom: -2px;
  height: 1px;
  background: currentColor;
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 300ms var(--ease-out-luxe);
}
.link:is(:hover, :focus-visible)::after { transform: scaleX(1); }
```

## Markup

```html
<article class="card">
  <h3>Project name</h3>
  <p>One-line summary.</p>
  <a class="card__link" href="/projects/name">
    <span class="card__link-text">Read the case study</span>
    <span class="card__arrow" aria-hidden="true">→</span>
  </a>
  <a class="card__secondary" href="https://github.com/…">Source</a>
</article>
```

## Verify

Screenshot each card at rest and hovered in both themes, plus one with keyboard focus (Tab to it),
and one hovered with reduced motion emulated: colour and shadow change, nothing moves. Check that
hovering does not move neighbouring cards (compare bounding boxes before and after in a
Playwright test) and that a secondary link inside the card still opens its own target.
