---
name: replicate-design
description: Reproduce the feel and interactions of a reference site, image or video in the user's product, ethically: capture, map each effect to a technique, rebuild with the project's stack and brand, compare side by side. Never copies protected assets. Use for "reproduce the interactions from this reference".
metadata:
  aliases: "replicate design, replicate this design, reproduce the interactions, from this reference, like this reference, make it like this site, copy this interaction, recreate this effect, reference site, match this reference"
  keywords: "reference, replicate, reproduce, recreate, inspiration, interaction, effect, site, video, screenshot, compare"
  composes: "build-ui, add-interactions, build-animation, build-3d, audit-design, verify"
  requires: "browser"
  risk: "medium"
---

# Replicate design

Reproduce how a reference feels and behaves, not its property. Never copy its images, fonts,
logos, copy, 3D models or source code; rebuild the behaviour with the user's brand and stack.
A static cinematic scene image goes to `build-animation` (cinematic-plate workflow).

## Steps

Follow the nine steps in `~/agent-skills/shared/creative/reference-workflow.md`:

1. Confirm the reference and the target (which page in which product).
2. Capture ethically: robots.txt respected, logged out, screenshots and short recordings only,
   `--allow-remote` only for a URL the user gave.
3. Break the reference into effects (layout, type, motion, interactions, lighting, transitions).
4. Map each effect to a technique in `~/agent-skills/shared/creative/README.md`; load only those
   files.
5. Adapt to the product with `~/agent-skills/shared/creative/adaptation.md`: keep the user's
   branding; drop effects that do not fit their users or performance budget.
6. Choose technology with `~/agent-skills/shared/creative/selector.md`.
7. Implement (delegate isolated parts per `~/agent-skills/shared/creative/codex-orchestration.md`).
8. Compare reference and result side by side at the same viewport and state; iterate.
9. Verify with `~/agent-skills/shared/creative/visual-loop.md` and the `audit-design` runner.

## Report

The effect map (reference effect → technique → where it lives now), side-by-side screenshot
paths, what was intentionally not reproduced and why.
