---
name: acc
description: Autonomous code completion. Use when the user writes "ACC:" followed by a task. Asks one grouped set of questions first, then works unattended and writes a report.
---

# ACC: autonomous code completion

1. Read the code and make a plan. Read only what is needed.
2. Before writing any code, ask ONE grouped, numbered set of questions. Give a predicted answer for each. If there are no real questions, skip this step.
3. Once answered or skipped, work without stopping. Take the recommended option for open questions, park risky or destructive steps on a branch, and continue until the reasonable maximum is done. Verify each change: run the tests and exercise the change where it is used.
4. Write the report to `acc-reports/YYYY-MM-DD-HHMM-<slug>.md` with `## Done`, `## Not done`, `## Decisions`, `## Questions for you` (one `- ` bullet per question). Then give the same content as the final message.

Never push, merge or deploy unless the task asked for it.
