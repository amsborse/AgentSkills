# Future skills

Ideas for skills that could be sold, not yet built. Each one packages work this catalog already
does, so the first version is mostly productising, not new research. Ordered by recommendation.
Prices are starting guesses to test, not research.

Each entry covers who buys it, what it does, which existing skills it builds on, the smallest
version worth shipping, and the risks.

## 1. Visual PR receipts (recommended)

**Pitch:** every pull request gets real before/after screenshots, a pixel diff and a
plain-English note on what changed and what could break.

- **Buyer:** small product teams with no full-time designer or QA; agencies that show changes to
  clients.
- **Builds on:** `review-changes`, `verify`, `audit-design`.
- **First version:** a GitHub Action that starts the app's preview, shoots both themes at
  desktop and mobile width, and posts one PR comment with the side-by-side images and the
  change cards.
- **Why it sells:** visual testing tools exist, but they flag pixels without explaining them.
  The plain-English cards and the confidence level backed by evidence are the difference.
- **Price idea:** free for public repos; a monthly fee per private repo.
- **Risks:** apps that are hard to start in CI; screenshot flakiness from animations and live
  data (freeze time, seed fixtures, respect reduced motion).

## 2. Ship-safe audit for apps built with AI (recommended)

**Pitch:** "You built it with AI. Is it safe to launch?" A plain-English readiness score, the
five most dangerous gaps, and the fixes.

- **Buyer:** solo founders and makers who built an app with AI coding tools and are nervous
  about launch.
- **Builds on:** `production-ready`, `security-audit`, `test-everything`.
- **First version:** a read-only scan that returns a one-page report (secrets, auth, exposed
  data, missing error handling, backups), each finding with a concrete exploit or failure
  scenario; a second paid run applies the top fixes on a branch.
- **Why it sells:** the fear is sharp and the buyer cannot judge the code themselves.
- **Price idea:** a single price per audit; a higher one for audit plus fixes.
- **Risks:** a false sense of safety. The report must say plainly what was not checked.

## 3. Night shift for repositories

**Pitch:** a junior engineer that works nights. One evidence-backed draft PR every morning,
never merged on its own.

- **Buyer:** small teams with a backlog of chores (tests, dependencies, docs, small bugs).
- **Builds on:** `night` and the `night-*` loops, `nightly-evolution`, `run-autonomous`.
- **First version:** a hosted or self-hosted runner for one repo with three loops (tests,
  dependencies, bugs) and the morning report.
- **Why it sells:** the trust features already exist: changes that do not verify are reverted,
  it never pushes to main, and the report shows evidence for every change.
- **Price idea:** monthly per repo, plus the buyer's own model usage.
- **Risks:** model cost per night; noisy PRs. Cap iterations and drop PRs that are too small to
  be worth reviewing.

## 4. Taste clone

**Pitch:** your AI finally knows how you work. It reads your past agent conversations and
writes your personal working agreements.

- **Buyer:** heavy users of Claude Code, Codex, Cursor and similar tools.
- **Builds on:** `history-learning`, `working-agreements`, `manage-skills`.
- **First version:** a local CLI that asks consent per source, redacts before any model sees the
  text, and outputs an `AGENTS.md` with evidence counts per rule, in the style of
  `working-agreements/evidence.md`.
- **Why it sells:** easy to share ("look what it learned about me"); the evidence-backed rules
  are more convincing than a hand-written prompt.
- **Price idea:** a one-off purchase; a cheap yearly refresh.
- **Risks:** privacy. It must run locally, redact by default and never upload history.

## 5. Brand in a box

**Pitch:** one logo or one reference image in; a complete design system out, including a
signature living visual, in both light and dark mode.

- **Buyer:** indie founders, small agencies, hackathon teams.
- **Builds on:** `create-visuals`, `build-animation`, `revamp-ui`, `shared/creative/`.
- **First version:** colour, type and spacing tokens, five core components, the hero visual and a
  sample page, delivered as files for the buyer's stack.
- **Why it sells:** the UI taste rules ("premium comes from control, not volume") are the
  difference from generic theme generators.
- **Price idea:** price per brand.
- **Risks:** quality varies by input. Verify with screenshots in both themes before delivery.

## 6. Replicate a feel

**Pitch:** paste a site you love; get its motion and feel in your own brand, without copying its
assets.

- **Buyer:** marketers and landing-page builders.
- **Builds on:** `replicate-design`, `build-animation`, `add-interactions`.
- **First version:** capture the reference, map each effect to a technique, rebuild it in the
  buyer's stack, and show a side-by-side comparison.
- **Price idea:** price per page.
- **Risks:** legal and ethical lines. Keep the existing rule of never copying protected assets,
  and say so in the product.

## 7. Usage and cost coach for Claude Code

**Pitch:** know before you hit the limit. A status line and skill that watches plan usage and
cost and suggests cheaper ways to work.

- **Buyer:** any Claude Code user on a paid plan.
- **Builds on:** `claude-statusline/` (usage limits, cost per hour, context warning, RAM).
- **First version:** the current status line plus a weekly summary (where the tokens went,
  which tasks were expensive) and suggestions (batch work, smaller models for mechanical
  steps).
- **Price idea:** free core as a funnel; the weekly report paid, or a tip jar.
- **Risks:** depends on fields Claude Code exposes. Stay read-only and keep unknown values
  visibly unknown.

## 8. Safe Windows makeover

**Pitch:** tune this PC safely, with one-click undo: a faster browser, freed disk space, a
cleaner shell, fixed vendor apps.

- **Buyer:** non-developers with slow or cluttered Windows laptops; gamers.
- **Builds on:** the personal Windows tools (makeover installer and rollback, Chrome memory
  tuning, disk-space mover).
- **First version:** a guided run that shows what it will change, applies it, and keeps a full
  rollback.
- **Why it sells:** the undo is the trust hook; most "PC cleaner" tools cannot reverse their
  changes.
- **Price idea:** a one-off purchase.
- **Risks:** it changes a real machine. Confirm the target, back up first, and test the rollback
  on every change.

## Next step

Pick one of 1 or 2, write a brief with `build-feature` (buyer, smallest version, how to verify
it), and build the first version as a new skill folder under `skills/`.
