# Interactive diagrams

Diagrams and charts people can explore: hover to highlight, click to drill in, step through a
process, scrub a parameter and watch the result change.

## Use when

- Explaining systems, flows, architecture, data, math or processes (Read and Operate surfaces,
  education, finance, developer tools).
- Only with real data or a true model of the system; never invented numbers.

## Options

- **Inline SVG** with CSS states for small diagrams; `<g>` groups with focusable elements.
- **D3 (modules only)** for scales, layouts and data joins; render with the project's framework.
- **Chart library already in the project** (Recharts, Chart.js, ECharts, Observable Plot).
- **Canvas** for thousands of marks; keep an accessible data table alongside.
- **Stepper:** one diagram, numbered states, Next/Prev controls and keyboard arrows.

## Dependencies

None for SVG. A chart library only if already present or the chart type needs it; prefer
small modular imports.

## Accessibility

Every interactive part is focusable with a label; values are available as text (table, list
or `aria-describedby`). Color is never the only signal; include a legend. Tooltips appear on
focus as well as hover.

## Performance

Medium. SVG with more than ~2,000 nodes slows; switch to canvas. Debounce parameter scrubbing
that triggers recalculation.

## Compatibility

All modern browsers.

## Reduced motion

Transitions between states become instant; the information is identical.

## Verify

- Operate the diagram with the keyboard alone; every value is reachable.
- Screenshots of key states in both themes; legend and labels readable (contrast check).
- Numbers match their source.
