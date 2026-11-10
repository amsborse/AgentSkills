---
name: review-code
description: Review a diff, branch, commit or PR for real bugs, performance problems, needless complexity and missing tests, and verify every finding before reporting it. By default the review is an independent read-only pass by OpenAI Codex through codex-bridge (the former /codex-review); without the bridge it is a careful self-review. Use for "review this", "code review", "second opinion", "have Codex check it", or before calling a large change done.
metadata:
  aliases: "review this, code review, review my changes, review the diff, review this pr, second opinion, codex review"
  keywords: "review, diff, pull request, pr, critique, findings, branch, commit"
  composes: "fix-bug"
  requires: "git, codex-bridge?"
  risk: "low"
---

# Review code

## Pick the reviewer

- **Codex (default when `codex-bridge` is on PATH):** an unanchored second read. Read
  `~/agent-skills/shared/codex-bridge.md` once per session first.
- **Out of quota** (`"quotaExhausted": true`): rerun with `--agent antigravity`, then
  `--agent opencode` (order in `~/agent-skills/shared/agent-routing.md`). If none is available, review it
  yourself in the same output format. In Claude Code, the built-in `/code-review` is an
  alternative the user can run.

## Steps

1. **Target:** uncommitted changes (default), a branch against its base (`--base main`) or one
   commit (`--commit SHA`). For a non-git folder use `codex-bridge run --kind review` with a
   read-only prompt naming the files.
2. **Focus note** (short): what the change is for, the risky parts, out of scope. Don't pass your
   own conclusions.
3. **Run** (read-only is enforced by the bridge; run in the background for big diffs):

   ```bash
   codex-bridge review --cd "<repo>" [--base main | --commit SHA] --timeout 900 \
     --prompt "Focus: <intent and risks>. Report findings as: severity (high/medium/low), file:line, the problem, a concrete failure scenario, and the suggested fix. Separate real bugs from style. Say 'no findings' if there are none."
   ```

4. **Verify every finding** against the code: confirmed, plausible or rejected (with the reason).
   Don't relay unverified claims. A runtime claim (browser API behavior, layout, timing, an
   observer missing an element) is checked in the real runtime, with a browser probe or a test
   that fails, not by reading code. A reviewer once said a ChapterRail IntersectionObserver
   `rootMargin` would miss short chapters, and a Chromium probe showed it did not.
5. **Report:** run id, confirmed findings by severity, rejected ones in one line each. Change code
   only if asked; then fix each confirmed bug with a regression test (`fix-bug`).
