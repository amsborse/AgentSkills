---
name: night-visual
description: Visual loop. Improve one evidenced interface issue, compare real screenshots in both themes and configured viewports, and retain the change only when visual review and runtime checks support it. Use for "night-visual", "night visual" or as /night visual.
metadata:
  aliases: "night-visual, night visual"
  keywords: "night, loop, visual"
  composes: "revamp-ui, verify, build-animation"
  requires: "git, shell"
  risk: "medium"
  night-loop: "visual"
  night-writes: "code"
  night-minutes: "30"
  night-signals: "frontend, playwright"
---

# Night visual

One iteration tackles one bounded hypothesis, using `revamp-ui`, `verify`, `build-animation`
for the craft. Read the shared contract in `../night/references/loop-interface.md`;
this skill supplies the target, evidence and stopping rules.

## Activation

- Use for a frontend with a runnable page and configured themes and viewports.
- Never replace a design the owner liked; add a selectable option instead.
- Read the handoff first and avoid repeating a target already resolved by earlier iterations.

## Workflow

1. **Baseline:** Use `verify` to capture real before screenshots in both themes at every configured viewport.
2. **Choose:** Ask the supervisor to store screenshots under `.night/artifacts`; do not write there yourself.
3. **One change:** Use `revamp-ui` to fix one visible issue; use `build-animation` only for purposeful calm motion.
4. **Check:** Capture matching after screenshots; check layout, readable text, interactions and reduced motion.
5. **Hand back:** run fast checks and report evidence, including failed or unavailable commands.
   The supervisor re-runs checks and decides keep/revert; never weaken tests or assertions.

## Evaluation

- Keep: All required screenshot pairs show the intended improvement and runtime checks stay green.
- Revert: A viewport or theme regresses, interactions break, or gimmick motion adds distraction.
- Inconclusive: missing evidence or unavailable checks cannot count as a successful iteration.
- Record baseline and candidate results with exact commands so the supervisor can repeat them.

## Stop conditions

- Missing screenshots make the result inconclusive; never keep on an unsupported visual claim.
- No evidenced visual issue remains, or the page cannot be rendered with the required settings.
- Stop at the supplied time or iteration limit; report the next bounded hypothesis.

## Examples

- Day: "run night-visual on the account page spacing" investigates one target with the owner watching.
- Night: `/night visual` repeats bounded iterations within the supplied budget, with each
  outcome independently evaluated by the supervisor.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
Report evidence rather than grading your own result. Include changed paths and reproducible checks.
