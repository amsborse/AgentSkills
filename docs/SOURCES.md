# Third-party sources

Researched on 2026-11-09. Commits are the upstream HEAD inspected that day. Only `unslop` is
vendored; everything else was adopted as ideas only (rewritten in our own words), noted as an
optional tool the user installs themselves, or rejected.

## Security policy

- Third-party skills are untrusted executable dependencies. Before adopting one, read every
  script, hook and instruction (`security-audit`, third-party mode).
- Vendor only at a pinned commit, with its license and a NOTICE that lists our changes.
- Never auto-update vendored code or run an upstream script because a skill says to. Updates
  are a reviewed diff against the pinned commit.
- Reject skills that add always-on hooks, telemetry, paid calls, credential handling or
  `curl | sh` installs, unless the owner approves that specific risk.
- Share-alike licenses (CC-BY-SA) are not vendored into this MIT repository.

## Vendored

| Source | Commit | License | What | Changes |
| --- | --- | --- | --- | --- |
| [heydamir/unslop](https://github.com/heydamir/unslop) | a6f121e | CC BY 4.0 | `skills/revamp-ui/workflows/unslop/` | frontmatter dropped, script paths rewritten; see its `NOTICE.md` |

Known risk: `unslop/scripts/snapshot.mjs` (lines 53 and 87) fetches pages over the network when
run; it only runs when the workflow asks for a snapshot of a URL the user gave.

## Reviewed

| Source | Commit | License | Decision | Why |
| --- | --- | --- | --- | --- |
| [obra/superpowers](https://github.com/obra/superpowers) | 22f0b463e7 | MIT | Ideas | Good debugging, planning and verification discipline (in `fix-bug`, `build-feature`). Its always-on SessionStart hook injects large context every session; not adopted. Vendoring selected skills is an open question. |
| [mattpocock/skills](https://github.com/mattpocock/skills) | 4ae2317ddb | MIT | Ideas | Concise task skills; shaped the sizing sections. Candidate for vendoring. |
| [trailofbits/skills](https://github.com/trailofbits/skills) | e4dd0bb5b1 | CC-BY-SA-4.0 | Ideas | Strong security audit methods (in `security-audit`); share-alike, so not vendored. |
| [mdorf/agent-skills](https://github.com/mdorf/agent-skills) | 15bb944cd3 | MIT | Ideas | Workflow structure. |
| [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) | 6c8002eca4 | Apache-2.0 | Optional tool | Code graph for large repos, mentioned in `understand-code`; user installs it. |
| [Egonex-AI/Understand-Anything](https://github.com/Egonex-AI/Understand-Anything) | a6ea402476 | MIT | Ideas | Architecture mapping; its hooks and per-session token cost not adopted. |
| [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) | 8176b150ef | Apache-2.0 | Rejected | Telemetry, a paid upsell, and a model call on every hook. |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | 613fbf88e0 | Apache-2.0 | Ideas | Design audit checklist (in `revamp-ui`); its hooks and binary skipped. Already installed separately in `~/.codex/skills`. |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 4f2dbb67e6 | MIT | Ideas | Design reference data. |
| [browserbase/skills](https://github.com/browserbase/skills) | 6811ca3116 | MIT | Ideas | Needs a paid cloud browser. |
| [microsoft/playwright](https://github.com/microsoft/playwright) | 84e2bdcaa5 | Apache-2.0 | Tool | `playwright-cli` is the preferred browser tool (`shared/browser.md`). |
| [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | 404be8eb89 | Apache-2.0 | Tool | Second choice; `microsoft/playwright-cli` (4bc00fb7fa) is cheaper on tokens. |
| [hec-ovi/research-skill](https://github.com/hec-ovi/research-skill) | 1095897511 | MIT | Ideas | Sub-question planning and contrarian pass (in `research`). |
| [Panniantong/Agent-Reach](https://github.com/Panniantong/Agent-Reach) | c70ae6da5d | MIT | Rejected | Scraping with stored credentials and `curl | sh` installs. |
| [anthropics/skills](https://github.com/anthropics/skills) | 2c5958ecac | Apache-2.0 (per skill) | Ideas; candidates | `skill-creator`, `frontend-design`, `webapp-testing` are vendoring candidates. `skill-creator` is already available in Claude as `anthropic-skills:skill-creator`. |
| [openai/skills](https://github.com/openai/skills) | 49f948faa9 | Apache-2.0 (Figma excepted) | Ideas; candidates | `security-threat-model`, `gh-fix-ci` are vendoring candidates. |
| [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) | 4b0e9f01fa | Apache-2.0 | Optional tool | Its postinstall downloads a binary without a checksum; not installed. |
| [vercel-labs/skills](https://github.com/vercel-labs/skills) | d3701c11b1 | MIT | Optional tool | Skill installer CLI; telemetry is on by default. |

Commit hashes are abbreviated to 10 characters as recorded during the review.
