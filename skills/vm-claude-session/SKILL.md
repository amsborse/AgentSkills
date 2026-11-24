---
name: vm-claude-session
description: Hand a task to a headless Claude Code session on the Oracle VM, check on it, and bring its result back as a reviewable patch. Use for "offload this to the VM", "run this on Oracle", "send a task to the VM session", "check the VM session" or "get the VM's result".
metadata:
  aliases: "vm session, offload to vm, run on oracle, vm claude session, session manager"
  keywords: "oracle, vm, claude, headless, offload, session, patch, background"
  requires: "git, ssh, scp, bash"
  risk: "medium"
  cost: "paid-usage: each run uses the Claude subscription, so it needs explicit owner approval"
---

# VM Claude session

Runs one Claude Code task on the Oracle VM in its own clone and returns the work as a patch.
The script is `scripts/vm-session.sh`. It never pushes, never touches `~/Sutra` (production)
or `~/Sutra-dev`, and removes the clone's `origin`, so the session cannot push.

## Steps

1. Pick a short id (for example `fix-login-tests`) and a local branch with the work to start from.
2. Write the task as a plain text file (goal, files, what "done" looks like, what not to change).
3. `vm-session.sh start <id> <branch>`: bundles the branch and clones it on the VM.
4. `vm-session.sh task <id> <task-file>`: copies the task to the VM.
5. Ask the owner to approve the run (it uses paid usage). Then `vm-session.sh run <id> --confirm`.
6. `vm-session.sh status <id>` until it says `finished`.
7. `vm-session.sh result <id> <dest-dir>`: saves `result.patch` and `run.log`. Review the patch before applying it.
8. `vm-session.sh stop <id>` if it hangs. `run` kills itself after `VM_SESSION_TIMEOUT` seconds (default 5400).

## Rules

- `run` refuses to start without `--confirm`. Only pass it after the owner approves this task.
- The session runs with the API key removed, so it uses the subscription login, not the paid key.
- Disallowed inside the session: `git push`, `ssh`, `scp`, `gh`, `rm -rf`.
- Results are a patch, not a merge. Applying or pushing it is a separate owner decision.
- Test the flow with `VM_CLAUDE_BIN` pointing to a fake `claude` before any real paid run.

## Limits

- The VM's `~/.local/bin/claude` (v2.1.314 on 2026-11-22) must be logged in to the subscription.
  This skill does not check the login; a real run is the first proof.
- Only one run per id at a time. Different ids can run in parallel, but the VM has 2 cores.
- This skill does not set up databases. Heavy test suites belong in the VM test flow instead.
