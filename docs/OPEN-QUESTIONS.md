# Open questions

Decisions for the owner. Answered 2026-11-09; kept here as the record.

1. **Make the new catalog live?** Decided: merge locally into `main` (not pushed) and run the
   installer.
2. **Prompt router hook?** Decided: off. Skill descriptions route on their own;
   `node scripts/install.mjs --router-hook on` turns it on later.
3. **Codex `AGENTS.md` pointer block?** Decided: on (`--codex-block on`).
4. **Overlapping third-party and stale skills in `~/.codex/skills`?** Decided: move them to
   `~/.codex/skills-archive/` (moved, not deleted), so Codex sees one skill per task.
5. **Vendor more upstream skills?** Decided: no; ideas only, recorded in SOURCES.md.
6. **Trail of Bits skills (CC-BY-SA-4.0)?** Decided: ideas only, linked from SOURCES.md.
7. **Skipped catalog entries** (`build-api`, `build-component`, `audit-ui`, `analyze-data`,
   `test-strategy`, `manage-memory`, `build-agent`)? Decided: stay as modes of existing skills.
8. **Delete the archive branch?** Decided: keep `archive/pre-restructure-2026-11-09`.

## Creative engineering (2026-11-13)

Decisions taken during the build, recorded for review. Each can be reversed.

9. **build-motion as a separate skill?** Decided: merged into `build-animation` (aliases
   "build motion", "build-motion"), to avoid two skills for the same job.
10. **"ui audit" alias.** Moved from `revamp-ui` to `audit-design`, which is read-only; revamp-ui
    hands audit-only requests there.
11. **Description budget (16000 chars).** Kept: the new descriptions were trimmed (catalog now
    15838 chars) instead of raising the limit.
12. **Held-out creative evals start at 12/20 top-1.** Most misses return no match, leaving the
    choice to the agent's own skill descriptions; none routes confidently to a wrong skill. The
    gate is "no regression" (`evals/creative/routing.json`). Open: improve keyword coverage for
    build-ui, build-3d and build-animation phrasings, measured against the held-out set without
    editing it.
13. **Hidden-tab pausing** (`visibilitychange`) is not verified by the runner: headless Chromium
    does not reliably report hidden tabs. Offscreen pausing is measured.
14. **Vendoring candidates** (emilkowalski/skills, gsap-skills): ideas only for now; vendoring
    needs a pinned commit and NOTICE per the security policy. Open for the owner.
15. **Jensen-Yao/agents-skills** named in the spec was not found (404); nothing taken from it.
