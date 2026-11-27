# Replicable Industry Patterns (SaaS, Games, AI & DevTools)

Use this reference during `night-ideas` to match a repository's exact stage and domain with high-ROI,
battle-tested patterns worth replicating—never generic wrapper bloat.

## 1. B2B & Micro-SaaS Patterns (Linear / Raycast / Vercel / PostHog Standard)

| Repo Stage | High-Leverage Replicable Pattern | Where to Look in Code | Follow-Up Loop |
| --- | --- | --- | --- |
| `seed` / `prototype` | **Zero-Blank-Slate Sample Workspace:** One-click or default realistic demo dataset so new users experience charts, filters, and search in <30s. | Empty dashboard states, onboarding routes, seed scripts | `night-saas-lab` |
| `prototype` / `mvp` | **Contextual `Cmd+K` Command Palette:** Global fuzzy jump + row-level actions ("Change status", "Copy deep link", "Export") with keyboard hints. | App shell / layout header, router, action handlers | `night-saas-lab` |
| `mvp` | **Human-in-the-Loop (HITL) Review Queue:** Draft -> Preview diff -> 1-click Approve / Batch Approve / Edit for automated or AI-generated actions. | Background jobs, AI endpoints, outbound mutations | `night-saas-lab` |
| `mvp` / `production` | **Export-First & Read-Only Share Snapshots:** Instant CSV/JSON/Markdown export + expiring read-only share URLs that turn outputs into viral loops. | Report views, tables, analytics screens | `night-saas-lab` |
| `mvp` / `production` | **Transparent Usage Metering & Soft Spend Caps:** Live progress bar against plan quota + configurable soft-cap webhook/banner before overage shock. | Billing/entitlements middleware, settings page | `night-saas-lab` |
| `production` | **Tenant-Scoped Audit Log & Self-Serve Viewer:** Immutable `actor, action, target, ip, request_id` table with admin search and export. | Authz middleware, write controllers, org settings | `night-saas-lab` |
| `production` | **AEO (`llms.txt` + Structured JSON-LD):** Machine-readable product/docs index so LLM answer engines cite and route integrations accurately. | Public docs, marketing routes, `public/` | `night-docs` |

## 2. Indie, Web & Desktop Game Patterns (Balatro / Celeste / Survivors Standard)

| Repo Stage | High-Leverage Replicable Pattern | Where to Look in Code | Follow-Up Loop |
| --- | --- | --- | --- |
| `seed` / `prototype` | **Control Feel Triad (Coyote + Buffer + Variable Arc):** `100ms` ledge grace, `120ms` input buffer before landing/cooldown end, early-release gravity multiplier. | Player controller, input tick, physics step | `night-game-lab` |
| `prototype` / `mvp` | **Impact "Juice" Stack:** `4-frame` hitstop on crits, `trauma^2` decaying camera impulse, `3-frame` white hit-flash, `±8%` audio pitch jitter + intensity slider. | Combat/collision events, camera, audio manager | `night-game-lab` |
| `mvp` | **Composable Modifier / Relic Pipeline ("Balatro Math"):** Deterministic ordered hook pipeline (`onTrigger -> additive -> multiplicative -> cascade`) with live score preview. | Upgrade/item definitions, damage/score formulas | `night-game-lab` |
| `mvp` | **Seeded Daily / Challenge Runs:** Replace `Math.random()` in gameplay rules with a seeded PRNG + shareable 6-char seed code & run summary card. | RNG calls, world/wave generator, game-over screen | `night-game-lab` |
| `mvp` / `production` | **Headless Monte Carlo Balance Simulator:** Fast CLI/test script simulating 1,000 automated runs across archetypes to flag >75% dominant or <5% dead builds. | Game state reducer / combat engine | `night-game-lab` |
| `production` | **Versioned Save Schema + Soft-Lock Rescue:** `save_version` migration chain + out-of-bounds / impossible-state checkpoint recovery. | Save/load serializer, level spawn logic | `night-readiness` |

## 3. AI Apps, APIs, CLIs & Libraries

- **AI-Native Apps:** Deterministic fixture eval harnesses (zero paid calls in CI), structured output schema guards with bounded repair retries, prompt-injection delimiter isolation, token/latency budget telemetry.
- **CLIs & DevTools:** `--json` machine-readable output mode, `--dry-run` preview diff, actionable exit codes + remediation hints on stderr, shell completion scripts.
- **Libraries & SDKs:** Zero-dependency tree-shakeable entrypoints, TypeScript strict `.d.ts` inference tests, copy-pasteable runnable quickstarts verified by `night-docs`.
