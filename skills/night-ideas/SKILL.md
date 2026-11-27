---
name: night-ideas
description: Creative product and engineering discovery loop. Benchmarks repo stage against proven SaaS, game, and systems patterns, returning scored specs and follow-ups. Use for "/night ideas".
metadata:
  aliases: "night-ideas, night ideas, overnight idea research, creative night research"
  keywords: "night, loop, ideas, creative, product, roadmap"
  composes: "research, understand-code, improve"
  requires: "git, shell"
  risk: "low"
  night-loop: "ideas"
  night-writes: "report"
  night-minutes: "20"
  night-signals: ""
---

# Night ideas

One iteration discovers and specs **one** high-leverage, non-obvious product, UX, gameplay, or
architectural upgrade grounded in the repository's actual code and stage—using `understand-code`,
`research` and `improve`, plus the cross-industry replication catalog in
`workflows/industry-patterns.md`. Read `../night/references/loop-interface.md`.

## Activation

- Works on **any repository at any stage** (even `seed` repos with zero tests, because `night-writes: report`
  modifies no tracked files and needs no test runner).
- Write **no files** in the worktree; put the full blueprint in `NIGHT_RESULT.report` and queue up
  to 3 executable `follow_ups` targeting concrete code loops (`night-saas-lab`, `night-game-lab`,
  `night-readiness`, `night-visual`, `night-tests`, `night-performance`).

## Workflow

1. **Map current stage & friction:** Use `understand-code` to inspect entry points, user journeys,
   core loops, data models, TODOs, and missing capabilities. Note the repo's stage (`seed`,
   `prototype`, `mvp`, `production`) and domain (`saas`, `game`, `ai`, `cli`, `library`).
2. **Cross-pollinate proven industry patterns:** Consult `workflows/industry-patterns.md` to match
   the repo's friction against high-performing patterns people ship in modern B2B/micro-SaaS,
   breakout indie games, AI-native workflows, and developer tools. Label external market claims
   explicitly when offline.
3. **Score honestly:** Rank candidates with `Priority = (Impact x Confidence x RiskReduction) / (Effort x ExecutionCost)`
   (1–5 per factor, each with file:line evidence). Discard generic filler ("add dark mode" when it
   exists, "add AI chat wrapper" with no workflow fit).
4. **Write a build-ready mini-spec (`NIGHT_RESULT.report`):** For the #1 candidate not yet proposed
   in earlier iterations, write:
   - **Problem & Code Evidence:** exact files/routes/mechanics where users hit friction or drop off.
   - **Replicable Pattern & Why It Works:** the concrete industry mechanic adapted to this repo's domain.
   - **Vertical Slice Architecture:** exact files to touch, data/state contract, edge cases, and
     automated test / metric that proves success in <45 minutes.
   - **Priority Breakdown & Risks:** 5-factor score table + open owner decisions.
5. **Queue `follow_ups`:** Emit up to 3 concrete `{loop, title, why}` entries so `/night full` or
   `/night creative` can build verified slices in subsequent iterations when tests exist.

## Evaluation

- Keep: Zero worktree file edits; report cites real `file:line` evidence, adapts a concrete pattern
  to this codebase, scores all 5 priority factors honestly, and avoids duplicating existing features
  or prior night proposals.
- Revert: Any file created/modified in the worktree, fabricated metrics/demand, or vague generic advice.
- Inconclusive: Empty report.

## Stop conditions

- Top opportunities across onboarding/first-minute feel, core loop leverage, retention/trust, and
  architecture are mapped, or 3 consecutive candidates score low priority (`< 4.0`).

## Examples

- Day: "run night-ideas on our onboarding and core loop" produces a ranked, code-cited spec.
- Night: `/night ideas` or `/night creative` builds a curated morning portfolio of specs and follow-ups.

End the final message with `NIGHT_RESULT: {json}` (`files: []`, full markdown in `report`).
