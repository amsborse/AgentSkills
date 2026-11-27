# Production Readiness Hardening Matrix (Any Repo, Any Stage)

Score each applicable pillar from real `file:line` evidence before picking one bounded fix per iteration.

## 1. Stage Priorities

- **`seed` / `prototype`:** Startup config validation + `.env.example`, zero swallowed errors, clean README run steps, deterministic build/typecheck/smoke test.
- **`mvp`:** Outbound timeouts & bounded retries, webhook/mutation idempotency, structured redacted logging, React/UI error boundaries, save/state schema version tags.
- **`production`:** Multi-tenant context propagation (`tenant_id` + `request_id`), `SIGTERM` graceful drain (`/readyz` flips unhealthy -> HTTP drain -> worker drain -> DB close), tiered rate limiting (`429` + `Retry-After`), circuit breakers on third-party/LLM providers.

## 2. Pillar Checklist & Concrete Remedies

| Pillar | Common Defect Found in Repos | Bounded Overnight Remedy + Test |
| --- | --- | --- |
| **Config & Env** | `process.env.X!` scattered across 15 files; silent `undefined` at runtime; stale `.env.example`. | Centralize typed env parser with clear startup validation (skipped/defaulted cleanly in `NODE_ENV=test`) + sync `.env.example` keys. |
| **Outbound Calls** | Bare `fetch(url)` / `axios.get` / `requests.get` with infinite hang risk. | Wrap with `AbortSignal.timeout(ms)` / `timeout=(connect, read)` + bounded retry only on idempotent `502/503/504/429` respecting `Retry-After`. |
| **Idempotency & Webhooks** | JSON middleware parses Stripe/webhook body before signature check; duplicate delivery double-credits user. | Preserve raw bytes for `constructEvent` / HMAC timing-safe check; record `event_id` / `Idempotency-Key` before side effects and return cached `200` on replay. |
| **Graceful Shutdown** | Process exits immediately on `SIGTERM`, dropping active HTTP requests and corrupting jobs. | Add idempotent shutdown coordinator: mark readiness false -> stop accepting new connections -> await in-flight work up to deadline -> close pools. |
| **Observability & Privacy** | `console.log(req.body)` leaks passwords/tokens/API keys; errors lack correlation IDs. | Add structured logger redacting `authorization`, `cookie`, `password`, `token`, `secret`, `apiKey` and attaching `request_id`. |
| **Games / Local-First State** | Raw `JSON.parse(localStorage.save)` crashes the game after an update or partial write. | Add `version` envelope, pure `migrateSave(raw)` forward chain, checksum/schema fallback, and corrupt-save backup slot. |
