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

- **QQ: <question>** = quick question. Answer briefly and directly. If it needs tools or file reads, hand it to a cheap worker model and relay the short answer. Do not change code.
- **ACC: <task>** = autonomous code completion. Steps:
  1. Read and plan (read only what is needed).
  2. Ask ONE grouped, numbered set of questions, each with a predicted answer. Skip if there are no real questions.
  3. Once answered (or skipped), work without stopping. Take the recommended option for open questions, park risky or destructive steps on a branch, and keep going.
  4. Final report: what is done and verified, what is not, the decisions made, and the questions to ask now. For Claude Code, also save it as `~/.claude/acc-reports/YYYY-MM-DD-HHMM-<short-slug>.md` with the sections `## Done`, `## Not done`, `## Decisions`, `## Questions for you` (one `- ` bullet per question).
- **DRY: <change>** = dry run. Read the code and list the exact files and lines that would change and why. Make no edits. End by asking whether to run it as ACC.

## Driver and workers (where subagents are available)

- The main session is the driver: plan, decide, verify, and report. Use the strongest model for it.
- Hand mechanical work (unzipping, moves, renames, formatting, simple searches) to a cheaper worker model. Never hand off a decision, a final review or a destructive step.

## Token habits

- Read only the lines needed (targeted search or line ranges) instead of whole large files.
- Use scripts for mechanical edits. Keep command output short (head, tail, counts).
- Keep final replies short. Do not repeat what was already said.
