# Style add-on: claymorphism

The interface is soft, tactile and made of matte clay. Surfaces look puffy and pressable. Motion
feels physical: things squash, settle and spring. The aim is premium and calm, not a toy, so keep
the cinematic feel of slow scroll, a single living visual and travel instead of snaps, and swap
the material.

## Material and tokens

- **Clay surface:** a large radius (`--radius-clay: 24–36px`; pills for buttons) and a matte fill
  with a very subtle vertical gradient (2–4% lightness). Use three shadows together:
  - an outer drop shadow, soft and wide, offset down and tinted with the surface hue, never
    grey: `0 18px 40px -12px hsl(var(--hue) 40% 30% / .28)`;
  - an inner highlight at the top left: `inset 6px 6px 12px hsl(0 0% 100% / .55)`;
  - an inner shade at the bottom right: `inset -6px -8px 14px hsl(var(--hue) 35% 25% / .18)`.
- **Elevation scale:** define about three levels (`--clay-1/2/3`) as shadow tokens. Pressed is
  the same shadows with the insets swapped and the outer shadow tightened.
- **Light:** warm paper background (`hsl(36 40% 96%)`), and clay a little warmer or tinted than
  the background so cards stay visibly separate.
- **Dark:** deep tinted clay (`hsl(var(--hue) 20% 14–20%)`), never black. Highlight insets drop
  to about 8–12% white and outer shadows get darker and tighter. It should feel like clay under a
  lamp, with no neon glow.
- **Color:** pastel surfaces are allowed, but only one saturated accent, used for the primary
  action, the active state and the progress fill. Meaning colors (status) are muted clay tones
  plus an icon or label.
- **Type:** a rounded or soft geometric sans for display (e.g. a rounded grotesk), a clean sans
  for body. Text is never pastel on pastel: keep body ink dark (light mode) or near-white (dark
  mode).

## Signature visual

A single clay object or scene that belongs to the product, like a sculpted mascot, a symbol, or a
small diorama, blended into the hero with a soft floor shadow, never in a box. You can build it
as either of these:

- **Clay plate (preferred for speed):** a generated, text-free soft 3D clay render. This is the
  cinematic-plate method with "matte clay, soft studio light, subsurface softness" in the
  prompt. Add live layers on top: gentle float on a sine-noise path, a shadow that breathes with
  the float, and a slow pointer tilt (±4°).
- **Real 3D:** three.js with a matte `MeshPhysicalMaterial` (roughness about 0.85, small
  sheen), soft area or hemisphere light and contact shadows. Same governor and still-first rules
  as any WebGL hero.

## Motion character

- **Springs, with a little give:**
  - Hover: lift `translateY(-2px to -4px)` while the outer shadow grows. Spring at stiffness
    260–320 and damping 18–22, with slight overshoot.
  - Press: squash `scale(.97)`, insets swap to pressed, and it releases with a spring. The
    squash takes 120–180 ms and the release settles in 300–450 ms.
  - Toggles and tabs: the selected pill slides to its new place (shared layout or FLIP), never
    cross-fades.
- **Page scroll:** keep the shared feel. Use Lenis and the chapter dot rail; the rail dots can be
  small clay beads, and the fill is a soft accent line. Sections rise in with a spring (a short
  distance, about 16–24px) rather than a long fade.
- **Ambient:** at most one floating thing at a time, moving slowly on continuous noise.
- **Under reduced motion:** no float, tilt or overshoot. State changes cross-fade in 150 ms or
  less, and scroll is instant.

## Performance

- Never animate `box-shadow` directly on many elements. Put the hover or pressed shadow on a
  `::after` layer and animate its `opacity`, and animate `transform` on the element.
- Layered inset and outer shadows are cheap when static. Keep blur radii to 40px or less on
  lists of more than about 20 items.
- The 3D hero follows `skills/build-animation/workflows/heavy-hero-performance.md`.

## Accessibility

- Clay depth is not the only cue for interactivity. Buttons also differ in color or weight, and
  have a visible `:focus-visible` ring in the accent with a 3px offset.
- Check contrast on every pastel surface in both themes, aiming for 4.5:1 for body text and 3:1
  for UI boundaries. Pastel cards usually need a hairline border (`1px` at about 6% ink) in light
  mode.
- Touch targets are at least 44px. The puffy look makes this easy.

## Anti-patterns

- Every element clay-shaded. Use clay for cards, primary controls and the hero; text areas and
  dense tables stay flat.
- Rainbow pastel cards.
- Grey shadows.
- Bouncy overshoot on everything, or wobble loops.
- 3D emoji clip art as decoration.
- Clay dark mode made by inverting the light tokens.

## Verify

- Screenshots at 1440 and 390, light and dark: the hero, a card grid, and a pressed button.
- Record a short clip of hover, press and tab switch, and check there are no snaps.
- A reduced-motion pass.
- Frame-time check on the hero, and Lighthouse on mobile with CLS at 0.
