---
name: spec
description: Turn a one-line goal into the user's full "Act as a principal …" engineering brief (role, context to preserve, prioritized requirements, constraints, acceptance checks), grounded in the actual code, then implement it after approval. Use when the user runs /spec <goal> or asks to "write a spec/brief" for a feature or redesign.
---

# /spec <goal>

The user normally pastes long briefs in this shape. Build it for them from a short goal so they
don't have to.

## Steps

1. **Ground it.** Read only what is needed: the files, components and git history for the area
   the goal touches. Note what already exists and what the user liked (keep those).
2. **Write the brief** in this shape, compact, no filler:

   ```
   Act as a principal <roles that fit: e.g. frontend engineer, motion designer, WinUI 3 architect>.

   Goal: <one sentence>
   Context: <what exists today, with file paths>
   Preserve: <current behavior/visuals the user liked; never replace, add new ones as an option>

   P0 (must): <numbered, concrete, testable>
   P1 (should): <numbered>
   Out of scope: <what not to touch>

   Constraints: no new dependencies or paid APIs unless listed; extend existing components;
   performance budget <if relevant>; both light and dark themes <if UI>.
   Done when: <acceptance checks, and how /verify will check them on the real target>
   ```

   Pull constraints from ~/agent-skills/working-agreements (UI taste, scope, verification) and
   the project's AGENTS.md/CLAUDE.md rather than inventing new ones.
3. **Show it and stop** with numbered questions only for real unknowns. When the user says go
   (or edits it), implement P0 then P1, run /verify, and report in 2–5 sentences.
