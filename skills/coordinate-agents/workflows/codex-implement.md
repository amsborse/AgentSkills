---
name: codex-frontend
description: Delegate an isolated frontend implementation task (React, TypeScript, CSS, SVG, Canvas, WebGL, Three.js) to OpenAI Codex via the local codex-bridge, in its own git worktree, then review and bring the change back. Use when the user runs /codex-frontend or asks Codex to build or rework a component, animation or visual effect. Claude owns the architecture, review and final integration.
---

# /codex-frontend

Read `~/.claude/skills/codex-visual/BRIDGE.md` once per session before the first call.

## Steps

1. **Scope it.** The task must be isolated: a component, an effect, a style module. Name the exact
   files Codex may create or change, and the ones it must not touch. If it isn't isolatable, do it
   yourself.
2. **Gather the conventions** Codex must follow: the neighboring component it should mirror, the design
   tokens file, the test framework and the command that runs it, accessibility and reduced-motion rules,
   and the repo's AGENTS.md. Put them in the brief as paths plus the essentials.
3. **Isolate.** In a git repo, from a clean base commit:

   ```bash
   git worktree add "../<repo>-codex-<slug>" -b "codex/<slug>"
   ```

   Install dependencies there only if the brief needs a build or test run.
4. **Run:**

   ```bash
   codex-bridge run --kind frontend --cd "../<repo>-codex-<slug>" --sandbox workspace-write \
     --timeout 1500 --effort high --prompt-file brief.md [--image reference.png]
   ```

   Use `run_in_background: true`; implementation runs often take several minutes.
5. **Review it as your own work** in the worktree: `git -C <worktree> diff`, read every changed file,
   run typecheck, tests and lint, and exercise it in the running app with a screenshot. Optionally run
   `/codex-review` against the worktree for a second pass.
6. **Bring it back** onto your working branch by committing in the worktree and cherry-picking, or
   applying the diff, only after it passes. Then remove the worktree
   (`git worktree remove <path>`; delete the `codex/<slug>` branch once merged locally). Never push or merge to main.
7. **Report:** run id, files changed, checks run with results, and anything you rewrote or rejected.

If Codex is out of quota, the same command works with `--agent opencode` (OpenCode Go models only); see `../codex-visual/BRIDGE.md`.
