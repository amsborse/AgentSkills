---
name: manage-skills
description: Manage this skill catalog — find which skill fits a request, create or update a skill, vet and adopt a third-party skill, reinstall or repair skill discovery for Claude, Codex and other agents, and learn new rules from past agent conversations (history-learning). Use for "which skill should I use", "add a skill", "update my skills", "install skills", "learn from my history" or when a skill seems missing or broken.
metadata:
  aliases: "manage skills, which skill, add a skill, create a skill, update my skills, install skills, learn from history, learn from my conversations, skill router"
  keywords: "skill, skills, catalog, registry, router, install, discovery, history, learning, vendor, adopt"
  composes: "security-audit"
  requires: "shell"
  risk: "medium"
---

# Manage skills

The catalog lives in `~/agent-skills`. Read `~/agent-skills/docs/ARCHITECTURE.md` before
structural changes.

- **Which skill fits:** `node ~/agent-skills/scripts/route.mjs "<request>"` prints the ranked
  matches; the full list is `docs/SKILL-CATALOG.md`.
- **Create or update a skill:** extend an existing skill before adding one (check
  `registry/capabilities.json` for overlap). A skill is `skills/<name>/SKILL.md` with `name`,
  `description` and `metadata` (`aliases`, `keywords`, `composes`, `requires`, `risk`); long
  procedures go in `workflows/`, material used by several skills in `shared/`. Then run
  `node scripts/build-registry.mjs`, `node scripts/validate.mjs` and `node --test tests/*.test.mjs`.
- **Adopt a third-party skill:** it is untrusted code. Review it with `security-audit`
  (third-party mode), pin the commit, record URL, commit, license and changes in
  `docs/SOURCES.md`, keep the license and notice files. Never auto-update or run unreviewed code.
- **Install or repair discovery:** `node scripts/install.mjs` links every skill into
  `~/.claude/skills` and `~/.agents/skills` and prunes stale links it created. `--dry-run` shows
  the plan. The prompt router hook is opt-in: `--router-hook on|off`. Rollback is in
  `docs/MIGRATION.md`.
- **Learn from history:** follow `~/agent-skills/history-learning/SKILL.md` (consent per source,
  redaction first, every change reviewed).
