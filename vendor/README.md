# Vendored third-party skills

Third-party skills picked on 2026-11-14 because they are strong for this catalog's work, or
because they help sell the ideas in `docs/FUTURE-SKILLS.md`. Each one is a copy of
upstream at the commit below, kept with its license; the only edits (placeholder emails) are listed in each `NOTICE.md`.

**They are not installed.** `scripts/install.mjs` links only `skills/`, so nothing here reaches
an agent until it is promoted. To promote a skill, review it against our own skills (to avoid
two skills for the same job), then either move it under `skills/` with a `NOTICE.md` that lists
our changes, or fold its ideas into an existing skill. Record the decision in `docs/SOURCES.md`.

Review done before copying: licenses checked (all MIT or Apache-2.0); every script searched for
network calls, shell execution, credential use, installs and telemetry; instructions searched
for `curl | sh`, hooks and prompt injection. The matches were attack examples in security
references (expected) and the notes below. The upstream scanner (`getsentry/skill-scanner`) was
not run on them. Do that, and read every script in full, before promoting anything.

| Skill | Source and commit | License | Why it is here | Watch out |
| --- | --- | --- | --- | --- |
| `getsentry/iterate-pr` | [getsentry/skills](https://github.com/getsentry/skills) `a582c51ee2` | Apache-2.0 | Loop a PR until CI is green and review comments are handled | `reply_to_thread.py` posts replies on GitHub (outward-facing) |
| `getsentry/find-bugs` | same | Apache-2.0 | Tight bug and security pass over a branch diff | Overlaps `review-code` |
| `getsentry/skill-scanner` | same | Apache-2.0 | Static scan of third-party skills; fits our adoption policy | Runs Python locally |
| `getsentry/gha-security-review` | same | Apache-2.0 | GitHub Actions attack review, real-world cases | References contain attack payloads as examples |
| `getsentry/claude-settings-audit` | same | Apache-2.0 | Suggests `settings.json` permissions per repo | |
| `getsentry/pr-screenshots` | same | Apache-2.0 | Before/after screenshot tables in PRs; reference for future skill 1 | Written for the Sentry UI; uploads images |
| `openai/gh-fix-ci` | [openai/skills](https://github.com/openai/skills) `49f948faa9` | Apache-2.0 | Read failing GitHub checks and logs, then plan the fix | Uses `gh` |
| `openai/gh-address-comments` | same | Apache-2.0 | Work through PR review comments | Uses `gh` |
| `openai/security-threat-model` | same | Apache-2.0 | Threat model grounded in the repository; feeds future skill 2 | Overlaps `security-audit` |
| `anthropics/webapp-testing` | [anthropics/skills](https://github.com/anthropics/skills) `1780c5e5a5` | Apache-2.0 | Playwright helper that starts the server, then tests | `with_server.py` runs the given server command with `shell=True` |
| `anthropics/frontend-design` | same | Apache-2.0 | Distinctive visual direction for new UI | Overlaps `build-ui` |
| `emilkowalski/review-animations` | [emilkowalski/skills](https://github.com/emilkowalski/skills) `0f2e23b32b` | MIT | High craft bar for motion code | Overlaps `build-animation` review |
| `emilkowalski/break-ui` | same | MIT | Stress UI with worst-case data | |
| `emilkowalski/learn-taste` | same | MIT | Turn design corrections into rules; close to `history-learning` | |
| `addyosmani/doubt-driven-development` | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) `39b723ceeb` | MIT | Adversarial review of each decision in a fresh context | Extra agent calls cost tokens |
| `mattpocock/grill-with-docs` | [mattpocock/skills](https://github.com/mattpocock/skills) `5863806dd4` | MIT | Hard interview that sharpens a plan and writes ADRs | |
| `coreyhaines31/product-marketing` | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) `1f837447b2` | MIT | Product context doc the other marketing skills read first | Writes `.agents/product-marketing.md` |
| `coreyhaines31/pricing` | same | MIT | Pricing and packaging for the future skills | |
| `coreyhaines31/launch` | same | MIT | Launch plan (Product Hunt, channels, timing) | Mentions partner tools by name |
| `coreyhaines31/copywriting` | same | MIT | Landing and pricing page copy | |
| `coreyhaines31/cro` | same | MIT | Improve page and form conversion | |

Skipped on purpose: `anthropics/mcp-builder` (its evaluation script calls the paid Anthropic API),
`obra/superpowers` (already taken as ideas; its always-on hook injects context every session),
and the rest of these repositories, which duplicate skills we already have.
