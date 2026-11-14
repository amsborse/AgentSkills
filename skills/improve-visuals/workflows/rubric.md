# Visual rubric

Score each page on every dimension from its screenshots (desktop and mobile, light and dark).
Each score cites the screenshot it came from. Judge against the product's mode from
`~/agent-skills/shared/creative/adaptation.md`: a reading page is calmer than a landing page.

Anchors, for every dimension:

- **0** broken: overlapping, clipped, unreadable or missing.
- **1** wrong: works, but hurts trust (clashing, cramped, inconsistent).
- **2** template: correct but generic; looks like a default component library or "vibe coded".
- **3** decent: considered and consistent, nothing memorable. Most "fine" pages are here.
- **4** crafted: deliberate choices visible everywhere; a small senior team made it.
- **5** reference level: Apple, Stripe or Linear; nothing to add or take away.

Score the worst theme and viewport, not the best: a page with a 4 on desktop dark and a 2 on
mobile light scores 2.

| # | Dimension | What to look at |
|---|---|---|
| 1 | Hierarchy and first viewport | One clear focal point; the first screen answers the main question; reading order obvious at a squint |
| 2 | Typography | One scale with real contrast between levels, comfortable measure (45–75 characters), line height, weight and tracking per size, no orphans in headings |
| 3 | Spacing and composition | One spacing scale, consistent rhythm between sections, alignment to a grid, density fits the mode, generous but not empty |
| 4 | Color | One dominant accent used surgically, colors never compete, meaning-carrying color has a legend, contrast is sharp |
| 5 | Depth and surfaces | Dark is layered (gradients, pools of light, controlled glow), light is warm paper with soft shadows, cards visibly separate from the background |
| 6 | Imagery and signature visual | One living visual that belongs to the page (masked, blended), sharp assets, no boxed canvases, no placeholders, no dead space |
| 7 | Components and consistency | Same card, button, dropdown and theme components on every page; compact cards with one primary action |
| 8 | Interaction states | Hover, focus-visible, press, disabled, loading, empty and error states are designed, not default |
| 9 | Motion feel | Continuous, physical, calm; elements travel rather than snap; every animation says something; reduced motion still feels designed |
| 10 | Detail and finish | Icon set and stroke consistent, radii and borders consistent, optical alignment, copy reads as design (short, specific), mobile edge cases (wrapping, safe areas) |

Save as JSON so rounds compare:

```json
{ "round": "r0", "pages": { "/": { "hierarchy": { "score": 3, "shot": ".visual/r0/desktop-dark.png", "note": "two competing focal points" } } } }
```
