# Reliability

Make failures visible, bounded and recoverable.

## What to look for

- **Error handling:** swallowed exceptions (`catch {}` without a reason), errors converted to
  success values, missing user-facing error states, error messages that hide the cause.
- **Timeouts:** every network call, subprocess and model call has one, sized to the operation.
  Look for `fetch` without `AbortSignal.timeout`, HTTP clients without timeouts, unbounded waits.
- **Retries:** only for idempotent operations, with capped attempts, exponential backoff and
  jitter; never retry validation errors; never retry inside another retry loop.
- **Recovery:** work that is lost on restart, jobs stuck in "running" after a crash, missing
  reconciliation of in-flight state, non-atomic file writes of state.
- **Idempotency:** duplicate submissions/emails/charges on retry; missing idempotency keys.
- **Resource bounds:** unbounded queues, caches, logs, temp files and disk growth.
- **Observability:** one structured, non-sensitive log line or metric at each failure point that
  would let the next person verify the failure and the fix.

## Proving it

Reliability fixes need a test that reproduces the failure mode: a fake that times out, throws
once, returns malformed data, or crashes mid-operation. Accept with `--evidence` naming that
test. A reliability change with no failing-before test is speculative.

## Scope

Fix the seam you can prove. If the same defect pattern exists in many callers, fix the shared
helper once rather than patching each call site, and list remaining call sites in the PR.
