# Evolution memory

Memory exists so no night repeats another night's research or experiments. It lives in the
repository's main checkout and survives worktrees, branches, restarts and agent changes:

| File | Holds |
| --- | --- |
| `.evolution/history.jsonl` | append-only ledger: experiments, research, libraries, decisions, opportunities, failures, runs |
| `.evolution/baselines.json` | benchmark results per base commit plus a 60-point series per metric |
| `.git/evolution/night-<date>.json` | the night's resumable state (phase, candidates, verification, usage) |
| `.git/evolution/<date>/` | survey, logs, screenshots, report |

`.evolution/` is excluded locally via `.git/info/exclude`; the policy is proposed for version
control in the first nightly PR. Only those three files sit in the checkout, written so the
repo's own formatter accepts them. Volatile state stays in the git directory, where linters,
formatters and test runners never look. `<date>` is the evening the night's window opened.

## What the engine records automatically

Every accepted/rejected experiment with fingerprint, files, commits, metric comparisons and
the reason; one `run` summary per night; baselines per commit.

## What you record

```sh
$EVOLVE memory add --kind research    --title "<question>" --summary "<answer>" --sources <urls>
$EVOLVE memory add --kind library     --library <name> --verdict adopt|reject|defer --reason "<why>"
$EVOLVE memory add --kind decision    --title "<decision>" --reason "<why, constraints>"
$EVOLVE memory add --kind opportunity --dimension <dim> --title "<idea>" --reason "<evidence + first step>"
$EVOLVE memory add --kind failure     --title "<approach that failed>" --reason "<why; what would change the verdict>"
```

Write reasons for a reader six months from now: the evidence, not the feeling.

## Reading memory

- `memory digest` is already embedded in the survey; read it before triage.
- `memory search "<words>" [--global]` searches this repo or every registered repository.
- `candidate add` refuses fingerprint or near-title duplicates of earlier experiments. Retry
  only with genuinely new evidence: `--retry-reason "<what changed>"`.
