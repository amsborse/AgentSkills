# Synthesis: from digest to proposals

This is the only step that involves a model, and the model is you. Work only from
`digest/*.md`, `$HL evidence <id>` for clusters you need to verify, and `reports/catalog.md`.
Never open raw transcripts to "get more context". Stay within the consented budget.

## Decide per cluster

For each cluster, decide one of: **add a rule**, **strengthen an existing rule**, **record as
project knowledge**, or **reject**. Reject when it is:

- a one-off task instruction, especially from a long `spec` turn, that does not recur;
- `temporary`, or contradicted by a later cluster (newer wins; note the conflict);
- inferred with `insufficient` confidence;
- already stated with the same force in an existing skill or instruction file;
- private (client names, people, credentials, account ids, internal URLs) and impossible to
  generalize without them.

A rule must say what to do, not narrate history. Write "Verify UI changes with a screenshot
before reporting them done", not "The user complained 6 times that…".

## Explicit and inferred

- **Explicit**: the user stated it as a standing rule (`durable`). Phrase it close to their
  wording.
- **Inferred**: a pattern of corrections or dissatisfaction in 3 or more independent sessions.
  Phrase it as the behavior that would have prevented the corrections, and label it inferred.

## Where it goes

1. Search `reports/catalog.md` for a skill or instruction file that already owns the topic.
   Improve it: add the rule to its checklist, or sharpen a vague line. Do not create a parallel
   skill.
2. Global rules about how the user works across all repositories go into the shared file
   `working-agreements/AGENTS.md` in the agent-skills repository, under its themed sections.
   Repositories import that file (see its "Importing" section), so a global rule is written
   once and never copied into a project. Global knowledge that is a procedure rather than a
   standing rule (a workflow, a tool's usage) becomes its own skill.
3. Project knowledge (architecture, commands, pitfalls of a specific repository) goes in that
   project's own skills (`<repo>/.agents/skills/` or its `AGENTS.md`), never into the shared repo.
   A repository that does not import the shared file yet gets the two import lines, not copies.
   Fold rules into the section that already owns the topic; do not add a "learnings" section,
   which drifts from the rest of the file.
4. Skills that would only fire inside one tool still use the portable format: `SKILL.md` with
   `name` and `description` only, plus supporting files.
5. The user's global agent configuration (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, ...) is
   never edited by this workflow. If a rule belongs there, say so in the report.

## Skill shape

- `description`: what it does and when to use it, at most 1024 characters, with trigger words
  the user actually says.
- `SKILL.md` under 500 lines: the rules, each with a confidence tag such as `(high)` or
  `(medium, inferred)`. Put detail in supporting files linked by name (progressive disclosure).
- `evidence.md` in the skill, written by `$HL support --write`: cluster ids, session, project and
  agent counts, date range and confidence per rule; no quotes, project names or paths.
- A rule's confidence is never higher than `$HL support` computes from its clusters. Citing
  several clusters for one rule is how independent phrasings of it add up.

## proposals.json

Write to the state directory:

```json
{
  "generatedAt": "...",
  "skills": [
    {
      "skill": "verification-before-done",
      "action": "create | update",
      "scope": "global | project:<name>",
      "path": "absolute path of the skill directory (evidence.md is written there)",
      "summary": "why this change",
      "rules": [{ "id": "short-slug", "text": "...", "kind": "explicit | inferred", "confidence": "high | medium | low", "clusters": ["a1b2c3d4e5"] }]
    }
  ],
  "rejected": [{ "clusters": ["..."], "reason": "temporary | one-off | covered by <skill> | private | insufficient" }],
  "conflicts": ["cluster x says A (2026-07), cluster y says not-A (2026-10); newer kept"]
}
```

Then run `$HL mark --digest` so the next incremental digest only shows new or grown clusters.

## Topic passes

Use one when a subject is described rather than commanded (taste, voice, product feel) and the
cluster digest under-represents it.

1. `$HL topic <name> --categories ... --match <vocabulary regex> --budget <n>` reads every
   consented interactive session and writes a deduplicated, redacted, budgeted digest. Typed
   and repeated statements rank first; long pasted specs last. Narrow with `--match` until the
   included share fits the budget.
2. Read the whole digest and draft rules by judgement: what is consistently asked for, what is
   consistently rejected, and which statements conflict (the newer one wins; record the
   resolution next to the rules).
3. Give each rule a keyword pattern in a `{ "rule-id": "regex" }` file kept beside the skill, then
   `$HL topic-support <name> --patterns <file> --write <skill>/<name>-evidence.md`. Strength is
   from sessions the owner typed it in: high at 5 or more, medium at 2 to 4, otherwise the rule
   is tagged judgement. Keyword counts are approximate; never tag a rule above its count.
