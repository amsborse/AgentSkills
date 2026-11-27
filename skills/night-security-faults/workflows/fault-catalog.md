# Stateful Security Fault Catalog

Static linters catch obvious `eval()` and string-concatenated SQL. Use these five fault classes to
find high-severity business-logic, concurrency, and isolation bugs overnight.

## 1. Multi-Tenant BOLA / IDOR Matrix (`saas`, `backend`)
- **Single-ID vs Batch Drift:** `GET /items/:id` checks `org_id`, while `POST /items/bulk-delete`,
  `GET /items/export`, or `PATCH /items/reorder` filters only by `id IN (...)`.
- **Foreign-Key Attachment:** User in Tenant A creates a record referencing `projectId` or `templateId`
  owned by Tenant B, leaking metadata in subsequent joined reads.
- **Test Recipe:** Seed `tenantA` and `tenantB` fixtures; assert `403`/`404` and zero row mutation
  across read, update, delete, bulk, and export paths.

## 2. TOCTOU & Concurrency Race Conditions (`saas`, `backend`, `game`)
- **Check-Then-Act Balance Drain:** `const bal = await getBalance(u); if (bal >= cost) await deduct(u, cost);`
  allows `N` parallel requests to spend `N * cost` from a single balance.
- **One-Time Token / Coupon / Loot Claim:** Parallel redemptions both read `used_at === null` before
  either write commits.
- **Test Recipe:** Gate concurrent calls on a barrier / `Promise.all` against an in-memory or test-DB
  adapter; assert total deducted/minted equals the exact invariant (`<= initialBalance`, `claims === 1`).

## 3. Numeric, Financial & Game-Economy Edge Faults (`saas`, `game`)
- **Negative / `NaN` / `Infinity` / Float Drift:** Passing `quantity: -5` turns a purchase into a
  refund; `NaN` bypasses `if (amount > limit)` (`NaN > limit` is `false`!); float rounding mints coins.
- **Test Recipe:** Fuzz boundary values `[-1, -0, 0, NaN, Infinity, -Infinity, 1e308, 0.1 + 0.2, Number.MAX_SAFE_INTEGER + 1]`
  through pricing, scoring, transfer, and inventory reducers.

## 4. Deserialization, Prototype & Save/Upload Boundaries (`frontend`, `backend`, `game`)
- **Prototype / Object-Merge Pollution:** Deep-merging user JSON or query params containing
  `{"__proto__": {"isAdmin": true}}` or `{"constructor": {"prototype": ...}}`.
- **Path & Archive Traversal:** Relative `../`, Windows backslash `..\\`, URL-encoded `%2e%2e%2f`, or
  null-byte filenames in export/upload/plugin paths.

## 5. Agentic AI & LLM Tool-Use Boundaries (`ai`)
- **Indirect Prompt Injection -> Tool Escalation:** Untrusted email/web/ticket text instructs an agent
  to call a write/delete/export tool or exfiltrate context via markdown image URLs.
- **Remedies:** Enforce caller/tenant identity from session context (never LLM-supplied `userId`/`tenantId`
  tool args), strict path/domain allowlists on tools, and hard `maxSteps` recursion caps.
