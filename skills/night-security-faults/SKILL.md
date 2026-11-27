---
name: night-security-faults
description: Stateful security fault-finding loop. Proves multi-tenant IDOR, TOCTOU races, webhook replay, parser fuzzing or AI boundary escapes with local tests. Use for "/night security-faults".
metadata:
  aliases: "night-security-faults, night security faults, night faults, overnight security faults"
  keywords: "night, loop, faults, idor, toctou, fuzzing, tenant"
  composes: "security-audit, fix-bug, test-everything"
  requires: "git, shell"
  risk: "high"
  night-loop: "security-faults, faults, security"
  night-writes: "code"
  night-minutes: "30"
  night-signals: "backend, saas, ai, frontend, game"
  night-keep: "tests-up"
---

# Night security faults

One iteration hunts **one** stateful, concurrency, authorization-matrix, deserialization, or AI
boundary security fault that static scanners miss—proves it strictly locally with a failing test, and
repairs the underlying invariant using `security-audit`, `fix-bug` and `test-everything`. Read
`../night/references/loop-interface.md` and `workflows/fault-catalog.md`.

## Activation

- Use on repositories with auth/tenants, financial/credit/score state, webhooks, parsers, file/save
  loaders, multiplayer messages, or LLM tool-calling (`backend`, `saas`, `ai`, `frontend`, `game`).
- **Safety boundary:** never probe external networks, live endpoints, or real credentials. Every
  exploit proof is a deterministic local test using inert payloads and in-process/fake adapters.

## Workflow

1. **Map trust & state seams (`workflows/fault-catalog.md`):** Trace state transitions and ownership
   checks beyond surface input validation:
   - **Cross-tenant BOLA / IDOR:** Tenant A session accessing/mutating/exporting Tenant B object IDs,
     batch endpoints, nested relation filters, or background export jobs.
   - **TOCTOU & concurrency races:** parallel requests (`Promise.all` / worker threads) redeeming the
     same coupon/invite, deducting credits/inventory below zero, or double-claiming jobs.
   - **Replay & state-machine bypass:** forged/replayed webhook timestamps, skipped workflow states
     (e.g., `draft -> paid` without settlement), alg/claim confusion, stale session revocation.
   - **Parser, numeric & save/packet fuzzing:** `__proto__`/`constructor` pollution, `NaN`/`Infinity`/negative
     quantities or prices, Zip-slip/path traversal, malformed save/packet blobs.
   - **AI / MCP / agentic boundary faults:** untrusted document/prompt data steering tool arguments,
     path/URL escape in tool handlers, or unbounded recursive tool loops.
2. **Prove with a failing local fault test:** Write a clean regression test exercising the real
   handler/service/reducer. Run it first to confirm the fault is genuinely reachable (if the code
   already blocks it cleanly, either keep the high-value invariant test if uncovered or move to the
   next candidate).
3. **Fix the invariant:** Enforce tenant scoping at the query/repository layer, atomic compare-and-swap
   or transaction locks for balances/claims, strict numeric/schema bounds, or tool-argument allowlists.
4. **Verify:** Confirm the fault test now passes alongside legitimate access/concurrency tests.
5. **Hand back:** Emit `NIGHT_RESULT` without printing any secret values.

## Evaluation

- Keep: Passed-test count rises (`tests-up`), the fault scenario is deterministically denied/contained,
  legitimate multi-user/concurrent operations pass, and no existing assertions weaken.
- Revert: Fix breaks valid flows, relies on flaky `setTimeout` sleeps instead of deterministic
  barriers, or touches protected infrastructure/migration files.
- Inconclusive: Harness cannot instantiate the target module locally without external services.

## Stop conditions

- Reachable authorization, concurrency, replay, parser, and AI tool boundaries are covered by fault
  tests, or remaining findings require schema/infrastructure migrations (record as owner decisions).

## Examples

- Day: "run night-security-faults on credit deduction and workspace invites" proves and fixes a
  parallel double-spend race.
- Night: `/night security-faults` or `/night security` systematically red-teams stateful seams.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
