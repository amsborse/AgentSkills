# Migration: old skills to the task catalog

The restructure (branch `restructure/skill-catalog`) turns 11 tool-named skills into 17 task-named
skills. Nothing was deleted: every old file moved (git tracks them as renames) or stayed where it
was. The pre-restructure tree is kept on the branch `archive/pre-restructure-2026-11-09`
(commit a68f1eb).

## Old to new

| Old skill (how you called it) | Now | Where the content went |
| --- | --- | --- |
| `/spec` | `build-feature` (Large size) | `skills/build-feature/workflows/spec.md` |
| `/codex-review` | `review-code` | `skills/review-code/SKILL.md` (rewritten around the same command) |
| `/codex-frontend` | `coordinate-agents` | `skills/coordinate-agents/workflows/codex-implement.md` |
| `/codex-visual` | `revamp-ui` (concepts, image, review modes) | `skills/revamp-ui/workflows/codex-visual.md` |
| `codex-visual/BRIDGE.md` | shared file | `shared/codex-bridge.md` |
| `/unslop` | `revamp-ui` (Polish mode) | `skills/revamp-ui/workflows/unslop/` (vendored, CC BY 4.0) |
| `/cinematic-plate` | `build-animation` | `skills/build-animation/workflows/cinematic-plate/` |
| `/improve` | `improve` (plus refactor and performance modes) | `skills/improve/SKILL.md` |
| `/verify` | `verify` | `skills/verify/SKILL.md` |
| `working-agreements` | `working-agreements` | `skills/working-agreements/SKILL.md`; the rules stay at `working-agreements/AGENTS.md` |
| `nightly-evolution` | `run-autonomous` (nightly mode), still installed by name | unchanged at `nightly-evolution/` |
| `history-learning` | `manage-skills` (learn mode), still installed by name | unchanged at `history-learning/` |

New skills with no predecessor: `fix-bug`, `understand-code`, `research`, `test-everything`,
`security-audit`, `production-ready`, `automate-browser`, `run-autonomous`, `manage-skills`.

`working-agreements/`, `nightly-evolution/` and `history-learning/` keep their paths because
other repositories and night loops reference them (`@~/agent-skills/working-agreements/AGENTS.md`,
`~/agent-skills/nightly-evolution/scripts/evolve.mjs`).

## What changes on your machine

- `node scripts/install.mjs` links each catalog skill into `~/.claude/skills/<name>` and
  `~/.agents/skills/<name>` (read by Codex, Cursor, Gemini CLI and OpenCode), and removes links it
  owns that no longer match a skill (the old `spec`, `codex-*`, `unslop`, `cinematic-plate`
  links). It never removes a real directory or a link that points outside this repository.
- Links that the old installer put in `~/.codex/skills` are moved to `~/.agents/skills` (Codex
  reads both; one copy avoids duplicates). Third-party skills in `~/.codex/skills` are not touched.
- The prompt router hook and the Codex `AGENTS.md` block are **opt-in** flags; plain install does
  not edit any settings file. See `docs/ARCHITECTURE.md`.

The SessionStart hook already in `~/.claude/settings.json` runs `scripts/install.mjs` from the
main checkout, so the new links appear in the first session after the main checkout is on the new
branch.

## Rollback

```sh
cd "D:/1 - Projects/Projects/AgentSkills"
node scripts/install.mjs --router-hook off --codex-block off   # only if you turned them on
git switch main                                                 # or archive/pre-restructure-2026-11-09
node scripts/install.mjs                                        # old installer relinks the old names
```

`--router-hook on` saves `~/.claude/settings.json.agent-skills-backup` the first time it edits
settings; copying that file back restores the settings exactly.
