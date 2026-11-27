# Local Chaos & Worst-Case Stress Matrix

Keep every chaos test fast (`< 200ms`) using fake timers, controllable deferred promises, and local
transport stubs—never real multi-second `sleep` waits.

## 1. Downstream & Streaming Faults (`backend`, `ai`, `saas`)
- **HTML Gateway Error on JSON Endpoint:** Upstream proxy returns `502 Bad Gateway` with `<html>...`
  and `content-type: text/html`; naive `await res.json()` throws an opaque `SyntaxError` hiding the
  HTTP status.
- **Truncated / Rate-Limited AI Stream:** Stream yields 2 chunks then errors or returns `429`; verify
  partial state rolls back or is marked incomplete, locks release, and token accounting stays honest.
- **Stuck Loading / Mutex Leak:** Exception thrown before `setLoading(false)` or lock release leaves
  UI or worker permanently wedged until page reload.

## 2. Async Ordering & Double-Dispatch (`frontend`, `saas`, `game`)
- **Stale Response Overwrite:** Request A (`query="re"`, slow 300ms) resolves *after* Request B
  (`query="react"`, fast 30ms) and overwrites the screen with stale results. Fix with `AbortController`
  or monotonic request sequence IDs.
- **Rapid Double-Submit:** Two clicks within `16ms` fire two POSTs before state re-renders; guard with
  synchronous in-flight ref / state lock.

## 3. Corrupt State & Time Boundaries (`frontend`, `backend`, `game`)
- **Corrupt Local Storage / Save File:** Inject `"{truncated"`, `"null"`, `"[]"`, or an older schema
  missing newly required nested keys; verify safe fallback without crashing boot.
- **Clock & Calendar Edges:** `new Date('2024-02-29T23:59:59Z')`, negative UTC offsets, `0ms` elapsed
  delta (`dt === 0` division-by-zero in FPS/rate math!), or huge `dt` (`30_000ms` after browser tab
  backgrounding causing physics tunneling—clamp `dt` to `<= 100ms`!).

## 4. Worst-Case Data Payloads (`frontend`, `backend`)
- **Strings:** `""`, `"A"`, 240-char unbroken URL/hash, `"O'Connor <script>alert(1)</script>"`, RTL
  `"مرحبا"`, CJK, ZWJ emoji `"👩‍🚀"`, combining diacritics.
- **Collections & Numbers:** `[]`, 1 item, `10,000` items (pagination/virtualization/O(n²) check),
  `0`, `-0`, `Number.MAX_SAFE_INTEGER`.
