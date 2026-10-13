# Optimization: code quality, AI efficiency, cost, developer experience

## Code quality

Evidence comes from the survey: `duplication_pct` clusters, largest files, churn hotspots and
TODO/FIXME markers.

- **Duplication:** extract only when the copies change together (check `git log` on both).
  Accidental similarity is not duplication. Target metric: `duplication_pct`.
- **Dead code:** unreferenced exports, unreachable branches, flags that are always on. Prove
  deadness with a reference search plus the test suite, not intuition. Deleting is the best
  simplification there is.
- **Maintainability:** split a file only along a boundary that already exists in the code's
  vocabulary. Do not introduce layers, factories or generic frameworks to make code "cleaner".
- Simplicity is conceptual, not a line count: never remove validation, typing, tests or useful
  abstractions to shrink a diff.

## AI efficiency

For repositories that call models or run agents:

- **Routing:** cheap/deterministic paths first (rules, regex, caches, smaller models), escalate
  only on measured failure. Respect the repository's routing owner (e.g. Viveka); propose
  routing changes there, never bypass it.
- **Tokens:** trim prompt boilerplate, send structured context instead of raw dumps, cache
  stable prefixes where the provider supports it, cap output length to what is parsed.
- **Context engineering:** retrieve the few relevant items rather than whole documents; keep
  schemas strict so retries are rare.
- **Evaluation first:** a prompt or routing change needs a versioned prompt, a fixture and an
  eval run (see `evaluation.md`). Never edit a fixture to make a prompt pass.
- Measure: success rate, tokens per task, cost per task, latency per task, retry rate.

## Cost

- Infrastructure: idle compute, over-provisioned workers, log/artifact retention, disk growth.
- API requests: duplicate calls, polling that could be event-driven, missing batching.
- Storage: unbounded tables, uncompacted databases, artifacts without retention.
- State the monthly effect with its assumptions. Never change billing settings or plans.

## Developer experience

- Slow or flaky tests: measure `unit_test_ms`; fix the cause (shared state, sleeps, real network)
  instead of adding retries. Note flakes in the PR; never delete a flaky test silently.
- Builds: incremental builds, cached steps, removing redundant work. Target `build_ms`.
- CI/CD: faster feedback order (lint/typecheck before e2e). CI workflow changes are allowed but
  must not weaken required checks or touch deployment credentials.
- Debuggability: actionable error messages, one-command local repro, structured logs.
