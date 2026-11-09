---
name: understand-code
description: Understand and explain a codebase or one area of it — architecture, entry points, data flow, dependencies, conventions and risky spots — with file:line evidence, as a short map or a diagram. Use for "understand the architecture of this repository", "how does X work", "explain this codebase", onboarding, or before changing unfamiliar code.
metadata:
  aliases: "understand the architecture, architecture of this repository, explain this codebase, how does this work, onboard me, map the repo, walk me through"
  keywords: "architecture, understand, explain, codebase, repository, onboarding, diagram, dependency, structure, flow"
  composes: "research"
  requires: "shell"
  risk: "low"
---

# Understand code

Read-only. Don't change code unless the user asks.

## Size it

- **One question** ("where is X handled?"): search, read the hits, answer with file:line.
- **One area**: entry point → main path → data stores → tests, in about a page.
- **Whole repository**: the full map below. For very large repos, send parallel read-only
  explorers (one per top-level area) and merge their conclusions; don't read every file yourself.

## Map

1. **Shape:** languages, build and test commands, top-level folders and what each owns (from
   manifests, README, AGENTS.md, CI config).
2. **Entry points:** binaries, servers, routes, jobs, UI roots.
3. **Core flow:** follow one real request or command end to end, with file:line at each hop.
4. **State and boundaries:** databases, caches, external APIs, queues, auth.
5. **Conventions:** error handling, tests, naming, how features are usually added (git log).
6. **Risks:** hotspots (most-changed files), missing tests, dead code, surprising coupling.

Output a compact map with a diagram (Mermaid, or ASCII if Mermaid won't render) and links, not a
file dump. Optional tools when installed: `graphify` builds a code graph locally (its docs/media
pass calls a model, so it needs approval); never install them unasked.
