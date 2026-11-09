# Open questions

Decisions for the owner. Each has the default that was taken so the work could continue.

1. **Make the new catalog live?** The work is on `restructure/skill-catalog`; the main checkout is
   still on `main`, so the installed skills are the old ones. Default: not switched. To switch,
   merge the branch (or `git switch` it in the main checkout); the SessionStart hook relinks.
2. **Turn on the prompt router hook?** It adds one line of skill hints to matching prompts
   (`node scripts/install.mjs --router-hook on`). Default: off; skill descriptions already route.
3. **Add the Codex `AGENTS.md` pointer block** (`--codex-block on`)? Default: off.
4. **Prune overlapping third-party skills in `~/.codex/skills`** (outside this repo): the design
   group (`taste-skill`, `taste-skill-v1`, `soft-skill`, `minimalist-skill`, `brutalist-skill`,
   `redesign-skill`, `apple-design`, `emil-design-eng`, `gpt-tasteskill`, `impeccable`), the motion
   group (`animate`, `animation-vocabulary`, `improve-animations`, `review-animations`,
   `find-animation-opportunities`), image generation (`imagegen-frontend-web`,
   `imagegen-frontend-mobile`, `image-to-code-skill`). Default: untouched.
   Also stale real copies there of our old skills (`cinematic-plate`, `codex-*`, `spec`,
   `unslop`, `improve`, `verify` …) if they are directories rather than links: the installer
   reports and leaves them.
5. **Vendor more upstream skills?** Candidates: `anthropics/skills` webapp-testing and
   frontend-design, `openai/skills` gh-fix-ci and security-threat-model, selected
   `obra/superpowers` and `mattpocock/skills` skills. Default: ideas only, nothing vendored.
6. **Trail of Bits security skills** are CC-BY-SA-4.0 (share-alike). Vendoring would put
   share-alike files in an MIT repo. Default: ideas only.
7. **Skipped catalog entries:** `build-api`, `build-component`, `audit-ui`, `analyze-data`,
   `test-strategy`, `manage-memory`, `build-agent`. They are covered as modes of existing skills
   (`build-feature`, `revamp-ui`, `research`, `test-everything`). Default: not added, to keep
   descriptions small.
8. **Delete the archived originals?** The old layout lives only on the archive branch now; the
   files were moved, not copied. Default: keep the branch.
