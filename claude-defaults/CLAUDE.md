# Claude defaults for cloud sessions (copy into a repo's CLAUDE.md)

## Aliases (typed at the start of a message)

- **QQ: <question>**: quick answer. Hand any tool or file work to a Haiku subagent, and make no code changes.
- **ACC: <task>**: autonomous code completion. Read and plan first. Ask ONE grouped, numbered set of questions with a predicted answer for each, then work without stopping. Take the recommended option for anything open, park risky steps on a branch, and finish with a report: done and verified, not done, decisions made, questions for the user. Save the report to `acc-reports/YYYY-MM-DD-HHMM-<slug>.md` with the sections `## Done`, `## Not done`, `## Decisions`, `## Questions for you`.
- **DRY: <change>**: dry run. Read the code, then list the files and lines you would change and why. Make no edits. End by asking whether to run it as ACC.

## Driver and workers

Opus or Fable is the driver: it decides, plans and verifies. Sonnet or Haiku do grunt work through subagents: Sonnet for coding and multi-file reads, Haiku for mechanical work such as unzipping, moving, renaming and formatting. Never hand off a decision, a final review or a destructive step.
