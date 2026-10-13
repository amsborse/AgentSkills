# Extraction, redaction and the evidence bar

Everything in this file is deterministic and local. The same inputs always produce the same
evidence and clusters.

## What is evidence

Only text the user typed. Tool output, thinking, injected context, hook output, attachments,
and prompts from automated or subagent sessions are never evidence. Each typed turn is split
into sentences (code blocks removed); a sentence is kept when it carries a signal:

| Kind | Examples of cues |
| --- | --- |
| `correction` | starts with "no", "stop", "wrong", "why did you", "I said"; anywhere: "still broken", "not what I asked", "you keep", "doesn't work", "regressed" |
| `dissatisfaction` | "generic", "cheap", "slop", "janky", "cluttered", "looks off", "over-engineered" |
| `preference` | "I want/prefer/hate", "please always/never", "make sure", "must", "instead of", "avoid" |
| `praise` | "perfect", "exactly", "much better", "that works" (marks approaches that worked) |

Two modifiers are recorded per sentence:

- `durable`: "always", "never", "from now on", "by default", "every time", "in future",
  "across all projects". This marks an explicit standing rule.
- `temporary`: "for now", "this time", "today", "just this once", "for this PR". Clusters made
  only of temporary sentences are never digested.

Sentences from turns longer than 1500 characters are flagged `spec`. Pasted task specs contain
many imperatives that apply to one task, so synthesis treats them as weaker unless they recur.

Each sentence also gets categories (`ui-visual`, `animation`, `performance`, `reliability`,
`security-privacy`, `testing-verification`, `git-workflow`, `cost-models`,
`autonomy-orchestration`, `communication`, `code-quality`, `scope-discipline`,
`research-accuracy`, or `general`).

For corrections, dissatisfaction and praise, the last 300 characters of the preceding agent
reply are kept (redacted) as `prev`, so a reviewer can see what was being corrected.

## Redaction

Applied before anything is written to disk, in this order: private keys, JWTs, provider API
keys (OpenAI, Anthropic, GitHub, Slack, AWS, Google, GitLab, Resend, SendGrid, npm, Hugging
Face), credentials in URLs, `*KEY|TOKEN|SECRET|PASSWORD*=` assignments, bearer tokens,
emails, phone and card numbers, IPs, high-entropy strings, the home directory path (as `~`),
the local username, and any extra terms recorded with `hl consent --redact`. Counts per rule
are printed by `hl extract`. Redaction is best-effort. Synthesis must still drop anything that
looks private (names, clients, account ids, internal hostnames) and never quote it in a skill.

## Storage and incrementality

- `evidence/<source>.jsonl`: one record per kept sentence. Fields: `id`, `session` pointer,
  `agent`, `project`, `ts`, `kinds`, `categories`, `durable`, `temporary`, `spec`, redacted
  `text` (at most 400 characters), redacted `prev`, a prompt-prefix hash and the turn length.
  Raw transcripts are never copied.
- `processed.json`: session to source modification time. Unchanged sessions are skipped, and a
  changed session is re-read and its records replaced.
- `turn-keys.json`: turn key to owning session, for cross-session deduplication (Claude `uuid`;
  otherwise a hash of timestamp and text).

## Clustering and confidence

Sentences are grouped per primary category by token Jaccard similarity (0.5 or higher, with
an inverted index). Before that, long prompts whose first 120 characters recur verbatim in 4
or more sessions are dropped as scripted templates.

| Confidence | Rule (ShadowClone's bar: explicit rules need one session, inferred patterns three) |
| --- | --- |
| `high` | 5+ independent sessions, or an explicit durable rule repeated in 3+ sessions |
| `medium` | explicit rule in 2 sessions, or an inferred pattern in 3-4 sessions |
| `low` | explicit durable rule stated once |
| `insufficient` | inferred from fewer than 3 sessions: never becomes a rule on its own |

Scope is `project:<name>` when every session came from one named project, otherwise `global`.
