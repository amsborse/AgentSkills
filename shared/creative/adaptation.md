# Design adaptation

Pick a design language from the product, never from a default. No 3D, gradients, glass, clay,
cinematic motion or any other named style unless the product and the user call for it.
Established branding stays unless the user asks for a redesign.

## 1. Inspect before choosing

Write one short paragraph from evidence (code, content, README, existing screens), not guesses:

| Signal | Where to look |
|---|---|
| Purpose and core task | README, routes, the primary screen's main action |
| Target users and context | Copy, onboarding, docs; desk, phone, field, kiosk, TV |
| Existing branding | Logo, token files, theme config, CSS variables, brand docs |
| Design system | Component library, Tailwind config, tokens, Storybook |
| Content density | Rows per screen, numbers, long-form text, media share |
| Devices | Viewport meta, breakpoints, touch targets, input type (pointer, touch, remote) |
| Accessibility needs | Audience, legal context, existing a11y tests |
| Performance budget | Target devices, current bundle, LCP, existing heavy assets |
| References | Anything the user supplied (then follow `reference-workflow.md`) |
| Framework and dependencies | package.json: UI framework, motion and 3D libraries already present |

Unknown signals stay marked unknown; ask once only if the choice really depends on them.

## 2. Surface mode

Every screen leans one way; it decides how much expression the design may carry.

- **Operate** (dashboards, tools, admin, finance): speed and accuracy first. Dense but calm,
  motion confirms state only, decoration near zero.
- **Read** (docs, editorial, education): comprehension first. Typographic, generous measure
  (60–75 characters), motion supports narrative, never interrupts reading.
- **Persuade** (landing, portfolio, product, launch): emotion and memory first. Room for one
  signature visual and choreographed motion, still bounded by performance and access.

A product can mix modes per route (marketing site = Persuade, app = Operate). Keep one design
language across them: same tokens, type and components, different intensity.

## 3. Product type to language

Starting points, not templates. Brand and references override them.

| Product | Language | Motion intensity | Typical techniques |
|---|---|---|---|
| Enterprise app | Precise, restrained, trustworthy | 1 (state feedback) | spring-feedback, shared-element-transitions |
| Financial app | Clear, credible, information-dense | 1 | interactive-diagrams, shared-element-transitions |
| Editorial | Typographic, narrative, readable | 2 (narrative) | scroll-choreography, media-reveals, kinetic-typography (sparingly) |
| Educational | Interactive, explanatory, approachable | 2–3 | interactive-diagrams, animated-illustrations, drag-interactions |
| E-commerce | Product-focused, tactile, visually rich | 2 | media-reveals, interactive-tilt, shared-element-transitions |
| Creative portfolio | Expressive, immersive, experimental | 3–4 | shader-distortion, organic-masks, cursor-light, scene-transitions |
| Game | Playful, animated, spatial | 4 | spring-feedback, fluid-particles, environmental-lighting |

Intensity scale: **0** none, **1** feedback only (≤200 ms), **2** narrative transitions,
**3** choreographed sequences and one signature visual, **4** immersive or spatial scenes.
Never exceed the level the surface mode allows; go one level lower when unsure.

## 4. Craft floor (every product, every style)

- One type scale, one spacing scale, one accent used sparingly; tokens for both themes.
- Clear hierarchy: the first screen answers what this is and what to do.
- Every interactive element has hover, focus-visible, active, disabled and loading states.
- Text contrast meets WCAG AA in both themes; targets at least 24 px (44 px on touch).
- Empty, loading and error states are designed, not blank.
- Generic AI tells are rejected unless asked for: purple-blue default gradients, emoji icons,
  centered everything, identical card grids, glow without purpose, filler copy.

## 5. Record the choice

Write the direction in 3–5 lines (surface mode, language, intensity, techniques, what stays
from the existing brand) in the task notes or PR, so later passes and reviewers keep to it.
