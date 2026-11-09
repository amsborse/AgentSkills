# Agent routing: who does the work

The owner's policy: **Codex does UI, Antigravity does simple tasks, Claude does complex tasks.**
When an agent's usage runs out, the work falls to the next one in its row. Claude stays the
architect and final reviewer in every case: delegated output is a proposal until Claude has read
the diff and run the checks.

| Work | First | Then | Last |
| --- | --- | --- | --- |
| UI: components, pages, styling, layout, visual polish, motion, hero assets, UI concepts | Codex | Antigravity | Claude |
| Simple: one clear, isolated change; boilerplate; renames; small scripts; docs; test scaffolding; lookups | Antigravity | Codex, then OpenCode | Claude |
| Complex: architecture, debugging, multi-module changes, security, data migrations, unclear requirements, integration | Claude | (no delegation) | |
| Second-opinion code review | Codex | Antigravity, then OpenCode | Claude self-review |

All delegated agents run through `codex-bridge` (`~/agent-skills/shared/codex-bridge.md`):
`--agent codex` (default), `--agent antigravity`, `--agent opencode`.

## How to tell simple from complex

Simple means you could write the acceptance check in one sentence and the change touches one area
you can name up front. Anything needing judgement across modules, a root-cause hunt, or a design
decision is complex and stays with Claude. When unsure, it is complex. A UI task that is also
complex (new design system, a cross-cutting refactor of the UI layer) is split: Claude decides the
structure, Codex builds the isolated visual pieces.

## Falling back

- A failed run whose summary has `"quotaExhausted": true` means that agent's allowance is used up:
  move to the next agent in the row for the rest of the session. Don't retry the exhausted one.
- Any other failure is not a quota problem. Read `errors` and `stderrTail`, fix the brief or the
  environment, and retry at most once before moving on.
- Say in the final report which agent did each piece and every fallback that happened.

## Fit the brief to the agent

- **Codex:** the only one with image generation (`--assets-dir`) and `--image` inputs, so UI
  concepts and hero assets go here first.
- **Antigravity:** always runs with `--sandbox`. In `workspace-write` its file tools can edit, but
  its shell commands cannot write the workspace, so a task whose commands must write files
  (builds, formatters, `npm install`) fails there; give those to Codex. No `--image`: put image
  paths in the prompt.
- **OpenCode:** OpenCode Go models only; good as a third worker or a different-model second read.
