# Creative work: Claude directs, Codex implements

The bridge, sandbox and quota rules are in `../codex-bridge.md`; who does what and the fallback
order are in `../agent-routing.md`. This file covers how creative work splits.

## Roles

- **Claude (orchestrator):** inspects the product, chooses the direction (`adaptation.md`) and
  the technology (`selector.md`), splits the work, writes briefs, reviews every diff, runs the
  visual loop and decides acceptance. Claude owns taste and the final call.
- **Codex (implementer):** component implementation, animation engineering, shaders, asset
  optimization, responsive passes, Playwright scripts, performance profiling, and independent
  review (`codex-bridge review`).

## Split the work

1. Break the change into parts that touch **disjoint files** (a component, a shader module, a
   page section, a script). Shared files (tokens, layout shell, router) stay with Claude or go to
   one agent only.
2. One worktree per Codex part:
   `git worktree add ../<repo>-codex-<slug> -b codex/<slug>`; run with
   `codex-bridge run --cd ../<repo>-codex-<slug> --sandbox workspace-write --prompt-file brief.md`.
3. Independent parts run in parallel (background Bash per run). Parts that depend on each other
   run in sequence.

## Brief template

Keep it short and concrete; long context goes in a file the brief points to.

```markdown
Goal: <one sentence, the user-visible result>
Direction: <the 3-5 line direction note>
Technique: <file from shared/creative/techniques/ and the chosen tool from selector.md>
Files you own: <paths>. Do not edit anything else.
Constraints: existing framework and components; no new dependency unless named here;
transform/opacity only; reduced-motion fallback; pause offscreen; DPR cap 2.
Acceptance: <observable checks, e.g. "visual-audit passes at all viewports; hover lifts the card
4px with no layout shift; focus ring visible">
Report: changed files, how you verified, anything you could not do.
```

## Accept or reject

- Read the diff. Reject scope creep, new engines, hard-coded colors outside tokens, and missing
  reduced-motion or offscreen pausing.
- Run the project's tests and the visual loop on the merged result, not on Codex's word.
- For large or risky parts, run `codex-bridge review --cd <repo> --base <branch>` as a second
  read, then verify each finding before acting on it.
- Bring accepted work back by merging or cherry-picking the worktree branch, then remove the
  worktree. Record rejected attempts and why in the creative ledger (`learning.md`).
