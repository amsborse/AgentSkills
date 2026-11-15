# Experience engineering: decision queue

Decisions met during Phase 2. Safe, reversible, in-scope choices are made and recorded here.
Anything that needs the owner stays **pending** and never blocks other work.

## D-001 Base branch

- **Question:** How to integrate `feat/improve-visuals` into `main` before starting.
- **Context:** `origin/main` already contained `feat/improve-visuals`; local `main` was behind.
- **Options:** (1) fast-forward local `main`; (2) merge commit; (3) build on the feature branch.
- **Recommended:** 1.
- **Risk and impact:** None: fast-forward only, no conflicts, nothing pushed, uncommitted work in
  the main checkout untouched.
- **Approval required:** No.
- **Independent work:** All of Phase 2, on `feat/experience-engineering` in its own worktree.
- **Status:** Resolved (option 1). Base is 633422e.

## D-002 `validate.mjs` discovery failures (OpenCode, Cursor)

- **Question:** Two installation checks fail when `validate.mjs` runs from a worktree.
- **Context:** The checks compare the installed skill links with the folder validate runs from.
  The links point at the main checkout, so a worktree always fails them; from the main checkout
  they pass.
- **Options:** (1) make the check worktree-aware (compare against the main checkout of the same
  repository) with a test; (2) run validate with `AGENT_SKILLS_HOME_OVERRIDE`; (3) accept.
- **Recommended:** 1, investigated in Stage 5.
- **Risk and impact:** Low; touches only the installation section of `scripts/validate.mjs`.
- **Approval required:** No, unless the fix turns out to need unrelated changes.
- **Independent work:** Everything else.
- **Status:** Open, scheduled for Stage 5. Until then validation is not reported as clean.

## D-003 Default performance budget

- **Question:** What the bench enforces when a project has no budget file.
- **Context:** Without a default, a slow page exits 0. With a strict one, lab numbers on a slow
  machine fail pages that are fine.
- **Options:** (1) Core Web Vitals "good" thresholds (LCP 2500 ms, INP 200 ms, CLS 0.1), labelled
  indicative; (2) no default; (3) stricter lab thresholds.
- **Recommended:** 1.
- **Risk and impact:** Reversible; a project overrides it with `--budget`.
- **Approval required:** No.
- **Status:** Resolved (option 1).

## D-004 `web-vitals` as the vitals source

- **Question:** Depend on `web-vitals` or measure with the platform APIs.
- **Context:** Approved as optional and locally detected. No project on this machine has it
  installed, and nothing may be installed globally.
- **Options:** (1) built-in PerformanceObserver by default, use `web-vitals` from `--project`
  when present; (2) require it.
- **Recommended:** 1.
- **Risk and impact:** The `web-vitals` path is written but has not been run here; the report
  names which source produced its numbers.
- **Approval required:** No. Owner may want it verified in a project that has the package.
- **Status:** Resolved (option 1). The `web-vitals` path is **unverified**.

## D-005 Framework adapters for recipes

- **Question:** One adapter per recipe per framework, or one shared guide.
- **Context:** The recipes are plain CSS and script with an init and a clean-up function. Per
  framework wrappers would be 24 or more small files that cannot be tested here without
  installing each framework.
- **Options:** (1) one `recipes/adapters.md` showing the mount and clean-up pattern for React,
  Vue, Svelte and Astro; (2) tested wrapper packages per framework.
- **Recommended:** 1.
- **Risk and impact:** The wrappers are untested patterns and say so. Reversible.
- **Approval required:** No.
- **Status:** Resolved (option 1).

## D-006 Starting tier in automatic mode

- **Question:** Which tier a page starts on before any frames are measured.
- **Context:** Starting high looks best on good hardware but a weak device pays for a few
  seconds; starting low is safe but good hardware visibly steps up.
- **Options:** (1) start from device hints (memory, cores, pointer type), then measure;
  (2) always start low and step up; (3) always start high.
- **Recommended:** 1 (implemented). A weak device reaches low within about 8.5 s in the worst
  measured case.
- **Risk and impact:** Reversible; a project can pin a tier or pass its own start tier.
- **Approval required:** No. Owner may prefer option 2 for a mobile-first product.
- **Status:** Resolved (option 1).
