# Evaluation

No claim without evidence; no evidence without a baseline. The engine measures the baseline at
the start of the night on the base commit and every `verify` compares against the latest
accepted state.

## Metric kinds (policy `metrics:`)

| kind | measures | key fields |
| --- | --- | --- |
| `duration` | wall time of a successful command (median of `repeat`) | `run`, `repeat` |
| `regex` | first number captured from command output | `run`, `pattern`, `missing` |
| `json` | numeric value at a dotted path of JSON output | `run`, `path` |
| `exit` | 0 pass / 1 fail | `run` |
| `size` | bytes under a path, optional `glob` and `gzip` | `path` |
| `duplication` | % of normalized lines in repeated 6-line windows | `paths` |
| `loc` | non-blank source lines | `paths` |
| `http` | p50/p95/p99 latency (`name.p50`…) | `url`, `requests`, `warmup` |

Common fields: `better: lower|higher`, `tolerance_pct` (regression threshold), `improve_pct`,
`gate: false` (report but never reject), `quick: true` (cheap, used by dry runs), `cwd`,
`timeout_minutes`, `requires_port_free: <port>` (skip while a live service holds the port),
`requires_port_open: <port>`, `when: [globs]` (also measure when matching files change),
`always: true`.

## Verification rules

- Checks: every policy check whose `when` globs match a changed file runs; any failure rejects.
  Commands may use `{main}`, `{worktree}`, `{night}`, plus `{changed_files}` (changed files
  matching `when`, relative to the check's `cwd`) and `{related_tests}` (changed tests and tests
  named after changed modules). A check whose placeholder resolves to nothing is skipped, and a
  `required: true` check that is skipped counts as a failure.
- Gating metrics: a regression beyond `tolerance_pct` rejects.
- Target metrics: if a candidate names metrics, at least one must improve beyond noise.
- Without a target metric, `accept` requires `--evidence` naming the test or behaviour proven.
- Noise: use `repeat` for timings, p95 over 30+ requests for latency, and treat sub-tolerance
  changes as neutral. Never rerun until a lucky number appears; if a result is noisy, raise
  `repeat` in the policy and say so.

## UI evidence

1440×900 screenshots via `evolve screenshot`, compared with approved references in
`ui.references`/`ui.pages`. Report `diffRatio`, explain intended differences, and include
console errors and paint timings from the capture.

## AI and agent evaluation

For prompt, routing or agent changes use the repository's eval harness (e.g. `pnpm eval`,
`evals/`). Record success rate, tokens/task, cost/task and latency on the same fixture set
before and after. Version the prompt; add a fixture for the failure you fix. Expose the eval
summary to the engine as `regex`/`json` metrics so `verify` gates on it.

## Independence

The agent that implemented a change does not get to declare it good: the engine's numbers,
the repo's checks and screenshots do. When a result looks too good, look for a broken
measurement (skipped tests, cached build, a path that no longer runs) before accepting.
