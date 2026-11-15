---
name: experience
description: One entry point to make a web product look, feel and perform better. Audits first, then runs the fewest creative skills that fit. Use for "/experience" or "take this site to the next level".
metadata:
  aliases: "experience composer, experience audit, experience polish, experience transform, experience cinematic, experience interactions, experience performance, experience experiment, experience full, next level, take this site to the next level, look feel and perform better, three directions, explore three directions, design directions, different directions"
  keywords: "composer, perform, directions, explore, experiment, transform, polish, cinematic, quality tiers, bench, orchestrate"
  composes: "audit-design, improve-visuals, revamp-ui, build-ui, add-interactions, build-animation, build-3d, create-visuals, replicate-design, review-changes, coordinate-agents, verify"
  requires: "browser, playwright?, codex-bridge?"
  risk: "medium"
---

# Experience

This skill **decides and delegates**. It holds no design guidance of its own: taste lives in
`~/agent-skills/working-agreements/AGENTS.md` (UI taste), product fit in
`~/agent-skills/shared/creative/adaptation.md`, technique choice in
`~/agent-skills/shared/creative/selector.md`, and the craft in the skills it calls. Someone who
already knows what they want should call that skill directly.

## Modes

`/experience <mode> [scope]`. With no mode, run `audit` and propose one.

| Mode | Does | Delegates to | Writes code |
|---|---|---|---|
| `audit` | Baseline (looks and performance), ranked findings, a proposed plan | `audit-design` with `--perf` | No |
| `polish` | Same direction, better execution | `improve-visuals` | Yes |
| `transform` | A new direction, chosen from three | `improve-visuals explore`, then `revamp-ui` | Yes, after the owner picks |
| `cinematic` | One signature moment | `build-animation` or `build-3d`, with the quality runtime | Yes |
| `interactions` | The interaction layer | `add-interactions`, recipes | Yes |
| `performance` | Faster at equal or better looks | Bench, quality runtime, `improve` | Yes |
| `experiment` | Three directions as prototypes, compared, then stop for a choice | `improve-visuals explore` | Prototypes only |
| `full` | `audit`, then only the modes the audit justifies, in order | The above | Yes |

`transform` needs the owner to have asked for a redesign. Without that, existing design choices
stay: run `polish`, or `experiment` to show what a change could look like without applying it.

## Steps

1. **Inspect.** Follow `adaptation.md` section 1: purpose, users, surface mode (Operate, Read,
   Persuade), brand, design system and tokens, framework and the motion or 3D libraries already
   installed (`package.json`), existing performance budgets, and the keep-list (what the owner
   liked: repo memory, `AGENTS.md`, git history). Unknown stays marked unknown.
2. **Baseline.** Before any change, run the `audit-design` runner with `--perf` on the pages in
   scope, both themes, desktop and mobile. Nothing is called better or faster later without
   this.
3. **Diagnose.** Rank findings by effect on the user. Keep measured findings (contrast, layout
   shift, frame pacing, weight) apart from taste findings (hierarchy, type, depth).
4. **Choose intensity** (0 to 4 in `adaptation.md`) from the surface mode and say why.
5. **Select** the smallest set of skills and recipes (table below).
6. **Plan** in a few lines with explicit budgets (frame pacing, layout shift, page weight) and
   any trade-off stated before it is made.
7. **Explore** only when the mode is `transform` or `experiment`, or the diagnosis shows the
   direction itself is the problem: `improve-visuals` → `workflows/explore.md`.
8. **Prototype before large changes.** Anything that touches more than one page or adds a
   signature effect is first built on one screen and captured; widen only once that holds up.
9. **Implement** through the selected skill, on a branch or worktree. Larger isolated slices go
   to Codex per `~/agent-skills/shared/creative/codex-orchestration.md`.
10. **Capture and measure again** with the same pages, viewports, themes and bench settings.
11. **Judge.** Looks: blind pairs (`improve-visuals` step 5). Performance and accessibility:
    numbers against the baseline. Check keyboard, touch and reduced motion in the browser.
12. **Decide** per change: keep, revise or revert. A visual win that breaks a budget or a
    guardrail is reworked, never kept by loosening the budget.
13. **Report.** Lead with the result and the evidence; publish before and after through
    `review-changes`; list what was not validated and offer next steps as numbered options.

## Selection

First match gives the primary skill; attach helpers only when needed.

| Signal from inspect and baseline | Primary | Attach |
|---|---|---|
| Blocker or major findings in the audit | Fix those first (`improve-visuals` guardrail fixes) | - |
| Bench shows a budget breach or dropped frames | `performance` mode | Quality runtime |
| No UI yet | `build-ui` | - |
| Owner says "different", or hierarchy, type and colour all score low | `improve-visuals explore`, then `revamp-ui` | - |
| Direction is fine, finish is not | `improve-visuals` | - |
| Flat, static feel; states missing | `add-interactions` | `spring-states`, `cursor-light`, `magnetic-target` |
| Views change abruptly | `build-animation` | `route-transition`, `scroll-reveal` |
| No signature visual and the surface is Persuade | `create-visuals` or `build-animation` | `flow-hero`, quality runtime |
| 3D or a shader is asked for, or a reference needs it | `build-3d` | Quality runtime |
| A reference is supplied | `replicate-design` | Recipes by technique |

Recipes are in `~/agent-skills/shared/creative/recipes/` (start with its `README.md`): working
code with tiers, fallbacks and measured cost. Use one before writing an effect from scratch.

Rules that bound the selection:

- Surface mode caps intensity: an Operate product gets no cinematic treatment unless asked.
- At most one new signature effect per run.
- `full` is a sequence the diagnosis justifies, not everything.
- The keep-list is out of scope unless the owner says otherwise.
- Native CSS and browser APIs first. A library (GSAP, Three.js and the like) needs a stated
  reason, and one that is already installed is preferred over a new one.
- Anything that renders continuously uses the quality runtime: five tiers, still image under
  reduced motion, paused offscreen and in hidden tabs, resources released when unused.

## Performance mode

1. Bench the pages across tiers: `visual-audit.mjs --perf --tiers default,static,low,balanced,high,ultra`.
2. Find what costs the most (long tasks, dropped frames, weight) and fix the cause: stop
   idle loops, pause offscreen work, cap pixel ratio, move animation to `transform` and
   `opacity`, defer or shrink heavy assets.
3. Put continuous effects on the quality runtime rather than removing them.
4. Bench again with the same settings. Keep a change only when the gain is larger than the
   spread between runs and screenshots show the page looks the same or better.

Numbers from one machine describe that machine. Say which renderer and device produced them.

## What this skill does not do

It does not publish, deploy, call paid APIs, install global packages or edit skills. It never
reports an improvement without the screenshot pair or the before and after numbers behind it.
