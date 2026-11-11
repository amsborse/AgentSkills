# Night config

`.night/config.yaml` in the target repository. Every key is optional: missing keys take the
defaults below (deep-merged), and `night init` writes a starter file. The defaults live in
`scripts/lib/state.mjs` (`DEFAULT_CONFIG`), and `validateConfig` rejects bad values when the run
starts.

## Limits and flags

| Key | Default | Meaning |
| --- | --- | --- |
| `max_duration_hours` | 8 | Wall-clock deadline for the run. A task whose estimate (`night-minutes`) does not fit in the time left is not started |
| `max_iterations` | 30 | Agent attempts, counting kept, reverted and inconclusive |
| `max_concurrent_agents` | 3 | Lanes running at once. Lanes never share files (scope overlap check) |
| `max_retries_per_task` | 2 | Retries after the first attempt; after that the task is `blocked` |
| `max_stagnant_iterations` | 3 | Consecutive attempts without a kept change before the run stops. A loop that reports `done` with no change does not count |
| `token_budget` | null | Total tokens the agents report. null means no cap. The run stops when the budget is spent or the next task is predicted to exceed it |
| `cost_budget_usd` | null | The same for reported cost. An agent that reports no cost leaves the total "unknown", and the budget cannot stop it; the run warns once when that happens |
| `require_verification` | true | When false, changes with no evaluation command are kept on diff checks alone (not recommended) |
| `auto_revert_regressions` | true | Revert any change that makes a check worse |
| `preserve_user_changes` | true | Always true in practice: work runs in a separate worktree |
| `allow_external_actions` | false | `true` is rejected. Night never pushes, publishes, deploys or sends anything |

Budgets are estimates from what agents report (`NIGHT_USAGE`, the Claude CLI's JSON result,
Codex token counts). They are never invented.

## Agents

```yaml
agents:
  order: [claude, codex]          # tried in order; unavailable ones are skipped
  routing:                        # loop -> preferred agent
    night-visual: codex
  claude:
    model: null                   # null = the CLI default
    permission_mode: acceptEdits  # never bypassPermissions by default
    max_budget_usd_per_task: null
    allowed_tools: [...]          # see state.mjs; tests, linters, read-only git
    disallowed_tools: [...]       # push, commit, reset, checkout, gh, publish, curl, web
  codex:
    sandbox: workspace-write
    effort: null
    model: null
  commands:                       # any other agent: a shell command run in the lane
    fake:
      run: "node D:/tools/fake-agent.mjs {cwd}"
```

A command agent runs through the shell in the lane worktree. It gets the prompt on stdin, and its
`run` line may use `{cwd}` (the lane) and `{prompt_file}` (the prompt saved to a file). It may print:

```
NIGHT_RESULT: {"summary": "...", "hypothesis": "...", "next_hypothesis": "...", "done": false, "follow_ups": [], "report": null}
NIGHT_USAGE: {"input_tokens": 1200, "output_tokens": 300, "cost_usd": null}
```

`NIGHT_AGENTS=fake` (or `--agent fake`) restricts a run to one agent. Tests and smoke runs use a command agent, never a paid model.

## Timeouts and retry

```yaml
timeouts: { task_minutes: 45, stall_minutes: 12, evaluation_minutes: 30, finalize_minutes: 10, heartbeat_seconds: 20 }
retry: { backoff_base_seconds: 30, backoff_max_seconds: 900 }
```

An agent is killed in either case:

- it exceeds `task_minutes`;
- it prints nothing and changes no file for `stall_minutes`.

Retries and watchdog restarts wait `base * 2^n`, capped at the max.

## Evaluation

```yaml
evaluation:
  flaky_repeat: 2                 # checks of kind tests run this many times; disagreeing runs mark them flaky
  commands:                       # empty = auto-detect (npm test, node --test, pytest, unittest, ruff, ...)
    - { name: test, run: "npm test", kind: tests }
    - { name: lint, run: "npm run lint", kind: lint }
  metrics:                        # numbers loops with night-keep: metric-up can improve
    - { name: bench, kind: duration, run: "node bench.mjs", repeat: 5, better: lower }
    - { name: bundle, kind: size, path: dist/app.js }
    - { name: a11y, kind: regex, run: "npm run a11y", pattern: "(\\d+) violations", better: lower }
```

Metric kinds come from the shared measurement library: `duration`, `exit`, `regex`, `json`,
`size`, `loc`, `duplication` and `http`. Repeated metric runs use the median, and the shared `compare()` decides improved, regressed or
unchanged against its threshold.

## Workspace and safety

```yaml
workspace:
  dir: "../{repo}-night"          # run worktree; lanes go in sibling folders
  setup: ["npm ci"]               # run once in each new worktree
  branch_prefix: "night/"
resources: { min_free_disk_mb: 500 }
protected_paths: [".night/**", ".git/**", ".github/**", ".env", "**/*.pem", "infra/**", "**/migrations/**", ...]
instructions:                     # extra lines added to every agent prompt
  - "Use the existing logger in src/log.ts."
```

Any change to a protected path is reverted. Setting `protected_paths` replaces the default list, so copy the defaults from `state.mjs` and add your own.

## Example: a small overnight test run with a fake agent

```yaml
max_iterations: 5
max_concurrent_agents: 1
evaluation:
  flaky_repeat: 1
  commands: [{ name: test, run: "node --test", kind: tests }]
retry: { backoff_base_seconds: 1 }
agents:
  order: []
  commands:
    fake: { run: "node D:/tools/fake-agent.mjs {cwd}" }
```

Then run `NIGHT_AGENTS=fake node ~/agent-skills/skills/night/scripts/night.mjs run tests`.
