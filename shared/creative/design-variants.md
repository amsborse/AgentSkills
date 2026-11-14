# Design variants: N looks for one product

Use this when the owner wants several selectable designs of the same site (for A/B viewing or
a design switcher), or asks for "another design". The liked design stays the default and is
never changed; every new look is one more entry.

## Shape

- **One attribute:** the active design sits on the root element (`<html data-design="…">`),
  next to the theme. A design never changes content, routes or data, only how they look and
  move.
- **One registry:** a typed list of designs (id, label, one-line description, and the hooks
  below). Adding design N means adding one entry; nothing else branches on design ids. Arsenal
  has a generic registry helper; search for "design registry" before writing one.
- **One skin per design:** a CSS file scoped under `[data-design="id"]` that overrides tokens
  first (type, colour, spacing, radii, shadows for both themes), then a few component rules.
- **Per-design hooks, all lazy:** a hero component, page effects (cursor, overlays) and a plate
  treatment for section images. Each is loaded only when its design is active, so the default
  design ships no extra bytes.
- **Persistence:** the choice is stored like the theme, readable from a `?design=` query so a
  link opens a specific design.

## Each design must be distinct

A new design is a different idea, not the same page with a filter. Check each against the
others:

- **Hero:** its own image or living visual, made for that design (a procedural engraving, a
  drafting sheet that draws itself), never the default hero image pixelated or recoloured.
- **Interaction:** one signature interaction of its own (a crosshair that reads out x/y, a
  beam that follows the pointer, a print-in on arrival), with reduced motion and touch
  fallbacks.
- **Type, colour and layout:** a different type pairing and accent, and at least one
  structural change (columns, rules, grid), not only new colours.

## Building design N

1. Search Arsenal (`arsenal.md`) for heroes, interactions and effects that fit the new idea;
   reuse or extend them.
2. Add the registry entry and the skin, then the hero, effects and plate hooks.
3. Verify every design, not only the new one: desktop and mobile, light and dark, the hero's
   load and pointer behaviour, no console errors, and the bundle budget.
4. Port whatever new piece it needed to Arsenal and register it, so design N+1 starts from it.
