---
name: night-stock-intelligence
description: Overnight stock intelligence and Fable research loop. Runs bounded walk-forward experiments (news/Fable burst-decay remedies, 90% conformal uncertainty bands, selective abstention, paper-portfolio gating) on an isolated branch, keeps verified improvements, reverts regressions, and writes an easy-to-read morning evaluation report. Use for "night-stock-intelligence", "stock night loop", or as /night stock-intelligence.
metadata:
  aliases: "night-stock-intelligence, stock night loop, stock intelligence night loop, artha night loop"
  keywords: "night, loop, stock, artha, calibration, conformal, abstention, paper portfolio, news, fable"
  composes: "research, verify, improve"
  requires: "git, node, shell"
  risk: "medium"
  night-loop: "stock-intelligence"
  night-writes: "code"
  night-minutes: "40"
  night-signals: "node, has-tests"
  night-keep: "no-regression"
---

# Night stock intelligence

One iteration proposes and tests **one** bounded, strictly walk-forward Stock Intelligence or Fable improvement (deterministic point-in-time news features, burst-decay remedies, 90% conformal uncertainty calibration, selective abstention thresholds, or paper-portfolio diagnostics), verifies it with tests and `scripts/stock-intelligence-night.ts`, and records an easy-to-read evaluation summary. Read the shared contract in `../night/references/loop-interface.md`; this skill supplies the target, guardrails, evidence, and stopping rules.

## Activation

- Use on repositories with a Stock Intelligence / Artha + Fable pipeline (such as Sutra's `modules/artha/src/stocks/`, `scripts/stock-intelligence-night.ts`, and `scripts/stock-news-fable.ts`).
- Do **not** use for live brokerage execution, real-money trading, or bypassing dataset licence / `source-guard.ts` checks.
- **Hard invariants (never violate):**
  1. Never open the sealed 2025+ historical holdout.
  2. Never bypass `source-guard.ts` or claim predictive skill on synthetic fixtures or uncleared data.
  3. Never introduce look-ahead leakage (every calibrator, conformal quantile, and news feature for date `D` must use only information known strictly before `D`).
  4. Never weaken existing tests, assertions, or fail-closed abstention guards.

## Workflow

1. **Baseline & gap selection:** Read the handoff, recent morning reports, and `docs/stock-intelligence/fable/RESEARCH-REPORT.md`. Pick **one** highest-leverage hypothesis not yet tried or disproved, such as:
   - Closing Fable's #1 known error slice (burst-decay series where error is 3.6×–4.4× average at 20d) with deterministic point-in-time decay/recency features.
   - Tightening or adapting 90% conformal uncertainty bands (e.g., volatility-scaled or rolling-window conformal residuals so 90% coverage holds under regime shifts).
   - Improving deterministic point-in-time news-reading features (`events.ts` + `confidence-gate.ts`) to separate high-conviction catalysts from syndicated noise.
   - Improving paper-portfolio candidate gating, drawdown protection, or easy-to-read morning evaluation reporting (`stock-night-loop.ts`).
2. **One coherent change:** Implement the hypothesis cleanly in TypeScript inside `modules/artha/src/stocks/` (or Fable research modules) with Zod validation and zero LLM calls in backtested paths. Add focused unit tests proving both the improvement and zero look-ahead leakage.
3. **Evaluate honestly:**
   - Run targeted unit tests (`pnpm exec vitest run modules/artha/src/stocks/confidence-gate.test.ts modules/artha/src/stocks/stock-night-loop.test.ts` plus any touched test files).
   - Run `node scripts/stock-intelligence-night.ts --mode fixture --out .research/stock-night-eval` (or `--mode prospective --ledger <path>` if a prospective ledger exists) and inspect `morning-report.md`.
   - If GDELT is source-cleared locally, run `node scripts/stock-news-fable.ts status` / `next` to check Fable progress.
   - Run `pnpm typecheck` and ESLint on touched files.
4. **Plain-English evaluation report:** Summarize what was tried, what worked, what didn't, exact before/after metrics (90% conformal coverage, taken vs. baseline beat rate, mean excess, ECE, Fable error deltas), and what to try next—written so a human can scan it in 60 seconds in the morning.
5. **Hand back:** Clean up any temporary `.research/stock-night-eval` folder before finishing so the worktree stays clean, and emit `NIGHT_RESULT`.

## Evaluation

- **Keep:** All unit tests, typecheck, and lint pass; zero look-ahead or source-guard violations; measurable improvement in calibration/conformal stability, abstention precision/downside protection, Fable error reduction, or test coverage.
- **Revert:** Any failing test, typecheck/lint error, look-ahead leakage, weakened guard, or unsupported confidence claim.
- **Honest labeling:** Always label fixture runs as `SYNTHETIC FIXTURE (machinery verification)` and real prospective runs as `PROSPECTIVE / CLEARED`. Never claim 90% directional win rate on equities.

## Stop conditions

- Time or iteration budget is reached.
- No further defensible, non-redundant hypotheses remain without newly cleared real-market data.
- Source-guard blocks all remaining real-data steps (record the exact blocker and stop cleanly).

## Examples

- Day: `node scripts/stock-intelligence-night.ts --mode fixture --out .research/stock-night` to inspect 90% conformal bands, selective abstention, and the morning report.
- Night (8h with Claude Opus): `node ~/agent-skills/skills/night/scripts/night.mjs run stock-intelligence --agent claude --hours 8 --detach`

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
Report evidence rather than grading your own result. Include a concise, scannable "What worked / What didn't / Next" summary in `summary` and `next_hypothesis`.
