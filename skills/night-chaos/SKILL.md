---
name: night-chaos
description: Chaos stress loop. Injects local timeouts, 500s, corrupt saves, async races or worst-case UI data and fixes crashes with tests. Use for "/night chaos".
metadata:
  aliases: "night-chaos, night chaos, night resilience, overnight chaos loop"
  keywords: "night, loop, chaos, stress, resilience, degradation"
  composes: "test-everything, fix-bug, verify"
  requires: "git, shell"
  risk: "medium"
  night-loop: "chaos, resilience"
  night-writes: "code"
  night-minutes: "25"
  night-signals: "has-tests, backend, frontend, game"
  night-keep: "tests-up"
---

# Night chaos

One iteration injects **one** realistic local fault or worst-case data payload—downstream `500`/`429`/timeout,
truncated JSON, corrupt `localStorage`/save state, out-of-order async responses, rapid double-submits,
or adversarial UI strings/counts—catches the crash or silent corruption with a failing test, and
repairs graceful degradation using `test-everything`, `fix-bug` and `verify`. Read
`../night/references/loop-interface.md` and `workflows/chaos-matrix.md`.

## Activation

- Use on any codebase with async I/O, state persistence, parsers, game loops, or UI components.
- **Local-only rule:** inject faults strictly through dependency injection, mock transports, fake
  timers, or test fixtures—never stress-test external APIs or production endpoints.

## Workflow

1. **Select one fault vector (`workflows/chaos-matrix.md`):** Pick a high-impact path not yet covered
   in the handoff:
   - **Network & provider chaos:** HTTP `500`/`502`/`429`, hanging socket timeout, malformed/HTML
     error body where JSON was expected, mid-stream SSE/LLM chunk drop.
   - **Async race & double-action chaos:** rapid double-click on submit/purchase, stale slow search/tab
     response overwriting a newer fast response (`AbortController` / request-seq missing).
   - **Corrupt persistence & clock chaos:** truncated/invalid `localStorage`, IndexedDB, cache or game
     save blob; DST/leap-day/timezone boundary (`23:59:59.999Z`); empty/missing optional fields.
   - **Worst-case UI & collection stress:** `0` items, `10,000` items, 240-char unbroken email/URL,
     1-char name, RTL Arabic/Hebrew, CJK, multi-codepoint emoji (`👨‍👩‍👧‍👦`), `0` vs `999,999,999`.
2. **Reproduce with a deterministic test:** Write a focused test injecting the fault. Confirm what
   breaks (unhandled exception, stuck `isLoading = true` spinner, stale state overwrite, layout clip,
   corrupted state). If the target already degrades cleanly and lacked test proof, keep the crisp
   resilience test only when it guards a genuinely critical path.
3. **Repair graceful degradation:** Reset loading/lock flags in `finally`, cancel stale requests,
   validate/fallback corrupt storage safely, truncate/wrap long tokens cleanly, and surface honest
   user-visible error states.
4. **Verify:** Run the new chaos test and full suite (`test-everything`).
5. **Hand back:** Emit `NIGHT_RESULT` describing the injected fault, failure mode prevented, and next
   chaos vector.

## Evaluation

- Keep: Passed-test count rises (`tests-up`), the injected fault degrades cleanly without uncaught
  errors, stuck spinners or silent data loss, and all baseline checks stay green.
- Revert: Errors are swallowed silently instead of surfaced honestly, real timeouts slow the test
  suite (use fake timers / short injected timeouts!), or assertions weaken.
- Inconclusive: No test runner available.

## Stop conditions

- Critical I/O, persistence, async UI, and boundary-data paths survive injected faults cleanly, or
  time/iteration budget ends.

## Examples

- Day: "run night-chaos on checkout and search state" catches a stale-response overwrite and stuck
  submit button under 502 responses.
- Night: `/night chaos` or `/night hardening` stress-tests failure modes overnight.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
