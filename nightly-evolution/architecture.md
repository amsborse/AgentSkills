# Architecture

Overnight architecture work is about **small, compatible steps** that make the next change
cheaper. Large redesigns are findings for the morning report, not commits.

## Before proposing anything

Read the repository's architecture record (`AGENTS.md`, `docs/ARCHITECTURE.md`, decision
tables, `FUTURE_SCOPE.md`). Decisions recorded there are constraints. Deferred ideas with an
unfired trigger stay deferred: building them early fabricates what the trigger protects.

## What to look for

- **Boundary leaks:** module A importing B's internals, a shared package depending on an app,
  persistence types escaping into UI, duplicate ownership of one decision (two places that
  pick a model, two retry policies).
- **Modularity:** one file or function that every change touches (churn hotspot + large file).
  Extract the seam the code already names; keep the public contract identical.
- **Resilience:** single points of failure on request paths, synchronous calls to slow external
  services, missing back-pressure on queues, work that is lost on restart.
- **Scalability:** O(n²) over growing collections, per-tenant/per-user loops in one process,
  global locks, in-memory state that prevents a second worker.
- **Service boundaries:** only split along an existing boundary with a measured reason
  (deploy independence, failure isolation, resource profile). Prefer a module boundary to a
  network boundary.

## Acceptable overnight changes

- Moving code behind an existing interface, with the public contract and tests unchanged.
- Adding a missing contract test at a boundary.
- Introducing an adapter so a fragile provider/version assumption lives in one place.
- Deleting a deprecated path whose replacement is already live (verify no caller remains).

## Not overnight

Database schema changes, new services or queues, framework migrations, changes to auth or
tenancy models. Record them as `opportunity` memory with evidence and a proposed first step.
