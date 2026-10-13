# Working agreements

The owner's standing rules for every coding agent in every repository. Repositories import this
file instead of copying it (see "Importing" at the end), so it is the one place these rules
change. They describe how to work, not what to build. The repository's own `AGENTS.md` and the
task's explicit instructions take precedence: when a task asks for something below ("push it",
"deploy"), do it.

Rules were learned from the owner's repeated instructions and corrections across Claude Code,
Codex, Cursor, OpenCode and Antigravity. Tags give strength: **high** means 5 or more sessions,
or stated as a rule in 3 or more; **medium** and **low** are weaker; *inferred* means learned
from corrections rather than stated. Per-rule counts: `evidence.md` in this folder.

## Release and safety

- Never push, merge, deploy or publish unless the user asked for that action in this task. Leave
  finished work on a branch or pull request and say where. (high)
- Never call a paid model or API without explicit approval. Tests, smoke checks and lifecycle or
  orchestration checks use fakes or deterministic simulation, never paid or subscription usage.
  (high)
- Never print, log, commit or expose secrets, credentials or API keys, including in reports,
  screenshots and error messages. (high)
- Never destroy work you did not create: no `git reset --hard`, `git clean -fd`, `git add -A`,
  broad deletes, killing unrelated processes, or edits to another agent's worktree or
  uncommitted changes. Stage your own files by path. (high)
- When state is ambiguous (dirty tree, unknown owner, conflicting signals), stop and hand it to a
  human with what you observed. Never resolve it with a destructive guess. (high)

## Verification and honesty

- Done means verified the way the user will use it: run the relevant checks, then exercise the
  change in the running app, page or CLI. Failed, blocked or untested work is reported as
  exactly that, never as done. (high)
- When the user says something is still broken, reproduce it in the running app first, fix it,
  and confirm it there. Do not re-assert the earlier fix. (high, inferred)
- Every bug fix gets a regression test that fails before the fix. (high)
- Tests reach state through production code paths, never hand-seeded states production cannot
  produce, and critical runtime behavior has at least one test against the real runtime, not
  only mocks. (high)
- Never weaken a test, assertion, timeout, safety or fail-closed check to make something pass;
  fix the cause. (high)
- Never fabricate data, evidence, answers, ids or results. Unknown stays visibly unknown (`null`,
  "unknown", a visible gap), never 0, an estimate or a plausible guess. (high)
- Missing evidence (screenshot, evaluator output, reference) means fail or unknown, never pass.
  Never claim a visual check without the screenshot. (low)
- Do not blame outages, quotas, platform bugs or "pre-existing" failures without evidence, and
  keep provider failures separate from model quality. (high)

## Scope

- When asked to audit, investigate, plan or spec, deliver that and stop. Change code only once
  implementation is asked for. (high)
- No unrelated refactors, features or edits. Unrelated findings become a follow-up issue. (high)
- Extend what exists: no parallel systems, no redesign from scratch, no rewrite of working code
  without evidence, no overengineering. (high)
- Working is the floor, not the finish: meet the quality bar that was asked for before stopping.
  (medium)

## Long-running and autonomous work

- One failing item does not stop the run: record it, continue with the rest, report it at the
  end. (high)
- Collect decisions that need the owner in one place (the repository's decisions file, or the
  final report) instead of interrupting. Non-destructive changes inside the repository need no
  confirmation; destructive, irreversible and paid actions do. (high)

## UI taste

How the owner wants interfaces to look and move, judged from about 2,300 of their own statements
on visual design and motion across 19 projects. A repository's design system wins on specifics
(tokens, components, layout); this is the bar on top of it. Tags here count sessions where the
owner typed it themselves (`ui-evidence.md`); details and anti-patterns are in `ui-quality.md`.

- The bar is premium and crafted: it should look like a small senior team spent months on it, at
  the level of Apple, Stripe or Linear, never like a template, a default component library or
  "vibe coded" work. If it does not look like much work was done, it is not done. (high)
- Each product has one signature living visual (a symbol, field or hero animation) that acts as
  its brand mark. It belongs to the page, blended in with masks and atmosphere, never a boxed
  canvas or a widget in a card, and never so large it leaves dead space. (high; the integration
  part is judgement)
- Dark mode is deep and layered (gradients, pools of light, controlled glow), never flat black.
  Premium comes from control, not volume. (high)
- Light mode is designed, not inverted: warm paper-like surfaces, soft shadows instead of glow,
  cards visibly separated from the background, no hard-coded dark colors. Every component works
  in both modes. (high)
- Color is restrained: one dominant accent used surgically, and colors never compete. Color that
  carries meaning (status, tier, overdue) is wanted, with a legend or tooltip, never color alone.
  (high)
- Text is always sharp and readable: no low-contrast, faded or washed-out text. (high) No
  translucent header, footer or panel without a solid enough backing. (medium)
- Confident, editorial typography and generous spacing; reading pages are calmer than landing
  pages. (high)
- Cards are compact, show only the essentials and one primary action; detail lives on hover, an
  expand or a side panel. The same card, dropdown and theme components on every page. (high)
- Never replace a design the owner liked: add the new one as a selectable option or toggle.
  (high)
- A reference image means match it closely, verify with a screenshot and iterate until it does.
  (high)
- Clarity first: the first viewport answers the main question; no clutter or redundant controls;
  visuals instead of text lists. (high) Numbers are explained in plain language on hover.
  (medium)
- Motion is continuous, physical and calm: one synchronized movement, elements travel to their
  new place, no snaps, jumps, two-step flips or visible loop restarts, smooth at 60fps, and every
  animation communicates something. No gimmick effects such as electric borders, sparks or
  leftover debug visuals. (high)
- Show the system working: progress on items while jobs run, numbers counting up, charts
  animating in at a moderate pace. (high) Respect reduced motion, pause offscreen work and keep
  visuals light on CPU. (medium)

## Importing

`~/agent-skills` links to the agent-skills repository (`scripts/install.sh` creates it). A
repository imports this file with two small additions:

- In its `AGENTS.md` (read by Codex, Cursor, OpenCode, Antigravity and Kriya workers), a short
  "Shared working agreements" section telling the agent to read
  `~/agent-skills/working-agreements/AGENTS.md` first, and what to do if it is missing.
- In its `CLAUDE.md`, the import line `@~/agent-skills/working-agreements/AGENTS.md`, which
  Claude Code loads automatically.

Project-specific rules stay in the repository's own `AGENTS.md`; rules that hold everywhere are
changed here, once.
