---
name: codex-review
description: Get an independent, read-only code review of Claude's implementation from OpenAI Codex via the local codex-bridge — bugs, performance problems, unnecessary complexity, missing tests. Use when the user runs /codex-review, asks for "a second opinion from Codex", or wants Codex to check a diff, branch or commit. Codex never edits files here; Claude verifies each finding before acting.
---

# /codex-review

Read `~/.claude/skills/codex-visual/BRIDGE.md` once per session before the first call.

## Steps

1. **Pick the target** from the request: uncommitted changes (default), a branch vs its base
   (`--base main`), or one commit (`--commit SHA`). For a non-git folder, use
   `codex-bridge run --kind review` with a read-only prompt that names the files.
2. **Write a focus note** (optional, short): what the change is meant to do, the risky parts, and
   anything out of scope. Don't pass your own conclusions — the point is an unanchored read.
3. **Run** (read-only is enforced by the bridge):

   ```bash
   codex-bridge review --cd "<repo>" [--base main | --commit SHA] --timeout 900 \
     --prompt "Focus: <intent and risk areas>. Report findings as: severity (high/medium/low), file:line, the problem, a concrete failure scenario, and the suggested fix. Separate real bugs from style. Say 'no findings' if there are none."
   ```

   Use `run_in_background: true` for large diffs.
4. **Verify every finding** against the code yourself before reporting it. Mark each one confirmed,
   plausible, or rejected (with the reason). Codex can be wrong; don't relay unverified claims as fact.
5. **Report** to the user: run id, confirmed findings ranked by severity, rejected ones in one line each.
   Don't change code unless the user asked you to fix the findings; if they did, fix them yourself and
   add a regression test for each real bug.

If Codex is out of quota, the same command works with `--agent opencode` (OpenCode Go models only); see `../codex-visual/BRIDGE.md`.
