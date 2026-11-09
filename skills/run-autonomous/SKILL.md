---
name: run-autonomous
description: Run a long or multi-step task autonomously — overnight, while the user is away, or until a list of milestones is done — with an isolated branch or worktree, a written ledger of progress and decisions, bounded retries, and a final evidence-backed report. Includes the nightly-evolution routine (one draft PR of improvements per night). Never pushes, merges or deploys unless asked. Use for "run this task autonomously overnight", "keep going until done", "work on this while I sleep" or "run nightly evolution".
metadata:
  aliases: "run this task autonomously, run autonomously, overnight, while i sleep, keep going until done, nightly evolution, work unattended"
  keywords: "autonomous, unattended, overnight, nightly, loop, ledger, milestones, long running, background, schedule"
  composes: "build-feature, fix-bug, improve, verify, coordinate-agents, review-code"
  requires: "git, shell, codex-bridge?, scheduler?"
  risk: "high"
---

# Run autonomous

## Pick the mode

- **Nightly improvement of a repository** (no specific task): follow
  `~/agent-skills/nightly-evolution/SKILL.md`.
- **A given task or milestone list:** the loop below.
- **Recurring or scheduled run:** in Claude Code use `/loop` or `/schedule`; otherwise the host's
  scheduler. The loop below is still the body of each run.

## Setup

1. Read the repository's `AGENTS.md` and `~/agent-skills/working-agreements/AGENTS.md`.
2. Work in a new branch or git worktree; never on the user's checkout or another agent's work.
3. Create a ledger file (`.agent-run/<date>-<slug>.md` in the worktree, or the scratchpad):
   goal, milestones with acceptance checks, budget (time, retries), and a decisions section.

## Loop (per milestone)

1. Plan the smallest next step; do it with the right skill (`build-feature`, `fix-bug`,
   `improve`), delegating isolated parts with `coordinate-agents`.
2. Check: run the tests and the milestone's acceptance check; record the real result in the ledger.
3. On failure, retry with a different approach at most 2 times, then mark the milestone
   **blocked** with the evidence and move on. One failure never stops the run.
4. A question for the owner goes into the ledger's decisions section with a recommended default;
   take the default if it is non-destructive, otherwise park that milestone.
5. Commit each finished milestone on the branch (stage by path).

Never: push, merge, deploy, call paid APIs, delete work you did not create, or weaken a test.

## Finish

Get an independent review of the whole diff (`review-code`) and fix confirmed issues. Report:
done, blocked (with evidence), decisions needed, branch name, and how to roll back.
