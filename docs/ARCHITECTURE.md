# Architecture

One repository of task-named skills, linked into every agent on the machine. No skill is tied
to one repository, one agent or one paid service.

```text
skills/<name>/SKILL.md      one skill per task the user asks for; short, routes to the rest
skills/<name>/workflows/    longer procedures loaded only when that path is taken
shared/                     material several skills read (codex-bridge.md, browser.md)
shared/creative/            creative engineering layer read by the creative skills
evals/creative/             held-out routing evals (gate for night-evolve-skills)
demos/creative/             static demos of the creative layer
registry/                   generated index: skills.json, capabilities.json; compatibility.json by hand
working-agreements/         the owner's rules (AGENTS.md), imported by other repositories
nightly-evolution/          overnight engine + skill (path kept: night loops call its script)
history-learning/           learning engine + skill (path kept)
scripts/                    install, validate, build-registry, route, hooks/route-hook
tests/                      node:test suites, no network, no paid calls
docs/                       this file, catalog, migration, sources, open questions, inventory
```

## How a request finds a skill

1. **Native discovery (always on).** Each agent lists the installed skills' `name` and
   `description` in its context and loads a `SKILL.md` when the request fits. Descriptions are
   written as "what it does, then 'Use for "…"'" with the user's own phrasings, so this is the main
   router. Cost: the descriptions of all installed skills, every turn (measured by
   `scripts/validate.mjs`, budget 16,000 characters).
2. **Composite skills adapt to size.** Each SKILL.md opens with "Size it" or "Pick the path":
   a one-line fix stays light, a large job follows the full steps. Skills name the skills they
   compose (`metadata.composes`) instead of copying their steps.
3. **Optional keyword router.** `scripts/route.mjs` scores a request against
   `registry/skills.json`: an alias phrase found in the request is worth 5 (+1 per extra word), a
   word of the skill name 2, each keyword 1; matches need 3 or more, at most 3 are returned and
   close scores are flagged ambiguous. It runs in milliseconds, makes no model call, and is used by
   `manage-skills` ("which skill fits?") and the opt-in Claude hook.
4. **Opt-in prompt hook.** `scripts/hooks/route-hook.mjs` (UserPromptSubmit) adds one short hint
   ("Skill router (keyword hint, may be wrong): fix-bug …") when the router matches. It is
   fail-open: any error, a slash command, a prompt under 3 words, or `AGENT_SKILLS_ROUTER=off`
   means no hint and the prompt continues normally; errors are still written to stderr
   (`agent-skills route-hook: …`) so a broken registry is visible, not silent.

## Creative engineering layer

Eight composite skills share one layer in `shared/creative/` instead of copying guidance:
`revamp-ui` (existing UI), `build-ui` (new UI), `add-interactions`, `build-animation` (motion,
including the former build-motion), `build-3d`, `create-visuals`, `replicate-design` and
`audit-design` (read-only). The layer is style-agnostic: no aesthetic, color or component is
built in.

- `adaptation.md`: read the product first (purpose, users, brand, density, devices, budget) and
  name its mode (Operate, Read, Persuade); 3D, gradients, glass, clay and cinematic are never
  defaults. Style add-ons stay in `styles/`.
- `selector.md`: one engine per need, lightest first (CSS and the platform, then Motion or GSAP,
  then OGL, PixiJS or three.js), with license notes. Nothing is installed without a recorded
  reason.
- `techniques/` (17 files, loaded one at a time through `README.md`): each has Use when,
  Options, Dependencies, Accessibility, Performance, Compatibility, Reduced motion and Verify;
  `validate.mjs` fails a technique missing a section, a broken sibling link or an index entry.
- `visual-loop.md`: render, capture, critique, improve, verify. Before and after screenshots go to
  `.visual/before` and `.visual/after`; quality is never claimed from code.
- `reference-workflow.md`: the nine-step, ethical way to reproduce a reference.
- `codex-orchestration.md`: Claude keeps direction, review and acceptance; Codex implements
  isolated parts in a worktree.
- `learning.md`: `audit-design/scripts/record-findings.mjs` appends runner results and feedback
  to a findings ledger; `night-evolve-skills` reads repeated defects from it and must keep the
  held-out evals (`tests/creative-evals.test.mjs`) green.

`audit-design/scripts/visual-audit.mjs` is the deterministic gate: Playwright from the project's
own install, desktop/tablet/mobile in light and dark, measuring contrast, overflow, focus, hover,
reduced motion, offscreen and idle rendering, long frames and layout shift. Exit 0 pass, 3
blocker or major, 2 incomplete, 1 usage. It never judges taste; the critique step does that from
the screenshots.

## Frontmatter

Only standard Agent Skills keys: `name` (equals the folder), `description` (≤1024 characters),
optional `license`, `compatibility`, `allowed-tools`, and `metadata` with string values:

| Key | Meaning |
| --- | --- |
| `aliases` | comma-separated request phrases; unique across the catalog |
| `keywords` | comma-separated single words for scoring |
| `composes` | skills this one calls into (must exist) |
| `requires` | capabilities it needs; `?` marks optional (`browser, codex-bridge?`) |
| `risk` | `low` (read-only), `medium` (edits code), `high` (acts outside the repo or unattended) |

`node scripts/build-registry.mjs` turns this into `registry/skills.json` and
`registry/capabilities.json`; `--check` fails when they are out of date. `validate.mjs` also
checks unique aliases, existing `composes` targets and referenced files.

## Installation

`node scripts/install.mjs` (idempotent; `--dry-run`, `--uninstall`):

- links each `skills/<name>` (and `nightly-evolution`, `history-learning`) into
  `~/.claude/skills/` (plus `~/.claude-<profile>/skills/`) and `~/.agents/skills/` — junctions on
  Windows, symlinks elsewhere. `~/.agents/skills` is read by Codex, Cursor, Gemini CLI and
  OpenCode;
- prunes links it owns (pointing into this repository) that no longer match a skill, and moves old
  links from `~/.codex/skills` to `~/.agents/skills`; it never touches real directories, links
  pointing elsewhere, or `.system`;
- writes a manifest of what it did;
- never edits settings unless asked: `--router-hook on|off` adds or removes the UserPromptSubmit
  hook in `~/.claude/settings.json` (backup saved once to `settings.json.agent-skills-backup`;
  invalid JSON aborts), `--learning-hooks on|off` adds or removes the history-learning
  SessionStart hook the same way plus its daily run (Task Scheduler task or crontab line), and `--codex-block on|off` adds or removes a
  marked block in `$CODEX_HOME/AGENTS.md`.

The existing SessionStart hook in `~/.claude/settings.json` runs the installer at session start,
so a `git pull` or branch switch is picked up automatically. Agents without skill support read the
repository's `AGENTS.md`, which points to `~/agent-skills/working-agreements/AGENTS.md`.
Per-agent details: `registry/compatibility.json`.

## Security

Third-party code is untrusted: vendored only at a pinned commit with its license and a NOTICE,
never auto-updated, never run because a skill says so. Policy and review results:
`docs/SOURCES.md`. Tests use fakes and temp directories, never real settings or paid calls.
