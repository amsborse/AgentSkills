---
name: production-ready
description: Take a project from "works on my machine" to ready for real users: a readiness audit across security, tests, error handling and observability, performance, configuration and secrets, build and deploy, data safety and docs, then fix the gaps in priority order and prove each with evidence. Does not deploy or publish unless asked. Use for "make this project production ready", "prepare for launch", "harden this", "release readiness" or "is this ready to ship".
metadata:
  aliases: "production ready, make this production ready, prepare for launch, harden this, release readiness, ready to ship, go live checklist"
  keywords: "production, launch, release, harden, readiness, observability, logging, monitoring, deploy, ci, rollback, backup, reliability"
  composes: "security-audit, test-everything, improve, verify, review-code"
  requires: "shell, browser?"
  risk: "medium"
---

# Production ready

Never deploy, publish or change production config unless the user asked for it in this task.
Leave the work on a branch and say where.

## 1. Audit (read-only)

Score each area **ready / gap / unknown** with file:line evidence. Unknown is not ready.

- **Security:** run the `security-audit` skill (repository mode).
- **Tests:** suite runs green from a clean checkout; the main user flow has an end-to-end test
  (`test-everything`).
- **Errors and observability:** no swallowed errors; structured logs without secrets; health check;
  error reporting; alerts on the failures that matter.
- **Performance:** measured load time or latency for the main flow, bundle or image sizes, slow
  queries, timeouts and retries with backoff on network calls.
- **Config and secrets:** all config from environment, an `.env.example`, nothing secret in the
  repo, separate dev and prod settings.
- **Build and deploy:** reproducible build, pinned dependencies, CI runs tests and lint,
  a documented deploy and a tested rollback.
- **Data:** migrations are reversible or backed up first, backups exist and a restore was tried.
- **Docs:** a README that gets a new developer running, and a runbook for incidents.

## 2. Fix

Ask once with the numbered gap list if fixing needs decisions (new services, paid tools, schema
changes). Fix the safe gaps highest-risk first, one small change at a time, each with a test.
Delegate isolated chunks with `coordinate-agents` when it helps.

## 3. Prove

Re-run the audit. Report the before and after scores, evidence for every "ready", and what is
still a gap or unknown. Verify the main flow in the running app (`verify`), and get an independent
review of the diff (`review-code`) for large changes.
