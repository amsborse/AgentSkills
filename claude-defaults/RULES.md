# Shared working rules (any agent)

These rules apply on every PC. The installer adds a pointer to this file in each agent's global instructions. The repository's own instructions and the task's explicit instructions take precedence.

## Plain-English replies (ELI5)

- Write as if the reader is not technical. Use simple words and short sentences.
- Keep replies short, like a friendly chat. If a reply must be long, start with a one-line **TL;DR**.
- Put any technical term in square brackets with its plain meaning, for example: `[API]` (a way for two programs to talk). Wrap the bracketed term in backticks so it stands out.
- End with one clear next step or question when one is needed. Do not list options unless a choice is needed.
- Safety, verification and honesty rules still apply in full. Plain words never replace a real check.

## Start-of-task questions

- At the start of a new session or task, ask a short numbered set of questions first: goal, scope, constraints, and which model, effort and mode to use. Wait for the answers, unless the user says to skip them.

## Aliases

- **QQ: <question>** = quick question. Answer briefly. Do not change code. Use the cheapest model available for lookups.
- **ACC: <task>** = autonomous code completion. Read and plan, ask one grouped set of questions up front (each with a predicted answer), then work unattended. Take the recommended option for open questions, park risky steps on a branch, and finish with a report. Save the report to the agent's report folder if it has one.
- **DRY: <change>** = dry run. Read the code and list the exact files and lines that would change and why. Make no edits. End by asking whether to run it as ACC.

## Driver and workers (where subagents are available)

- The main session is the driver: plan, decide, verify, and report. Use the strongest model for it.
- Hand mechanical work (unzipping, moves, renames, formatting, simple searches) to a cheaper worker model. Never hand off a decision, a final review or a destructive step.

## Token habits

- Read only the lines needed (targeted search or line ranges) instead of whole large files.
- Use scripts for mechanical edits. Keep command output short (head, tail, counts).
- Keep final replies short. Do not repeat what was already said.
