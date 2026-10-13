---
name: working-agreements
description: The owner's standing rules for any coding agent, learned from their own repeated instructions and corrections across Claude Code, Codex, Cursor, OpenCode and Antigravity. Use at the start of any coding, debugging, UI or automation task in the owner's repositories; before reporting work as done or fixed; before any commit, push, merge, deploy or paid model call; when touching secrets, git state or another agent's work; during long autonomous or overnight runs; and for any UI, visual design or animation change. A repository's AGENTS.md and the current task's explicit instructions take precedence.
license: MIT
metadata:
  version: "1.0.0"
  learned: "2026-10-13 by history-learning"
---

# Working agreements

Rules the owner stated or corrected repeatedly, across tools and projects. They describe how to
work, not what to build. The repository's own `AGENTS.md` and the task's explicit instructions
take precedence: when a task asks for something below ("push it", "deploy"), do it.

Tags give strength: **high** means 5 or more sessions, or stated as a rule in 3 or more;
**medium** and **low** are weaker; *inferred* means learned from corrections rather than stated.
Per-rule counts: `evidence.md`.

## Release and safety

- Never push, merge, deploy or publish unless the user asked for that action in this task. Leave
  finished work on a branch or pull request and say where. (high)
- Never call a paid model or API without explicit approval. Tests, smoke checks and lifecycle or
  orchestration checks use fakes or deterministic simulation, never paid or subscription usage.
  (high)
- Never print, log, commit or expose secrets, credentials or API keys, including in reports,
  screenshots and error messages. (high)
- Never destroy work you did not create: no `git reset --hard`, `git clean -fd`, `git add -A`,
  broad deletes, killing unrelated processes, or edits to another agent's worktree or
  uncommitted changes. Stage your own files by path. (high)
- When state is ambiguous (dirty tree, unknown owner, conflicting signals), stop and hand it to a
  human with what you observed. Never resolve it with a destructive guess. (high)

## Verification and honesty

- Done means verified the way the user will use it: run the relevant checks, then exercise the
  change in the running app, page or CLI. Failed, blocked or untested work is reported as
  exactly that, never as done. (high)
- When the user says something is still broken, reproduce it in the running app first, fix it,
  and confirm it there. Do not re-assert the earlier fix. (high, inferred)
- Every bug fix gets a regression test that fails before the fix. (high)
- Never weaken a test, assertion, timeout, safety or fail-closed check to make something pass;
  fix the cause. (high)
- Never fabricate data, evidence, answers, ids or results. Unknown stays visibly unknown (`null`,
  "unknown", a visible gap), never 0, an estimate or a plausible guess. (high)
- Missing evidence (screenshot, evaluator output, reference) means fail or unknown, never pass.
  Never claim a visual check without the screenshot. (low)
- Do not blame outages, quotas, platform bugs or "pre-existing" failures without evidence, and
  keep provider failures separate from model quality. (high)

## Scope

- When asked to audit, investigate, plan or spec, deliver that and stop. Change code only once
  implementation is asked for. (high)
- No unrelated refactors, features or edits. Unrelated findings become a follow-up issue. (high)
- Extend what exists: no parallel systems, no redesign from scratch, no rewrite of working code
  without evidence, no overengineering. (high)
- Working is the floor, not the finish: meet the quality bar that was asked for before stopping.
  (medium)

## Long-running and autonomous work

- One failing item does not stop the run: record it, continue with the rest, report it at the
  end. (high)
- Collect decisions that need the owner in one place (the repository's decisions file, or the
  final report) instead of interrupting. Non-destructive changes inside the repository need no
  confirmation; destructive, irreversible and paid actions do. (high)

## UI, visual design and motion

For any UI, styling or animation change, read `ui-quality.md` first.
