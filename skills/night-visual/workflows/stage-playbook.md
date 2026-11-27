# Stage-Aware Visual Upgrade Playbook

Adapt each `night-visual` iteration to the repository's detected lifecycle stage and product surface.
Apply the standing taste bar in `~/agent-skills/working-agreements/AGENTS.md` and `ui-quality.md`.

## 1. By Repository Stage

### Stage: `seed` / `prototype` (Foundations First)
- **Tokenize ad-hoc styles:** Extract repeated raw hex codes, arbitrary spacing, and inconsistent radii into semantic CSS variables / Tailwind theme tokens (`--surface`, `--surface-elevated`, `--text-primary`, `--accent`).
- **Fix first-viewport clarity & layout breaks:** Eliminate horizontal overflow at `390px`, cramped touch targets (`< 44px`), clipped modals, and empty white-screen initial states.
- **Designed dual themes:** Ensure dark mode uses layered charcoal/obsidian surfaces with subtle border separation (never flat `#000` with harsh `#fff` borders) and light mode uses warm paper surfaces with crisp elevation shadows (never naive color inversion).

### Stage: `mvp` (Product Craft — Linear / Stripe / Raycast Bar)
- **Typographic authority:** Tight display tracking on headings, tabular numerals (`font-variant-numeric: tabular-nums`) on metrics/prices/timers/scores, high-contrast body copy, zero washed-out muted text.
- **Compact scannable cards & tables:** One primary action per card; secondary metadata progressive on hover, drawer, or expand. Sticky table headers with solid/blurred backing so scrolling content never bleeds unreadably underneath.
- **States that show the system working:** Skeleton or shimmer placeholders matching exact layout geometry (zero CLS), optimistic toggle states, clear empty/error/loading states with direct recovery actions.

### Stage: `production` (Signature Polish & Micro-Motion)
- **Calm physical motion:** Continuous 60fps transitions (`transform`/`opacity` only), shared-element active indicators, spring press feedback, staggered initial reveals (`<= 250ms`), strict `@media (prefers-reduced-motion: reduce)` fallbacks, and `IntersectionObserver` pausing offscreen loops.
- **Signature living visual (as option/toggle when existing hero is loved):** Blended seamlessly into the page via radial/linear masks and atmosphere—never trapped inside a boxed card border.

## 2. Game Canvas, WebGL & Interactive Surfaces (`game` signal)

- **HUD & Overlay Legibility:** Crisp contrast plates or subtle drop-shadows behind score/health/ammo counters over bright and dark gameplay backgrounds; `tabular-nums` so fast-changing counters never jitter horizontally.
- **Responsive Viewport Scaling:** Clean aspect-ratio scaling / safe-area padding across `16:9`, `16:10`, ultrawide, and mobile portrait/landscape without stretched pixels or clipped corner HUD widgets.
- **Tactile Menu & Pause States:** Instant keyboard/gamepad focus rings on title/pause/upgrade menus, clear hover/selection affordances, and readable tooltip breakdowns for stacked modifiers.
