---
name: night-readiness
description: Production-readiness loop. Hardens one operational gap per iteration—env validation, timeouts, idempotency, healthz, graceful shutdown or logging. Use for "/night readiness".
metadata:
  aliases: "night-readiness, night readiness, night production, overnight production readiness"
  keywords: "night, loop, readiness, observability, idempotency, shutdown, resilience"
  composes: "production-ready, security-audit, test-everything, improve, verify"
  requires: "git, shell"
  risk: "medium"
  night-loop: "readiness"
  night-writes: "code"
  night-minutes: "30"
  night-signals: "backend, frontend, saas, ai, docker, ci"
  night-keep: "no-regression"
---

# Night readiness

One iteration closes **one** concrete gap between "works on a developer machine" and "survives real
users and traffic"—using `production-ready`, `security-audit`, `test-everything`, `improve` and
`verify`, guided by `workflows/readiness-matrix.md`. Shared contract:
`../night/references/loop-interface.md`.

## Activation

- Use on any web app, SaaS backend, API, AI service, game, CLI, or library preparing for real users.
- Respect `protected_paths`: never edit `.env` secrets, live `Dockerfile`/infra/migrations, or deploy
  configs unless explicitly unprotected; harden application-layer guards, `.env.example`, health
  routes, timeouts, idempotency, and tests instead.
- Read the handoff first and skip gaps already hardened or marked blocked.

## Workflow

1. **Audit by stage (`workflows/readiness-matrix.md`):** Score readiness pillars (`ready / gap / unknown`)
   with `file:line` evidence, ordered by blast radius:
   1. **Config & secret hygiene:** startup schema validation for required env vars with clear error
      messages, `.env.example` parity, zero hardcoded localhost/prod URLs or leaked tokens in logs.
   2. **Error boundaries & swallowed failures:** replace empty `catch {}` blocks, add structured UI/API
      error boundaries, and ensure unhandled rejections/panics log context safely.
   3. **Timeouts, bounded retries & rate limits:** add explicit `AbortSignal.timeout` / socket deadlines
      on outbound HTTP/DB/LLM calls, bounded jittered retries on transient errors only, and `429` +
      `Retry-After` guards on public write routes.
   4. **Idempotency & webhook safety:** enforce raw-body signature verification and unique event/key
      deduplication before mutating billing, entitlements, emails, or queued jobs.
   5. **Health, graceful shutdown & observability:** `/healthz` + `/readyz` checks, `SIGTERM`/`SIGINT`
      in-flight drain order, structured logs with `request_id`/`tenant_id` and automatic secret redaction,
      and forward-compatible save/state schema versioning.
2. **One bounded hardening change:** Fix the single highest-priority gap in existing abstractions
   without adding heavy new dependencies.
3. **Prove with a test:** Add a deterministic unit/integration test exercising the failure or operational
   path (missing env var, duplicate webhook event ID, outbound timeout, `SIGTERM` drain, secret redaction).
4. **Verify:** Run `test-everything` and `verify` against local fixtures.
5. **Hand back:** Emit `NIGHT_RESULT` naming the gap closed, test added, and next readiness gap.

## Evaluation

- Keep: Target operational gap is closed with code + test proof, zero secrets or protected paths are
  touched, and all baseline checks pass.
- Revert: Startup breaks under valid test configs, checks regress, errors are hidden instead of
  handled, or external services are contacted.
- Inconclusive: No evaluation command is available to verify the runtime change.

## Stop conditions

- All application-layer readiness pillars in `workflows/readiness-matrix.md` score `ready` (remaining
  infra/migration items recorded once as owner decisions).
- Time or iteration budget is reached.

## Examples

- Day: "run night-readiness on webhook and outbound API handlers" adds signature/idempotency and
  timeout guards with tests.
- Night: `/night readiness` or `/night production` systematically hardens gaps overnight.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
