---
name: research
description: Research a topic, technology, library or question in depth: plan sub-questions, gather primary sources, cross-check claims, run a contrarian pass, and deliver a cited synthesis with confidence levels and what stays unknown. Also covers comparing libraries or tools, evaluating a repo before adopting it, and checking data or experiment results. Scales from a quick answer to a multi-agent deep dive. Use for "research this topic deeply", "compare X and Y", "evaluate this library" or "what's the state of the art".
metadata:
  aliases: "research this, research this topic, deep research, deeply research, compare options, evaluate this library, evaluate this repo, state of the art, literature review"
  keywords: "research, sources, compare, evaluate, library, alternatives, benchmark, study, paper, investigate, data, experiment"
  composes: "understand-code"
  requires: "web-search?, subagents?"
  risk: "low"
---

# Research

Never invent sources, numbers or quotes. Unknown stays unknown.

## Size it

- **Quick** (one fact or comparison): 2–4 searches, primary sources first, an answer with links.
- **Deep** (the topic needs a report): the steps below. In Claude, if the
  `anthropic-skills:deep-research` skill is available and the user wants a long narrative report,
  use it; this skill's steps still apply to the evidence standard.
- **Evaluate a library or repo:** inspect the actual repo (license, last commit, open issues,
  install scripts, hooks, telemetry, network calls, size) before recommending it. Record the URL,
  commit and license. Never install or run it to "try it" without approval.
- **Data or experiment check:** reproduce the numbers from the raw data with a script before
  interpreting them; state sample sizes and what could confound the result.

## Deep research

1. **Frame:** the question, why it matters, what decision it feeds, and 3–7 sub-questions.
2. **Gather:** search each sub-question (fan out to parallel subagents when available, one
   sub-question each). Prefer primary sources: docs, source code, papers, changelogs, official data.
3. **Cross-check:** every important claim needs two independent sources or one primary one. Note
   dates; flag anything older than a year in a fast-moving field.
4. **Contrarian pass:** look for the strongest evidence against the emerging conclusion.
5. **Synthesize:** the answer first, then findings with inline citations, confidence
   (high/medium/low) per finding, open questions, and the sources list. Keep the files in
   `research/<slug>/` in the project when the user wants to keep them.
