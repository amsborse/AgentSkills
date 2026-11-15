---
name: audit-design
description: Audit a running site or app's visual quality with evidence: screenshots across viewports and both themes, measured checks (contrast, overflow, focus, hover, reduced motion, offscreen rendering, layout shift) and a ranked P0–P3 critique. Read-only. Use for "audit this website's visual quality" or "visual audit".
metadata:
  aliases: "audit design, visual audit, design audit, audit visual quality, visual quality, design review, ui audit, audit this website, audit the ui, motion audit, accessibility of the design"
  keywords: "audit, visual, quality, screenshot, contrast, accessibility, reduced motion, layout shift, performance, critique, design, review, website, ui"
  composes: "verify, revamp-ui, build-animation"
  requires: "browser, playwright"
  risk: "low"
---

# Audit design

An audit reports; it does not fix. Change code only when the user asks for fixes, then hand
over to `revamp-ui`, `add-interactions` or `build-animation`. The bar is the UI taste section
of `~/agent-skills/working-agreements/AGENTS.md`; a repository's design system wins on
specifics. Never claim visual quality from reading code: every judgement points at a
screenshot or a measurement.

## 1. Inspect

Find how the app runs (repo README, package scripts) and start it locally, or use the URL the
user gave. Read `~/agent-skills/shared/creative/adaptation.md` to name the product type and
mode (Operate, Read or Persuade): the critique is judged against that, not against a house
style.

## 2. Measure

Run the deterministic runner (it never judges taste):

```
node ~/agent-skills/skills/audit-design/scripts/visual-audit.mjs --url http://localhost:3000 \
  --project <dir with playwright> --out .visual/audit
```

- Defaults: desktop 1440×900, tablet 834×1112, mobile 390×844; light and dark themes.
- Remote URLs are refused unless the user supplied them: then add `--allow-remote` and follow
  the ethics in `~/agent-skills/shared/creative/reference-workflow.md`.
- Exit codes: 0 pass, 3 blocker or major findings, 2 incomplete (Playwright missing, page did
  not load), 1 usage error. An incomplete audit is reported as incomplete, never as a pass.
- Output: `report.json`, `report.md` and screenshots per viewport and theme in `--out`. If
  `axe-core` is installed in the project, its WCAG AA rules run too; never vendor it.

What the runner measures, and what it cannot, is listed in
`~/agent-skills/shared/creative/visual-loop.md`.

For performance (Core Web Vitals, frame pacing, long tasks, memory, page weight, each quality
tier), add `--perf`: several runs per condition, a saved baseline and a before/after verdict
that separates a real change from noise. Lab data only; flags, budgets and limits are in
`references/experience-bench.md`.

## 3. Critique

Open the screenshots yourself (and hover, keyboard and reduced-motion states the runner
captured). Rank findings:

- **P0** broken or blocking (unreadable text, overflow, dead controls, console errors).
- **P1** clearly hurts trust or usability (inconsistent components, weak hierarchy, motion
  that janks or ignores reduced motion).
- **P2** craft gaps (spacing rhythm, type scale, generic AI tells from adaptation.md).
- **P3** polish.

Report the top 5–8 only, each with the screenshot path, the selector and the exact property
fix. Apply the removal test: for each decorative element, would the page be worse without it?

## 4. Record

Append the result to the creative ledger so repeated defects become evidence for
`night-evolve-skills` (`~/agent-skills/shared/creative/learning.md`):

```
node ~/agent-skills/skills/audit-design/scripts/record-findings.mjs --report .visual/audit/report.json --skill audit-design
```

## Report

Pass/fail and counts from the runner, the ranked findings with screenshot paths, what was not
checked (e.g. a skipped theme), and fixes offered as numbered options.
