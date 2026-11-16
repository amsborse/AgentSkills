# Creative engineering studies

Open `index.html` directly in a browser (`file://`), or serve the repository with any static server and visit `/demos/creative/`. No installation, assets, network requests or build step are required.

## Direction

These fictional examples take their direction from the task. **Relay / Operate** is a dispatch signal desk: Bahnschrift and Consolas, amber notation on warm instrument paper or layered blue slate, terse duty language, and routing integrated into the working surface. **Interval / Read** is a journal composed like a score: Arial titles and Georgia prose, cobalt on chalk paper or pale blue on ink, and an unhurried voice about close listening. Persuade keeps its blended particle field. Each page has a restrained accent and independently designed light and dark tokens. The original Operate and Read studies remain in `v1/`, linked from the index.

## Studies and techniques

- **[Operate](operate-dashboard.html)**: the existing `spring-states` and `scroll-reveal` recipes plus the shared quality runtime. SVG stages expose identical details through hover, focus, tap and Enter/Space; a selection marker travels along the circuit. A bounded count-up introduces the sample totals. Routing signals communicate running dispatch and stop when dispatch is held, offscreen, hidden or static. The circuit is an illustration, not a live throughput measurement; queue totals stay fixed. A duty docket and request ledger replace the former card grid.
- **[Read](read-editorial.html)**: the existing `spring-states` and `scroll-reveal` recipes plus the shared quality runtime. A full-width conceptual score opens its interval through a keyboard-accessible button; notation travels to make the pause visible. Reading progress, section entrances and an inline note support the essay while its prose stays still. An asymmetric edition rail, oversized sans title and cobalt notation deliberately differ from Field Notes. There is no audio, recording or measured sound data.
- **[Persuade](persuade-landing.html)**: [fluid particles](../../shared/creative/techniques/fluid-particles.md), [organic masks](../../shared/creative/techniques/organic-masks.md), [cursor light](../../shared/creative/techniques/cursor-light.md), [magnetic hover](../../shared/creative/techniques/magnetic-hover.md) and [interactive tilt](../../shared/creative/techniques/interactive-tilt.md). Deterministic canvas flow has a still initial composition. Play/Pause explicitly enables optional continuous motion; the loop stops while paused, offscreen, hidden, or under reduced motion. Canvas DPR is capped at 2. Pointer flourishes use stable hit areas, cached geometry, coalesced writes and fine-pointer gating.

## Themes and access

System `prefers-color-scheme` is the default. Set `data-theme="light"` or `data-theme="dark"` on `<html>` to override it, or use the page's Dark theme toggle. The toggle reports its state with `aria-pressed`; no storage is needed for themes, including from `file://`. Reload returns to the OS preference. All pages contain semantic landmarks, a skip link, visible focus styles and responsive layouts. Operate and Read accept `?quality=static|low|balanced|high|ultra`; reduced motion takes priority and keeps all state changes without travel. Hidden-tab and intersection gates pause animation work.

## Audit

From the repository root, with a local static server already running:

```sh
node skills/audit-design/scripts/visual-audit.mjs --url <served url> --project <dir with playwright> --out .visual/demos/<name>
```

Run for each HTML page, including the index. The runner checks 390px, 834px and 1440px widths in both themes. Inspect screenshots as well as reports. Manually check SVG focus/tap details, toggle announcements, particle Play/Pause, hidden-tab stopping, fine/coarse pointers and live reduced-motion changes. Opt in to particle motion when checking active animation, since idle is deliberately still.

## Validation in this workspace

All four inline scripts passed Node syntax parsing, and an HTML check confirmed local links and IDs with no external assets. Browser verification remains outstanding: the audit runner found Playwright 1.61.0, but its installed Chromium could not launch (`spawn EPERM`). Playwright 1.64.1 was also found, but its required Chromium revision is not installed. The audit was attempted against the local `file://` dashboard; no browser run completed. No viewport, contrast, interaction or screenshot audit is claimed as passed.

The final review also removed ancestor animation resumption (each entrance owns its intersection and visibility gates) and restricted button hover styling to fine pointers. Each entrance starts paused until its own intersection observer confirms visibility.
