---
name: build-feature
description: Build a feature end to end — ground it in the code, write a short brief, implement, test, verify on the real target and review. Scales from a small change (just do it and verify) to a large feature (spec first, worktree, parallel workers). Use when asked to build, add or implement a feature, "build this end to end", or "write a spec/brief" for one (the former /spec).
metadata:
  aliases: "build this feature, build a feature, implement this feature, add a feature, new feature, end to end, write a spec, spec this, write a brief"
  keywords: "feature, implement, build, spec, brief, requirements, endpoint, component, api"
  composes: "understand-code, test-everything, verify, review-code, coordinate-agents"
  requires: "shell, git"
  risk: "medium"
---

# Build a feature

Follow `~/agent-skills/working-agreements/AGENTS.md` throughout (scope, verification, no push).

## Size it first

- **Small** (one file or component, clear intent): read the neighbors, implement, add or
  update a test, run the `verify` skill. No brief.
- **Medium** (several files, some unknowns): write the brief from `workflows/spec.md`, state
  assumptions in one line, implement P0 then P1 without waiting unless something is destructive.
- **Large** (new subsystem, many files, or the user asked for a spec): write the brief with
  `workflows/spec.md`, show it and stop for approval. After approval, split independent parts and
  hand isolated ones out with the `coordinate-agents` skill: UI parts to Codex, simple parts to
  Antigravity, the complex core stays with you (`~/agent-skills/shared/agent-routing.md`).

## Steps

1. **Ground it.** Find where the feature lives and what it must match: the closest existing
   feature, data model, tests, design system. Use `understand-code` if the area is unfamiliar.
2. **Brief** (medium/large) with P0/P1, out of scope, constraints and "done when".
3. **Implement** by extending what exists. No new dependencies or paid APIs without approval.
   API work: validate inputs, typed errors, and a test per endpoint. UI work: both themes,
   reduced motion, the owner's UI bar (`revamp-ui` for big visual changes).
4. **Test** the new behavior through production code paths (`test-everything` for strategy).
5. **Verify** on the real target with the `verify` skill, with evidence.
6. **Review** large or risky diffs with `review-code` and fix what is confirmed.
7. **Report** in 2–5 sentences: what works, how it was verified, what's left.
