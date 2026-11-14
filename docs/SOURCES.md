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

## Creative engineering research (2026-11-13)

Researched for `shared/creative/` and the creative skills. Nothing was vendored and no dependency
was added to this repository; every idea below was rewritten in our own words. Libraries are
chosen per project through `shared/creative/selector.md`, which repeats the license notes.

### Libraries (recommended per project, never installed here)

| Library | Version checked | License | Note |
| --- | --- | --- | --- |
| GSAP | 3.15.1 | Custom no-charge license (not OSI) | All plugins free; the license bars tools that compete with Webflow. Use only when timelines or ScrollTrigger earn it. |
| Motion | 14.14 | MIT | Default for React springs, layout and gestures. |
| three.js | r187 | MIT | Real 3D scenes. |
| React Three Fiber / drei | 9.8.2 / 10.7.9 | MIT | three.js in React. |
| OGL | 1.0.11 | Unlicense | One small shader plane; quiet project. |
| PixiJS | 8.23 | MIT | 2D WebGL. |
| Rive runtime | current | MIT | Editor is paid. |
| dotLottie-web | 0.83 | MIT | Preferred over lottie-web. |
| Theatre.js | | Studio is AGPL | Avoided: share-alike studio, stalled. |
| Playwright | 1.65.1 | Apache-2.0 | Used by the `audit-design` runner from the project's own install. |
| axe-core | 4.14 | MPL-2.0 | Injected from the project when present; never vendored. |

Platform status used by the selector: same-document View Transitions Baseline (Oct 2025);
cross-document View Transitions not Baseline; CSS scroll-driven animations Baseline (late 2026);
`@starting-style` Baseline (2024); `linear()` easing widely available.

### Skill repositories

| Source | Commit | License | Decision | What we took |
| --- | --- | --- | --- | --- |
| [emilkowalski/skills](https://github.com/emilkowalski/skills) | 0f2e23b32b | MIT | Ideas; vendoring candidate | Stress data for UI, Lead/Support/Decoration/Static choreography. |
| [greensock/gsap-skills](https://github.com/greensock/gsap-skills) | aed9cfd327 | MIT | Ideas; candidate once its pro-GSAP bias is removed | GSAP performance and ScrollTrigger hygiene. |
| [MengTo/Skills](https://github.com/MengTo/Skills) | 07274a3b3d | MIT | Ideas | P0–P3 findings, top 5–8, removal test (`audit-design`). |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | c4cd1924c3 | Apache-2.0 | Ideas | Operate/Read/Persuade modes and craft floor (`adaptation.md`). |
| [mthines/agent-skills](https://github.com/mthines/agent-skills) | 3f78b3bad1 | MIT | Ideas | First-match technology picker, intensity scale, "reduce, don't remove" for reduced motion. |
| [moh4696/open-3d-skills](https://github.com/moh4696/open-3d-skills) | 53beb899e7 | MIT | Ideas | DPR cap of 2, virtual clock for comparable screenshots (`build-3d`). |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 4f2dbb67e6 | MIT/Apache mixed | Ideas | Three-layer tokens. |
| [anthropics/skills](https://github.com/anthropics/skills) | 2c5958ecac | Apache-2.0 (per skill) | Ideas | Two-pass frontend plan, seeded parameters for generative art. |
| taste-skill, design-motion-principles | | MIT | Ideas | Motion principles. |
| adamperlis/awwwards-motion | | No license | Read only | Nothing reused. |
| vercel-labs/agent-skills | | Unclear | Ideas | View-transition priorities; its unpinned remote rules are a risk. |
| subframe | | Unclear | Inspiration only | |
| podo/design-agent-skills | | | Rejected | Supply-chain risk. |
| JustineBijuPaul/frontend-ai-skills | | | Rejected | Padded and generic. |
| rastian | | No license | Rejected | |
| Jensen-Yao/agents-skills | | | Not found | 404 on 2026-11-13. |

Reference galleries are captured only under `shared/creative/reference-workflow.md`: robots.txt
respected, logged out, screenshots and short recordings, no assets copied.
