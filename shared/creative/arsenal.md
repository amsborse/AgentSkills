# Arsenal: reuse before you build

Arsenal is the owner's library of UI components, interactions, motion and visual effects (a
pnpm monorepo of `@arsenal/*` packages). Every UI, motion or visual skill checks it before
writing a new component, and registers what it builds so the next project can reuse it.

## 1. Search first

```
node ~/agent-skills/shared/creative/arsenal/search.mjs "pointer beam"
node ~/agent-skills/shared/creative/arsenal/search.mjs --list
```

The checkout is found from `--root <dir>`, then `ARSENAL_DIR`, then a `~/arsenal` link; a folder
counts only when its `packages/*/package.json` names start with `@arsenal/`. A project's
`.arsenal/` folder (repo map, summaries) is context-engine output, not the library, and is
skipped. The
search reads each package's exports with their doc comments, the catalog files
(`packages/*/src/*catalog*`) and the package READMEs. Every query word must match, so search
by what the thing does ("draw in", "crosshair", "engraving", "design registry"), then by name.

Exit code 2 means no checkout was found: say so in the report and ask for the path once.
Never treat it as "nothing exists".

## 2. Reuse

- **Import** when the project already depends on Arsenal or can: use the import line the
  search prints.
- **Lift and shift** when it cannot (a static site, another stack): copy the source file and
  its tests, keep the header comment that names the Arsenal origin, and adapt only tokens and
  names to the project. Pure modules (geometry, timing, canvas renderers) travel unchanged;
  framework bindings are thin wrappers around them.
- **Extend** when it almost fits: add an option to the Arsenal piece rather than forking a
  near copy in the project.

A reused piece still goes through the project's design system and the browser loop: it must
look native to the product, in both themes.

## 3. Build new, then register it

When nothing fits, build it in the project as usual. Once it is verified in the running app,
port it to Arsenal on a branch (never the default branch, never pushed unless asked):

1. Split the pure core (no React, no DOM globals at import time) from the binding. Theme
   colours, sizes and copy come in as parameters, never hard-coded from one site.
2. Put it in the package that matches its kind (`motion`, `fx`, `ui`, …) and export it from
   the package's `src/index.ts` with a one-line doc comment saying what it does. That comment
   is what the search finds.
3. Add a catalog entry (`id`, `name`, `description`) when the package has a catalog.
4. Add a README section: what it is, a minimal usage example, and how to lift and shift it.
5. Add tests for the pure core, and respect reduced motion and offscreen pausing in the
   binding.
6. Run the package's checks, commit by path, and name the branch in the report.

## 4. Design variants

Whole-site looks are registered too: see `design-variants.md` for building design N as one
registry entry that reuses the same pieces.
