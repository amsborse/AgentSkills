# UI quality bar

The detail behind "UI taste" in `AGENTS.md`. A repository's own design skill or design system
wins on specifics (tokens, components, layout); these rules sit on top of it and of any general
design skill that is installed. Tags: **high** means the owner typed it in 5 or more sessions,
**medium** 2 to 4, **judgement** means it rests on reading the conversations rather than on
repetition. Counts: `ui-evidence.md`.

## The bar

- Premium and crafted, at the level of Apple, Stripe, Linear or Framer: visually striking but
  very clean. The test is whether it looks like experienced designers spent real time on it.
  (high)
- Never generic: no default component-library look, SaaS dashboard card grids, dashboard layouts
  for things that are not dashboards, decorative purple-blue "AI" gradients or gradient blobs.
  (high)
- Improve within the existing identity. Do not redesign unless asked, and never replace a design
  the owner liked: ship the new look as a selectable option, toggle or theme, previewable where
  the setting lives. (high)

## Signature visual

- One living visual per product (a symbol, orbit, particle or light field) used as the brand mark
  and repeated with restraint, for example in the hero, loading states and empty states. (high)
- It is part of the page, not placed on it: no square or boxed canvas, no widget inside a card;
  blend it in with masks, atmosphere and the page background. (judgement)
- Size it to the layout. An oversized hero with wasted space around it is a defect. (judgement)
- Prefer light, purposeful rendering with a static fallback; heavy 3D for its own sake is out.
  (judgement)

## Light and dark

- Dark: deep layered backgrounds (gradients, soft pools of light), luminous but controlled glow,
  never flat black and never neon everywhere. (high)
- Light: designed on its own, never an inversion. Warm, paper-like or editorial surfaces, soft
  shadows instead of glow, cards clearly separated from the background, no glare. (high)
- Every component supports both modes through shared theme tokens; no hard-coded colors. One
  clear mode toggle; printing keeps the colors. (high)

## Color

- One dominant accent, used surgically; secondary colors support it and never compete. Never fill
  whole cards, panels or matrices with saturated color. (high)
- Color that encodes meaning is wanted: status (queued, needs review, done, failed), tiers,
  overdue. Keep the mapping consistent across pages, explain it with a legend or tooltip, and
  never let color alone carry meaning; pair it with text, shape or position. (high)
- Never add color just to add color. (high)

## Readability and materials

- Text is sharp and high contrast in both modes: no faded, washed-out or muddy text, and
  no text too small to read comfortably. (high)
- Headers, footers, panels and overlays need a backing solid enough to read through. Generic
  glassmorphism or translucent haze as the default style is out. (medium)
- Crafted materials (glass with real depth, clay, paper, neon) are welcome as distinct,
  selectable themes when each is done properly. (high)

## Typography, spacing, layout

- Confident, editorial typography with clear hierarchy. Reading pages are calmer than landing
  pages. (high)
- Generous spacing and breathing room; hierarchy before decoration; every element earns its
  place. (high)
- Never fix overflow by shrinking fonts, margins or spacing, or by truncating meaningful content;
  restructure the layout instead. (high)
- The first viewport answers the main question. No clutter, no redundant buttons; dashboards fit
  one screen where possible; large sets get pagination or a grid. (high)
- Show data as visuals (charts, timelines, progress) rather than plain text lists, and explain
  numbers in plain language on hover for someone new. (high; tooltips medium)

## Cards and components

- Cards are compact (several per row on desktop) and show only the essentials in a clean layout,
  with one primary action. Details open on hover, an expand or flip, or a side panel over a
  blurred background. (high)
- Use the same card, dropdown, date picker and theme everywhere; centralize the tokens. (high)

## Motion

- Smooth, calm and purposeful: each animation explains a change (where something came from, what
  changed, what is loading). Never flashy, excessive or merely decorative. (high)
- One continuous, physical movement: parts move in sync, elements travel to their new place
  rather than vanishing and reappearing, no snaps, two-step flips or visible loop restarts.
  (high)
- Smooth at 60fps; one animation never makes another lag. Hover is stable: no vibrating, and a
  tilt moves the whole card coherently. Keep durations consistent across pages. (high)
- No gimmick effects: electric borders, cheap sparks, leftover debug visuals. (high)
- Show the system working: progress or a working state on items while jobs run, numbers counting
  up from zero, charts animating in, neither instant nor slow. (high)
- Respect reduced motion, pause animation offscreen and in hidden tabs, and keep CPU and GPU use
  low; the interface must stay fast. (medium)

## References and iteration

- A reference image is a spec: match layout, proportions, color and type closely, compare with
  screenshots of the real page, and iterate until it matches. (high)
- A UI change is done only when a screenshot of the real page shows it, per the verification
  rules in `AGENTS.md`.

## Resolved tensions

- Purple-blue gradients: rejected as a page-wide style, allowed on the signature visual itself.
- 3D: earlier preference for 2D or SVG over gimmicky 3D; later sessions accept a light,
  purposeful WebGL hero with a static fallback. The later preference wins.
- Restraint versus "use the spectrum": color is restrained unless it encodes meaning.
- Glass: translucent haze as the default is out; glass with real depth as an optional theme is
  in.
