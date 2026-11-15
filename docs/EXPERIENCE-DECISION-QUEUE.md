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
- **Status:** Resolved (option 1) in Stage 5. `installFindings` in `scripts/lib/agents.mjs`
  compares the links with the primary checkout when validate runs from a linked worktree, warns
  that skills that exist only on the branch cannot be installed until merged, and still fails a
  missing or wrong link (test in `tests/install.test.mjs`). No unrelated changes were needed.

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
- **Status:** Resolved (option 1) and verified in Stage 5 against `web-vitals` 6.2.3 installed
  in a scratch project (nothing global). Verification found the path could never activate: the
  package's exports map hides `package.json` from `require.resolve`. Fixed with `findVitalsLib`
  and a regression test. Lantern, low tier, 3 runs: LCP 176 ms from `web-vitals` against 184 ms
  built-in, CLS 0 from both, INP unknown from both (no interaction script).

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

## D-007 Unmeasured metrics in a budget

- **Question:** What a bench run reports when a budgeted metric could not be measured.
- **Context:** Codex review (P1): such a run exited 0 and could be saved as a baseline. The
  built-in budget includes INP, which is never measured without an interaction script.
- **Options:** (1) a project's own budget file with an unmeasured metric is incomplete (exit 2,
  no baseline); the built-in indicative budget only lists the gap; (2) every unmeasured budgeted
  metric is incomplete, which makes every run without a script exit 2; (3) keep exit 0.
- **Recommended:** 1 (implemented).
- **Risk and impact:** A project with `inp` or `heapGrowth` in its budget must now pass
  `--script` (and `--repeats 4` for heap growth) or its bench run is incomplete. Reversible.
- **Approval required:** No. Owner may prefer option 2 for stricter CI.
- **Status:** Resolved (option 1).

## D-008 Stale `codex` command shim

- **Question:** Repair `~/.local/bin/codex` and `codex.cmd`, which point at a
  `~/.local/lib/codex-bridge/codex-bridge.mjs` that no longer exists.
- **Context:** Found in Phase 3 while testing skill invocation. Typing `codex` fails; the
  bridge in this repository (`tools/codex-bridge`) works when called directly, which is how
  Phase 3 ran Codex. The files are outside the repository, so they were left untouched.
- **Options:** (1) repoint the shim at this repository's bridge; (2) delete the shim so the
  real Codex CLI is found; (3) leave it.
- **Recommended:** 1.
- **Risk and impact:** Changes a command outside the repository. Reversible (backups exist
  next to the shim).
- **Approval required:** Yes.
- **Status:** Open.

## D-009 OpenCode and Cursor invocation could not be tested

- **Question:** How to prove the `experience` skill is invoked, not only linked, in OpenCode
  and Cursor.
- **Context:** The skill is linked where both agents read skills. OpenCode refused to run:
  "This API key has expired" (OpenCode Go). Cursor has no headless agent command on this
  machine. Invocation is therefore unverified for both, not passed.
- **Options:** (1) owner renews the OpenCode key and opens Cursor once, typing
  `/experience audit` in each; (2) accept link-level verification.
- **Recommended:** 1.
- **Risk and impact:** None to the repository.
- **Approval required:** Yes (needs the owner's accounts).
- **Status:** Open.

## D-010 Phase 3 commits and the main branch

- **Question:** Where Phase 3 fixes land after the approved merge.
- **Context:** `main` was fast-forwarded to `feat/experience-engineering` (9bd3fed) as
  approved. Phase 3 fixes continue on the same branch and `main` is fast-forwarded again at
  the end. Nothing is pushed. The primary checkout was switched from `feat/improve-visuals`
  (clean) to `main` to run the suite from the merged commit.
- **Options:** (1) fast-forward `main` again at the end of Phase 3; (2) leave Phase 3 on the
  branch for a second approval.
- **Recommended:** 1 (taken: same approved branch, fast-forward only, no push).
- **Risk and impact:** Local only; undo with `git branch -f main 9bd3fed`.
- **Approval required:** No for the local fast-forward; yes for any push.
- **Status:** Resolved (option 1).

## D-011 Firefox and WebKit engines

- **Question:** Where the extra Playwright engines live.
- **Context:** Cross-browser runs need Firefox and WebKit builds. Installing them into the
  shared Playwright cache would be a machine-wide change, so they were downloaded into the
  session scratch folder and used through `PLAYWRIGHT_BROWSERS_PATH`.
- **Options:** (1) keep them temporary; (2) owner runs `npx playwright install firefox webkit`
  in a project to keep them.
- **Recommended:** 1 until cross-browser runs are wanted regularly.
- **Risk and impact:** Temporary files only; they vanish with the scratch folder.
- **Approval required:** No.
- **Status:** Resolved (option 1).

## D-012 Signal crashes Playwright's WebKit build on the way back

- **Question:** Whether to switch off the back view transition in WebKit.
- **Context:** In Playwright WebKit 26.6 on Windows, a real key press or click that returns
  from a service to the list on `low` and above kills the page process. The same code called
  from script, the forward transition, the `static` tier and cut-down pages all survive.
  Safari itself could not be tested (no Apple device here).
- **Options:** (1) record it as a fault of that engine build and keep the transition; (2) skip
  view transitions in every WebKit browser, which would remove a working effect from Safari on
  the strength of a test build; (3) owner opens `demos/experience/signal.html` in Safari, opens
  a service and presses Esc, then decides.
- **Recommended:** 1 now, 3 when a Mac or iPhone is at hand.
- **Risk and impact:** If Safari is affected, the Signal demo would crash there on going back.
  Demo only; no product uses it yet.
- **Approval required:** No for 1; a real device for 3.
- **Status:** Open (option 1 taken).
