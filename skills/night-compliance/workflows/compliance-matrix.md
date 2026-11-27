# Engineering Legal & Compliance Matrix (2026)

Translate regulatory and storefront rules into deterministic repository checks and code controls.
Never claim legal advice; surface counsel decisions via `NIGHT_RESULT.blocker` (`authorization`).

## 1. Open-Source, SPDX & Asset License Governance (All Repos)

- **Copyleft vs Commercial Compatibility:**
  - *Permissive (generally safe with attribution):* `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `0BSD`, `Unlicense`, `BlueOak-1.0.0`.
  - *Weak Copyleft (file/library boundary check required):* `MPL-2.0`, `LGPL-2.1`, `LGPL-3.0`, `EPL-2.0`.
  - *Strong Network/Copyleft or Non-Commercial (block/escalate in closed-source SaaS & games):* `AGPL-3.0*`, `GPL-2.0*`, `GPL-3.0*`, `SSPL-1.0`, `BUSL-1.1`, `Commons Clause`, `CC-BY-NC*`, `CC-BY-SA*` (for code), `UNKNOWN` / missing license.
- **Concrete Overnight Deliverables:**
  - Add a zero-dependency Node/Python/Rust test or CI check reading lockfile/installed package metadata to fail if a banned copyleft or `CC-BY-NC` dependency enters production dependencies.
  - Verify vendored files carry original license + `NOTICE` headers (`docs/SOURCES.md` standard) and game fonts/SFX/shaders have documented commercial redistribution rights.

## 2. Privacy, DSAR & Consent Controls — GDPR / CCPA / CPRA (`saas`, `frontend`, `backend`)

- **Pre-Consent & Global Privacy Control (`Sec-GPC: 1`):**
  - Analytics/marketing SDKs must stay inert until consent state is `'granted'`, and must automatically treat `req.headers['sec-gpc'] === '1'` or `navigator.globalPrivacyControl === true` as an opt-out of sale/sharing/cross-context tracking.
- **Right to Erasure & Data Portability (DSAR):**
  - `exportUserData(userId)`: deterministic JSON bundle of profile, workspace memberships, user-created entities, and consent timestamps—never leaking other tenants' IDs or internal password hashes.
  - `eraseUserData(userId)`: hard-delete or irreversibly anonymize PII across primary records, active sessions, API keys, search indexes, and background queues while preserving non-PII financial audit totals where required.
- **PII Minimization & Retention:**
  - Strip emails, phone numbers, street addresses, raw IPv4/IPv6, and session tokens from application logs and error-reporting breadcrumbs.

## 3. AI Act, Provenance & Storefront Rules (`ai`, `game`, `saas`)

- **EU AI Act Art. 50 Transparency:**
  - Expose clear UI disclosure when a user interacts with an AI agent/chatbot or views AI-synthesized text/media, and tag API payloads/exports with `provenance: { aiGenerated: true, model }` metadata.
  - Enforce dataset/source-guard checks so scraping/training/RAG pipelines respect robots/licensing/opt-out flags.
- **Game Storefront & Player Protection (`game`):**
  - **Steam / Console AI Disclosure:** Audit codebase for runtime LLM/image API calls vs pre-generated assets and document an accurate technical inventory in `docs/COMPLIANCE-INVENTORY.md` so storefront forms match reality.
  - **Randomized Loot / Gacha Odds Disclosure:** If loot boxes/packs exist alongside monetization, expose exact drop-rate percentages derived directly from the loot-table weights (tested so displayed odds always sum to `100%` and match runtime weights!).
  - **Age / Child Safety:** Ensure analytics/chat features can be cleanly disabled in kid-safe / offline modes.

## 4. SaaS Subscription & Accessibility Rules (`saas`, `frontend`)

- **FTC "Click-to-Cancel" / ROSCA Symmetry:**
  - Audit billing settings: if upgrade/subscribe is 2 clicks in-app, cancellation must be self-serve in-app in `<= 2–3` clicks (no "email support to cancel" traps when Stripe/billing portal or cancel API is present).
- **European Accessibility Act (EAA) / WCAG 2.1 AA Technical Baseline:**
  - Pair with `night-accessibility`: semantic form labels, keyboard operability, contrast `>= 4.5:1`, and working footer links for Privacy, Terms, Security, and Accessibility contact.
