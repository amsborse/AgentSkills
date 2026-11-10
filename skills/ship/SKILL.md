---
name: ship
description: Ship finished work end to end once the user asks for it — run the checks, compare failures with a baseline on main, merge, push, deploy and health-check when the repo has a deploy step, then clean up this session's branches, worktrees and servers and report the commit. Use for "ship it", "merge and push", "merge, push and deploy", "merge to main and clean up" or "push everything and delete the branches". Not for deciding whether something is ready (production-ready) or for unasked releases.
metadata:
  aliases: "ship it, merge and push, merge push deploy, merge to main and clean up, push and delete the branch, release this"
  keywords: "ship, merge, push, deploy, release, cleanup, branch, worktree, health check, baseline"
  composes: "verify, test-everything, fix-bug"
  requires: "shell, git"
  risk: "high"
---

# Ship

Runs only when the user asked to ship in this task. The ask covers the steps it names: "merge
and push" is not "deploy". Once asked, finish the whole routine without stopping to reconfirm
each step; stop only on a failure below or a step that needs approval.

## 1. Check

- Run what the repo has: typecheck, lint, unit, build, e2e (and the remote or VM suite when the
  repo uses one). Use the repo's own scripts; never weaken or skip a check to get through.
- A failure is only "pre-existing" with proof: run the same failing tests on `main` in a
  temporary worktree (a subagent can do this in parallel) and compare. Fix what this branch
  introduced; list the rest with the baseline result. Remove the temporary worktree after.
- Stop the dev servers you started for testing before merging, so they do not hold worktree or
  `node_modules` files.

## 2. Merge and push

- Update from the target branch first, resolve conflicts by integrating both sides (never by
  dropping the other side's work), then rerun the checks the conflict touched.
- Merge into the target branch the user named (default: the repo's main branch) and push.
  Never `--no-verify`, never force-push a shared branch. If a hook fails, fix the cause.
- Only merge branches from this session or that the user named. Other agents' branches stay.

## 3. Deploy (only if asked and the repo has a deploy step)

- Use the repo's documented deploy command or CI. Ask first before anything irreversible it
  implies: data-dropping migrations, paid resources, secret or DNS changes.
- After deploying, check health the way users reach it: the health endpoint, the live page, or
  the scheduled jobs the user mentioned. A failed deploy is reported, not retried blindly.

## 4. Clean up

- Delete the merged branches this session created, local and remote, and remove their
  worktrees. If a remote delete or a locked folder is blocked, say which and give the one
  command that finishes it.
- Stop every server and background process you started. Never kill processes you did not
  start.

## 5. Report

One short paragraph: the merged commit hash and target branch, check results (with any
baseline-proven pre-existing failures), the deploy and health result, and anything left over
(blocked deletes, kept branches, follow-ups).
