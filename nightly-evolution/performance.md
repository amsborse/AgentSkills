# Performance

Find work the system does that it does not need to do, then prove the saving. A performance
candidate without a before/after number is not a performance candidate.

## Where to look (cheapest evidence first)

1. **Survey hotspots × largest files.** Code that changes often and is large is where latency
   regressions accumulate.
2. **API latency.** Sequential awaits that could run concurrently (`await a; await b;` with no
   data dependency), N+1 queries inside loops, per-request work that could be computed once
   (config parsing, regex compilation, client construction), unbounded payloads.
3. **Database.** Missing indexes on filtered/sorted columns (check the query plan, e.g.
   `EXPLAIN QUERY PLAN` / `EXPLAIN ANALYZE` on a copy, never production), `SELECT *` on wide
   rows, chatty transactions, JSON extraction in hot filters that could be a generated column.
4. **Caching.** Repeated identical reads with a clear invalidation point. No cache without a
   stated invalidation rule and a stale-read test.
5. **Async concurrency.** Unbounded `Promise.all` over user-sized lists (bound it), blocking
   sync I/O on request paths, CPU work on the event loop.
6. **Rendering.** Re-renders from unstable props/context, layout thrash, large lists without
   virtualization, images without dimensions, main-thread work during interaction.
7. **Bundles.** Route-level code splitting, heavy dependencies imported for one function,
   duplicate copies of a library, unused locale/polyfill payloads.

## Measuring

Define the metric in the policy before the experiment (see `evaluation.md` for kinds):

```yaml
metrics:
  - name: api_feed
    kind: http            # records api_feed.p50 / .p95 / .p99
    url: http://127.0.0.1:4000/feed
    requests: 50
    requires_port_open: 4000
    better: lower
    tolerance_pct: 10
  - name: web_bundle_gzip
    kind: size
    path: apps/web/dist/assets
    glob: "**/*.js"
    gzip: true
    better: lower
    tolerance_pct: 3
```

- Latency needs repetition: use p50 and p95 over at least 30 requests, after warmup. A single
  timing is noise. Use `repeat: 3` for command durations.
- Measure against a service started **from the worktree** (`ui.serve` / a metric `run`), never
  against the owner's live service, and never against production.
- A change that improves p50 but worsens p99 beyond tolerance is a regression.

## Skip

- Micro-optimizations below the noise floor of the metric.
- Rewrites justified by a benchmark of a different workload.
- Caches on data that must be fresh (prices, approvals, auth state) unless the owner decided it.
