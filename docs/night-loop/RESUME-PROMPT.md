# Prompt: continue the autonomous night loop mission

Paste the block below into a fresh session. Use it only after the previous session has ended or
lost its context: two sessions must not write the same worktree.

```text
Continue the Autonomous Unblocking Night Loop mission. Do not ask me questions.

1. Read this file fully before anything else. It outranks your memory and any chat summary:
   D:\1 - Projects\Projects\AgentSkills-wt-anl\docs\night-loop\CONTEXT.md
   Section 1 is my mission, word for word, and every part of it is binding, including the hard
   limits and the git hygiene rules.

2. Check the "Live state" section against reality before acting:
   - `git status` and `git log --oneline -15` in D:\1 - Projects\Projects\AgentSkills-wt-anl
   - `.night/state.json` and `.night/supervisor.lock` in the run worktree named in the live
     section, if a run was started
   If the worktree has changes the live section does not explain, or a live supervisor lock exists
   that it does not mention, another session is active: stop and tell me what you saw. Otherwise
   correct the live section to match what you found and carry on from "Next action".

3. Shared context is the rule for anything longer than one context window. Keep state in
   CONTEXT.md, in git and in `.night/`, never only in the conversation. Rewrite the live section
   after every finished step, before every commit, and before starting or stopping any background
   process. If you hand part of the work to a subagent, give it the path of CONTEXT.md instead of
   retelling the mission, and have it report back what to change in the live section.

4. Work until the three "finished" conditions in the mission hold. Anything that needs me goes
   into the approval queue and NIGHT-LOOP-REPORT.md while the rest continues. When it ends: stop
   the background processes you started, send one notification, and reply in 2 to 5 sentences.
```
