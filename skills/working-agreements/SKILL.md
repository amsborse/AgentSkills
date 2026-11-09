---
name: working-agreements
description: The owner's standing rules for any coding agent, learned from their own repeated instructions and corrections across Claude Code, Codex, Cursor, OpenCode and Antigravity. Use at the start of any coding, debugging, UI or automation task in the owner's repositories; before reporting work as done or fixed; before any commit, push, merge, deploy or paid model call; when touching secrets, git state or another agent's work; during long autonomous or overnight runs; and for any UI, visual design or animation change. A repository's AGENTS.md and the current task's explicit instructions take precedence.
license: MIT
metadata:
  aliases: "working agreements, my rules, house rules, how i work"
  keywords: "rules, agreements, preferences, conventions, ui taste"
  risk: "low"
  version: "1.2.0"
  learned: "2026-10-13 by history-learning"
---

# Working agreements

The rules live in one file, `~/agent-skills/working-agreements/AGENTS.md`, which repositories
also import directly. Read it now and follow it; for UI, styling or animation work also read
`~/agent-skills/working-agreements/ui-quality.md`. If the current repository's `AGENTS.md` already imports it, it is in context
and there is nothing more to load.

Per-rule evidence (cluster ids, session counts, confidence) is in `evidence.md` in that folder; for UI taste,
`ui-evidence.md`, regenerated with
`hl topic-support ui-taste --patterns ui-taste.patterns.json --write ui-evidence.md`.
