# Creative engineering studies

Open `index.html` directly in a browser (`file://`), or serve the repository with any static server and visit `/demos/creative/`. No installation, assets, network requests or build step are required.

## Direction

These fictional examples use one system of type, spacing, controls and accessible states. Operate uses precise, compact feedback at intensity 1; Read uses generous editorial type and short, once-only narrative entrances at intensity 2; Persuade uses one blended particle field at intensity 3. There is no existing product brand to preserve. Each page has a restrained accent and independently designed light and dark tokens.

## Studies and techniques

- **[Operate](operate-dashboard.html)**: [spring feedback](../../shared/creative/techniques/spring-feedback.md), subtle card lift, and [interactive diagrams](../../shared/creative/techniques/interactive-diagrams.md). SVG stages expose identical details through hover, focus, tap and Enter/Space. Dispatch is a local simulation; all queue data is labeled sample data.
- **[Read](read-editorial.html)**: [kinetic typography](../../shared/creative/techniques/kinetic-typography.md), [scroll choreography](../../shared/creative/techniques/scroll-choreography.md) and [media reveals](../../shared/creative/techniques/media-reveals.md). Inline SVG and an example note replace external media. Figures enter once; content remains visible without JavaScript. Reading progress updates only on scroll or resize.
- **[Persuade](persuade-landing.html)**: [fluid particles](../../shared/creative/techniques/fluid-particles.md), [organic masks](../../shared/creative/techniques/organic-masks.md), [cursor light](../../shared/creative/techniques/cursor-light.md), [magnetic hover](../../shared/creative/techniques/magnetic-hover.md) and [interactive tilt](../../shared/creative/techniques/interactive-tilt.md). Deterministic canvas flow has a still initial composition. Play/Pause explicitly enables optional continuous motion; the loop stops while paused, offscreen, hidden, or under reduced motion. Canvas DPR is capped at 2. Pointer flourishes use stable hit areas, cached geometry, coalesced writes and fine-pointer gating.

## Themes and access

System `prefers-color-scheme` is the default. Set `data-theme="light"` or `data-theme="dark"` on `<html>` to override it, or use the page's Dark theme toggle. The toggle reports its state with `aria-pressed`; no storage is needed, including from `file://`. Reload returns to the OS preference. All pages contain semantic landmarks, a skip link, visible focus styles and responsive layouts. Reduced motion removes entrances, lift, tilt, magnetism and tracking while preserving content and state changes. Hidden-tab and intersection gates pause animation work.

## Audit

From the repository root, with a local static server already running:

```sh
node skills/audit-design/scripts/visual-audit.mjs --url <served url> --project <dir with playwright> --out .visual/demos/<name>
```

Run for each HTML page, including the index. The runner checks 390px, 834px and 1440px widths in both themes. Inspect screenshots as well as reports. Manually check SVG focus/tap details, toggle announcements, particle Play/Pause, hidden-tab stopping, fine/coarse pointers and live reduced-motion changes. Opt in to particle motion when checking active animation, since idle is deliberately still.

## Validation in this workspace

All four inline scripts passed Node syntax parsing, and an HTML check confirmed local links and IDs with no external assets. Browser verification remains outstanding: the audit runner found Playwright 1.61.0, but its installed Chromium could not launch (`spawn EPERM`). Playwright 1.64.1 was also found, but its required Chromium revision is not installed. The audit was attempted against the local `file://` dashboard; no browser run completed. No viewport, contrast, interaction or screenshot audit is claimed as passed.

The final review also removed ancestor animation resumption (each entrance owns its intersection and visibility gates) and restricted button hover styling to fine pointers. Each entrance starts paused until its own intersection observer confirms visibility.
