# Modern SaaS Craft Replication Playbook

Replicate proven UX and operational patterns from top B2B & micro-SaaS products, sized to a single
reviewable overnight commit (`< 350` lines) using the repository's existing stack and tokens.

## 1. Command Palette (`Cmd+K` / `Ctrl+K`) — *Linear / Raycast Standard*
- **Must have:** Global shortcut (`Meta+K` / `Ctrl+K`, ignoring inputs unless `Escape`), instant
  client-side fuzzy filter over routes + primary actions + theme toggle, arrow-key/Enter/Escape
  navigation, `aria-activedescendant` accessibility, and contextual actions for the currently viewed
  entity (e.g., copy deep link, export, status change).
- **Tests:** Shortcut open/close, fuzzy ranking order, keyboard arrow selection, action invocation.

## 2. Zero-Blank-Slate Sample Data & Empty States — *PostHog / Attio Standard*
- **Must have:** Replace dead "No items found" screens with a compact explanation, 1 primary CTA, and
  a clearly labeled **"Load sample workspace / Try with demo data"** toggle or deterministic local
  fixture loader (never mixing fake rows silently into real customer exports).
- **Tests:** Empty-state render, sample-data load + 1-click clean reset.

## 3. Export-First & Shareable Read-Only Diagnostics — *Micro-SaaS Standard*
- **Must have:** CSV (RFC 4180 formula-injection safe: prefix `=`, `+`, `-`, `@` cells!), formatted
  JSON, or copy-as-Markdown summary on primary data tables/reports.
- **Tests:** Formula-injection escaping (`=CMD()`), Unicode/comma/quote escaping, empty-table behavior.

## 4. Human-in-the-Loop (HITL) Review & Approve Queue — *Agentic SaaS Standard*
- **Must have:** Where automated jobs or AI generate outbound actions/drafts, present a clean
  `Pending Review` queue with compact diff/preview, `Approve`, `Reject`, and keyboard `j/k` + `a/r`
  triage, recording who approved and when.
- **Tests:** State transitions (`pending -> approved/rejected`), idempotent double-approve guard.

## 5. Transparent Usage Metering & Soft Spend Caps — *Vercel / Schematic Standard*
- **Must have:** Pure usage-pacing calculator (`current`, `included`, `projectedEndOfPeriod`,
  `pctUsed`, `softCapExceeded`) + clean tabular-numeral meter component with `80%` warning and `100%`
  limit states.
- **Tests:** Zero-quota, mid-cycle projection math, leap/month-end boundaries, soft-cap alert trigger.

## 6. Tenant-Scoped Audit Log Service & Filterable Table — *Enterprise Trust Standard*
- **Must have:** Structured event emitter (`actorId`, `tenantId`, `action`, `targetType`, `targetId`,
  `requestId`, `createdAt`, redacted `metadata`) + filterable read-only admin view by actor/action/date.
- **Tests:** Cross-tenant isolation (Tenant A never sees Tenant B audit entries), secret-key stripping.

## 7. AEO (`public/llms.txt` & JSON-LD) — *2026 Discovery Standard*
- **Must have:** Concise, accurate `/llms.txt` generated or verified from real routes/docs (product
  purpose, core capabilities, auth/API docs links, zero hallucinated endpoints) + valid Schema.org
  `SoftwareApplication` JSON-LD on public landing pages.
- **Tests:** Every linked route/doc in `llms.txt` exists in the repository; JSON-LD parses cleanly.
