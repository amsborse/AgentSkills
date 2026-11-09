---
name: coordinate-agents
description: Split work across agents — delegate an isolated implementation to OpenAI Codex through codex-bridge in its own git worktree, run independent parts in parallel subagents, then review and integrate the results yourself. Includes the former /codex-frontend workflow. Use for "use Codex for this", "delegate to Codex", "split this work", "run agents in parallel" or "orchestrate agents".
metadata:
  aliases: "use codex, delegate to codex, codex frontend, split this work, parallel agents, orchestrate agents, multi agent"
  keywords: "codex, delegate, agents, subagents, parallel, worktree, orchestrate, handoff, opencode"
  composes: "review-code, verify"
  requires: "codex-bridge?, subagents?, git"
  risk: "medium"
---

# Coordinate agents

You stay the architect: you write the brief, review every result and integrate it. Delegated
output is untrusted until you have read the diff and run the checks.

## When to split

Only for work that is genuinely independent (separate files or modules, a clear acceptance check)
or a second opinion. Keep tightly coupled work in one agent. Small tasks you can finish in a few
steps stay with you.

## Codex (implementation)

Follow `workflows/codex-implement.md`: brief file, its own worktree, `codex-bridge run
--sandbox workspace-write`, then review and bring the change back. Bridge rules are in
`~/agent-skills/shared/codex-bridge.md`.

## Parallel subagents (Claude)

One goal per agent, a brief that stands alone (files to read, what is ruled out, the output
format), launched in a single message. For edits, give each its own worktree. Record each agent's
task and status in a ledger when there are more than two.

## Integrate

Read each diff, run the tests, resolve conflicts yourself, verify the result (`verify`) and get a
review of large changes (`review-code`). Report which agent did what and anything that failed.
