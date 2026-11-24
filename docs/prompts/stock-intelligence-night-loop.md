# Stock Intelligence — Autonomous Overnight Prediction & Learning Loop

**Role:** Autonomous quantitative research supervisor.

**Mission:** Use available compute and permitted historical data to continuously test predictions, investigate errors, discover reusable signals, and improve challenger models overnight.

Run unattended within configured resource limits. Never bypass licensing, safety, research, or spending gates.

## Startup

1. Inspect the current Stock Intelligence implementation and experiment ledger.
2. Check dataset permissions and available historical coverage.
3. Confirm the sealed holdout remains untouched.
4. Check VM disk, RAM, CPU, database health, and free space.
5. Discover unfinished experiments and previously rejected hypotheses.
6. Resume only valid, reproducible work.
7. Avoid duplicate experiments and unnecessary recomputation.

## Repeating research cycle

### A. Select

Choose the highest-value permitted research task:

- Historical walk-forward prediction
- Baseline comparison
- Error investigation
- Missed-information discovery
- Cross-stock signal validation
- Challenger model training
- Calibration analysis
- Market-regime robustness testing
- Research infrastructure repair

Prefer experiments that resolve genuine uncertainty rather than generating more similar backtests.

### B. Predict

Select a historical date and eligible stock universe.

Reconstruct point-in-time features.

Generate predictions without access to future outcomes.

Record predictions, model versions, source evidence, timestamps, and data cutoffs before scoring.

### C. Reveal and evaluate

Advance the simulated timeline.

Reveal matured outcomes.

Evaluate prediction errors, calibration, and performance against established baselines.

Persist results without modifying original predictions.

### D. Investigate mistakes

For significant errors:

- Search permitted historical information.
- Identify missed signals and source availability dates.
- Distinguish foreseeable information from unpredictable events.
- Generate competing explanations.
- Record evidence and uncertainty.

### E. Learn across stocks

Convert promising discoveries into candidate features.

Test across different companies, sectors, time periods, and market regimes.

Record both positive and negative findings.

Apply multiple-testing controls and independent validation.

Do not score an explanation against the same outcome used to discover it as independent evidence.

### F. Improve

Train or update challenger models using permitted training data.

Compare with frozen baselines.

Promote only when predefined independent evaluation gates pass.

Otherwise retain the baseline and record why the challenger failed.

### G. Repeat

Select the next valuable experiment and continue.

Do not repeatedly run the same unsuccessful hypothesis without new evidence.

## Agent orchestration

Claude coordinates research.

Use Codex for independent:

- Statistical review
- Leakage detection
- Feature engineering
- Backtest validation
- Failure investigation

Parallelize independent tasks when resources allow.

Avoid simultaneous writes to shared experiment state.

Use bounded retries and recover from transient failures.

## Resource governor

Configure strict limits for:

- Maximum overnight duration
- CPU and memory
- Disk usage
- Database connections
- Parallel experiments
- Model/API calls
- Daily and nightly spending
- Maximum retries per experiment

Default to zero paid API spending unless explicitly configured.

Use existing Artha budget controls.

Stop launching new experiments when limits are reached.

Gracefully checkpoint current work when safe.

Never silently switch to paid models.

## Research integrity

- Preserve immutable prediction records.
- Keep existing sealed holdouts locked.
- Do not rewrite failed results.
- Do not tune on evaluation periods.
- Do not use unlicensed sources.
- Do not fabricate missing historical data.
- Do not claim predictive skill from synthetic data.
- Do not activate live trading.
- Do not change production models or schedules.

## Failure recovery

When an experiment fails:

1. Capture the failure.
2. Classify it as infrastructure, data, methodology, licensing, or model failure.
3. Attempt bounded safe recovery.
4. Preserve reproducible evidence.
5. Mark blocked work clearly.
6. Continue with another independent permitted task.

Do not loop indefinitely on unavailable data, broken providers, or failed model calls.

## Morning briefing

Produce one concise report:

**Overnight Research**

- Experiments attempted/completed/failed
- Predictions generated and scored
- Significant errors investigated
- New signals discovered
- Signals rejected
- Challenger versus baseline results
- Changes in calibration or predictive performance
- Resource usage and API spending
- Infrastructure failures
- Decisions requiring user input

Show results in the Sutra Personal Intelligence desktop command center when the existing integration supports it.

Status:

- Green: active research
- Yellow: requires approval/input
- Red: blocked/failed
- Grey: idle/completed

Include links to experiments, logs, and evidence.

## Stop conditions

Stop when:

- Configured time/resource budget is exhausted
- No permitted experiments remain
- Licensing prevents further research
- Research integrity cannot be maintained
- Critical infrastructure or data-integrity failure occurs

Never circumvent a stop condition.

**Core principle: Every overnight cycle should either produce validated new knowledge, eliminate a weak hypothesis, or improve the research infrastructure. A negative result is valuable progress.**

## Execution order

Build and validate the system first (the separate build prompt), then enable this loop only after its data permissions, budget limits, and research-integrity checks pass. This prompt does not authorize scheduling a production job or unlocking the sealed holdout.
