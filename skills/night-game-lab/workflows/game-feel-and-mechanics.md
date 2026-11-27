# Game Feel ("Juice"), Breakout Mechanics & Headless Balance Playbook

Concrete formulas and testable patterns for indie, web, mobile, and desktop games.

## 1. Control Responsiveness Math (Pure, Frame-Rate Independent)

- **Coyote Time (`80–120ms`):** Track `groundedGraceMs`: reset to `COYOTE_MS` while grounded, subtract
  `dtMs` while airborne; allow jump when `groundedGraceMs > 0` and immediately zero `groundedGraceMs`
  on jump so double-jumps cannot fire accidentally.
- **Input Buffering (`80–150ms`):** Track `jumpBufferMs` / `actionBufferMs`: set on keydown, subtract
  `dtMs` each tick; trigger the instant `canExecute()` becomes true within the window.
- **Frame-Rate Independent Smoothing:** Never write `cam += (target - cam) * 0.1` (breaks at 120Hz vs
  30Hz!). Always use exponential decay:
  `const alpha = 1 - Math.exp(-sharpness * dtSeconds); cam += (target - cam) * alpha;`

## 2. Procedural Impact & "Juice" Stack

- **Hitstop / Freeze-Frames (`30–70ms`):** Maintain `hitstopRemainingMs`; while `> 0`, pause world
  physics/combat `dt` while keeping camera shake, hit-flash, and UI particles ticking!
- **Camera Trauma (`trauma in [0, 1]`):**
  - On impact: `trauma = Math.min(1, trauma + impactWeight);`
  - Per tick: `const shake = (trauma * trauma) * userShakeScale;` (`trauma^2` keeps small hits crisp
    and big hits dramatic), decay `trauma = Math.max(0, trauma - decayPerSec * dtSeconds)`.
  - Offset camera angle (`maxAngle * shake * noise(t)`) and translation (`maxOffset * shake * noise(t+100)`),
    never mutating the logical camera origin.
- **Audio Anti-Fatigue:** Multiply playback rate / pitch by `1 + (rng() * 2 - 1) * 0.08` (`±8%`) and
  gain by `0.94..1.0` on repeated footsteps, pickups, gunfire, and hits.

## 3. Replicable 2025–2026 Indie Systems

- **Seeded PRNG (`mulberry32` / `sfc32` / engine `RandomNumberGenerator`):** Thread an explicit seed
  through loot, map, shop, and enemy spawns so players can share a 6-character seed code (`DAILY-20261126`
  or `7K9X2M`) and automated tests reproduce exact edge-case bugs in 1ms.
- **Composable Modifier / Relic Pipeline ("Balatro Math"):** Represent upgrades as pure ordered stages
  (`base -> flatBonus -> multBonus -> xMultCascade -> postTrigger`) returning an event trace so UI
  tooltips and cascading score popups show *why* a combo popped off.
- **Object Pooling:** Reuse projectile, particle, and damage-number instances from fixed free-lists
  instead of allocating/GC-churning hundreds of objects per second during bullet-heaven waves.

## 4. Headless Monte Carlo Balance Bots

- Decouple `stepSimulation(state, action, dt)` from DOM/Canvas/audio calls.
- Write a fast test (`< 2s` for 500–1,000 seeded runs) using simple heuristic bots (`greedy-dps`,
  `defensive`, `synergy-seeker`, `random-valid-input`) to verify:
  1. **Zero soft-locks / NaN / infinite loops** within `maxTicks`.
  2. **Win-rate / survival curve bounds:** e.g., Wave 1 clears `> 85%` with competent play, no single
     starter item exceeds `75%` win share or drops below `10%` utility.
