# Inventory before the restructure

Snapshot of `main` at a68f1eb (2026-11-09), kept on `archive/pre-restructure-2026-11-09`.

| Skill (folder) | Files | Purpose | Decision |
| --- | --- | --- | --- |
| `nightly-evolution` | 23 | Overnight improvement engine (`scripts/evolve.mjs`) and its agent contract | Keep in place; reached through `run-autonomous` |
| `history-learning` | 27 | Learn rules from past agent conversations (`scripts/hl.mjs`) | Keep in place; reached through `manage-skills` |
| `working-agreements` | 6 | The owner's shared rules (`AGENTS.md`, `ui-quality.md`, evidence) | Keep files in place; SKILL.md moves to `skills/` |
| `cinematic-plate` | 8 | Cinematic reference image to live web hero | Workflow of `build-animation` |
| `codex-frontend` | 1 | Delegate frontend work to Codex | Workflow of `coordinate-agents` |
| `codex-review` | 1 | Codex code review | Becomes `review-code` |
| `codex-visual` | 2 | Codex concepts, images, visual review; `BRIDGE.md` | Workflow of `revamp-ui`; bridge doc to `shared/` |
| `improve` | 1 | Audit and implement safe improvements | Keep; add refactor and performance modes |
| `spec` | 1 | One-line goal to a full engineering brief | Workflow of `build-feature` |
| `verify` | 1 | Verify on the real target with evidence | Keep |
| `unslop` | 16 | Vendored UI de-slop passes (CC BY 4.0) | Workflow of `revamp-ui` |
| `scripts/`, `tests/` | 8 | Installer, validator, node:test suites | Extended (router, registry, hooks) |

Problems found in the audit:

- Tool-named skills (`codex-*`) instead of task-named ones; no skill for debugging, research,
  tests, security, launch readiness, browser automation or architecture questions.
- No machine-readable index, so no way to check overlap or route a request.
- `codex-visual/BRIDGE.md` said Codex never pushes, while the working agreements allow a push the
  user asked for. Resolved: the bridge rules bind the delegated agent only (`shared/codex-bridge.md`).
- `unslop/scripts/snapshot.mjs` makes network requests (recorded in `docs/SOURCES.md`).
- About 30 third-party skills in `~/.codex/skills` (design, motion, image generation, Kriya and
  Sutra operations) overlap each other and these skills. They are outside this repository and were
  not changed; see `docs/OPEN-QUESTIONS.md`.

An automated inventory pass (Codex) also claimed that cinematic-plate's templates were missing;
that was wrong, they are present in `workflows/cinematic-plate/`.
