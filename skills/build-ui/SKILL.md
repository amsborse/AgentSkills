---
name: build-ui
description: Build new UI (page, screen, flow, component) that fits its product: inspect purpose, users, brand and design system, pick a direction, implement in the project's stack, verify in the browser across viewports and themes. Use for "build a page", "create a dashboard" or "new landing page".
metadata:
  aliases: "build ui, build a page, build this page, build this screen, create a page, new page, new screen, build a dashboard, create a dashboard, new landing page, build a landing page, build a component, design and build"
  keywords: "ui, page, screen, component, dashboard, landing, layout, frontend, interface, form, design system, responsive"
  composes: "revamp-ui, add-interactions, build-animation, create-visuals, audit-design, coordinate-agents, verify"
  requires: "browser, codex-bridge?"
  risk: "medium"
---

# Build UI

New UI should look like it was always part of the product. Extend what exists: the project's
components, tokens and CSS approach come first; no new UI library or design language without
a clear need. Never default to 3D, gradients, glass, clay or cinematic: the product decides.
For improving existing screens use `revamp-ui` instead.

Before building a component, interaction or effect, search Arsenal and reuse what fits; register
what you build there (`~/agent-skills/shared/creative/arsenal.md`). Extra selectable designs
follow `~/agent-skills/shared/creative/design-variants.md`.

## Steps

1. **Inspect** the product with `~/agent-skills/shared/creative/adaptation.md`: purpose,
   users, branding, design system, content density, devices, accessibility, performance
   budget, references and framework. Write the 3–5 line direction note it asks for.
2. **Structure first:** content and states (loading, empty, error, success, long text,
   narrow screens) before decoration. Essential actions never depend on hover. Data shows
   only real values; never invent numbers.
3. **Tokens:** reuse the project's spacing, type, color and radius tokens for both themes;
   add tokens there, not inline values.
4. **Implement** with the existing framework and component library. Isolated pages or
   components go to Codex per `~/agent-skills/shared/creative/codex-orchestration.md`; you
   keep direction, review and acceptance.
5. **Enhance only where it earns its place:** interactions via `add-interactions`, motion via
   `build-animation`, visuals via `create-visuals`, 3D via `build-3d`. Each technique comes
   from `~/agent-skills/shared/creative/README.md` (load only the files you use) and its
   technology from `~/agent-skills/shared/creative/selector.md`.
6. **Browser loop:** follow `~/agent-skills/shared/creative/visual-loop.md` (render, capture,
   critique, improve, verify) at desktop, tablet and mobile, light and dark, hover, keyboard
   and reduced motion. Run `audit-design`'s runner on the result; fix every blocker and major.

## Report

Screenshot paths (before, if a page existed, and after), runner pass/fail, what was built and
any decisions left for the owner as numbered options.
