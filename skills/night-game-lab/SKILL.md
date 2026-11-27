---
name: night-game-lab
description: Game feel, mechanics and headless balance loop. Adds coyote/buffer controls, hitstop/trauma juice, seeded runs, synergy pipelines or Monte Carlo sim bots. Use for "/night game".
metadata:
  aliases: "night-game-lab, night game, night game lab, overnight game lab"
  keywords: "night, loop, game, playtest, hitstop, roguelike, balance"
  composes: "build-feature, build-animation, add-interactions, test-everything, verify"
  requires: "git, shell"
  risk: "medium"
  night-loop: "game-lab, game"
  night-writes: "code"
  night-minutes: "35"
  night-signals: "game"
  night-keep: "no-regression"
---

# Night game lab

One iteration upgrades **one** measurable gameplay, control-feel ("juice"), progression/synergy, or
automated balance-testing system across web/Canvas/WebGL/Three.js/Phaser/Pixi, Godot, Python, Rust,
or C# games—using `build-feature`, `build-animation`, `add-interactions`, `test-everything` and
`verify`. Read `../night/references/loop-interface.md` and `workflows/game-feel-and-mechanics.md`.

## Activation

- Use on repositories with a game loop, physics/input controller, combat/deck/score engine, or
  interactive simulation (`game` signal, or via `/night game`).
- **Design & platform rules:**
  - Never overwrite movement physics or aesthetics the creator already tuned without preserving the
    original values as the default or a selectable feel preset.
  - Never commit AI-generated art/audio assets (Steam disclosure & brand risk); synthesize procedural
    math/code polish (springs, trauma shake, hitstop, shader flashes, WebAudio/engine pitch jitter).
  - Always gate screen shake and flashes behind an intensity factor (`0..1`) respecting reduced motion.

## Workflow

1. **Inspect core loop & stage (`workflows/game-feel-and-mechanics.md`):** Identify the highest-impact
   gap not yet tackled in the handoff:
   - **Control responsiveness:** coyote time (`80–120ms`), input buffering (`80–150ms`), variable
     jump-release gravity, frame-rate independent `dt` damping, gamepad + remappable keybinds.
   - **Impact & procedural juice:** hitstop freeze-frames (`3–6` frames on crits/kills), `trauma^2`
     decaying camera shake, 3-frame hit-flash, squash-and-stretch springs, `±8%` audio pitch jitter,
     cascading combo/score popups.
   - **Replayability & breakout indie systems:** deterministic seeded PRNG + shareable daily/challenge
     seed codes, ordered modifier/relic synergy pipeline (Balatro-style transparent additive ->
     multiplicative breakdown), run-summary stats card, or object pooling for zero-GC 60/120fps.
   - **24/7 Headless Monte Carlo playtest & balance harness:** extract pure simulation step from
     rendering so a fast unit test simulates 500–2,000 seeded runs across archetypes/waves, flagging
     dominant (>75% win), dead (<5% pick/win), infinite-loop, or soft-lock states—then tune outliers!
2. **Implement cleanly:** Keep simulation math pure and deterministic (`seed -> state -> nextState`) so
   headless tests can verify feel timers, RNG determinism, and balance bounds in milliseconds.
3. **Verify:** Run headless simulation/unit tests, `godot --headless --quit` / build / typecheck, and
   browser/canvas frame check (`verify`) when runnable locally.
4. **Hand back:** Emit `NIGHT_RESULT` with exact parameter changes, simulation win-rate/frame metrics,
   and the next game-lab hypothesis.

## Evaluation

- Keep: Deterministic tests/headless sim prove the mechanic, timer curve, seed reproducibility, or
  balance improvement; frame-time/build checks stay green; reduced-motion/shake toggle works.
- Revert: Frame-rate dependent math (`pos += 5` without `dt`), unseeded `Math.random()` breaking
  replayability, non-toggleable violent screen shake, soft-locks, or failing checks.
- Inconclusive: Engine binary/runtime required for the only configured check is missing.

## Stop conditions

- Control responsiveness, impact juice, seeded determinism, save safety, and headless balance tests
  are in place, or remaining changes are subjective narrative/art direction for the human creator.

## Examples

- Day: "run night-game-lab on combat feel and wave balance" adds hitstop, `trauma^2` camera impulse,
  and a 1,000-run wave survivability test.
- Night: `/night game` iterates through feel, juice, seeded runs, and Monte Carlo balance overnight.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
