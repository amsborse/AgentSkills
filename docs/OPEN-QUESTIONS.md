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
