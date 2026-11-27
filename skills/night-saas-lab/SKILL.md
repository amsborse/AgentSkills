---
name: night-saas-lab
description: SaaS craft loop. Ships one tested Linear/PostHog-bar slice: Cmd+K, sample onboarding, usage meters, audit logs or HITL queues. Use for "/night saas".
metadata:
  aliases: "night-saas-lab, night saas, night saas lab, overnight saas lab"
  keywords: "night, loop, saas, onboarding, metering, auditlog"
  composes: "build-feature, build-ui, revamp-ui, test-everything, verify"
  requires: "git, shell"
  risk: "medium"
  night-loop: "saas-lab, saas"
  night-writes: "code"
  night-minutes: "35"
  night-signals: "saas"
  night-keep: "tests-up"
---

# Night SaaS lab

One iteration designs, implements, and tests **one** self-contained, high-craft SaaS product slice
modeled on modern B2B and micro-SaaS leaders (Linear, Raycast, Vercel, PostHog, Stripe, Resend)—using
`build-feature`, `build-ui`, `revamp-ui`, `test-everything` and `verify`. Read
`../night/references/loop-interface.md` and `workflows/saas-replication-playbook.md`.

## Activation

- Use on web/SaaS repositories (`saas` signal, or when invoked explicitly via `/night saas`).
- **Scope & safety rules:**
  - Never alter database migrations (`protected_paths`), live Stripe/billing plans, or external APIs;
    build against existing tables/stores or clean repository-pattern adapters with deterministic tests.
  - Never overwrite a UI layout the owner already crafted; integrate additively (keyboard shortcut,
    settings tab, drawer, empty-state action, or feature-flagged toggle).

## Workflow

1. **Select one highest-fit SaaS slice (`workflows/saas-replication-playbook.md`):** Match the repo's
   current stage and gaps, skipping anything already present or tried in the handoff:
   - `seed` / `prototype`: **Zero-Blank-Slate Sample Data Mode** (1-click realistic demo dataset) or
     **Intent-Based Onboarding Checklist** (progressive setup bar that disappears when done).
   - `mvp`: **Global `Cmd+K` / `Ctrl+K` Command Palette** (sub-50ms fuzzy navigation + contextual item
     actions), **Export-First Utilities** (clean CSV/JSON/Markdown export with proper escaping), or
     **Optimistic Action Feedback** (instant state transition with clean rollback on error).
   - `production`: **Tenant-Scoped Audit Log Viewer** (structured `actor/action/target/timestamp`
     service + filterable UI), **Transparent Usage Metering & Soft Spend-Cap Bar**, **HITL Review &
     Approve Queue** for automated/AI drafts, **Scoped Masked API Keys UI**, or **AEO `llms.txt` +
     JSON-LD metadata**.
2. **Design to the UI taste bar:** Follow `~/agent-skills/working-agreements/ui-quality.md`—works in
   both warm light mode and deep layered dark mode, single surgical accent, compact cards, keyboard
   accessible, `prefers-reduced-motion` respected, zero placeholder/fake marketing claims.
3. **Implement end-to-end slice + tests:** Keep the diff reviewable (`< 350` lines). Add focused unit
   and component/integration tests covering happy path, keyboard/authz behavior, and edge cases.
4. **Verify:** Run `test-everything` and `verify` (rendering in browser/Playwright when available).
5. **Hand back:** Emit `NIGHT_RESULT` with changed files, test counts added, and next SaaS slice.

## Evaluation

- Keep: Slice works end-to-end through real production paths, passed-test count rises (`tests-up`),
  typecheck/lint/build stay green, and UI matches the repository's design tokens in both themes.
- Revert: Dead/unwired UI stubs, broken light/dark contrast, schema migration edits, or failing checks.
- Inconclusive: Missing test runner prevents proving `tests-up`.

## Stop conditions

- High-value SaaS craft slices applicable to this product's domain are implemented, or remaining slices
  require database schema migrations or owner product/pricing decisions (queue via `NIGHT_RESULT.blocker`
  or report).

## Examples

- Day: "run night-saas-lab to add a Cmd+K command palette" ships fuzzy route + contextual actions with
  keyboard tests.
- Night: `/night saas` layers verified product-craft slices onto the run branch overnight.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
