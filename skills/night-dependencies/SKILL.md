---
name: night-dependencies
description: Polyglot dependency loop. Patches advisories, runs safe bumps or codemods, checks install scripts, and prunes dead packages. Use for "/night dependencies".
metadata:
  aliases: "night-dependencies, night dependencies, overnight dependency upgrade"
  keywords: "night, loop, dependencies, upgrade, cve, lockfile"
  composes: "security-audit, test-everything, improve"
  requires: "git, shell"
  risk: "high"
  night-loop: "dependencies, security"
  night-writes: "code"
  night-minutes: "25"
  night-signals: "deps"
---

# Night dependencies

One iteration executes **one** atomic dependency improvement—patching a security advisory, upgrading
one package/lockstep family, migrating one deprecated API via codemod/changelog, or removing a
verified unused dependency—using `security-audit`, `test-everything` and `improve`. Read
`../night/references/loop-interface.md` and `workflows/ecosystems-and-supply-chain.md`.

## Activation

- Use on any repository with package manifests (`package.json`, `pyproject.toml`/`requirements.txt`/`uv.lock`,
  `Cargo.toml`, `go.mod`, `*.csproj`, `Package.swift`) and its local package manager installed.
- **Supply-chain invariants:** never switch package registries, never add untrusted git/tarball URLs,
  never execute newly introduced `preinstall`/`postinstall` scripts uninspected, and never bundle 20
  unrelated upgrades into one iteration.

## Workflow

1. **Baseline & triage (`workflows/ecosystems-and-supply-chain.md`):** Inspect manifests, lockfiles,
   and ecosystem audit tools (`npm`/`pnpm` audit, `pip-audit`/`uv`, `cargo audit`, `govulncheck`,
   `dotnet list package --vulnerable`) when available offline/locally. Order candidates:
   1. Reachable security advisories (CVE/GHSA) with clean patch/minor fixes.
   2. Unused/dead direct dependencies verified via static import/symbol search across source, build
      configs, dynamic loaders, and scripts.
   3. Patch/minor lockstep groups (e.g., framework + adapter, `@types/*`, lint/test plugins).
   4. Single major upgrade **only** when tests exist (`mvp`/`production`), migration steps are clear,
      and characterization tests protect every callsite first.
2. **Supply-chain diff check:** Update with `--ignore-scripts` (where supported) first, inspect lockfile
   diffs for unexpected transitive explosion, registry URL drift, or lifecycle scripts, then run
   normal resolution if clean.
3. **Code adaptation:** Apply official codemods or update deprecated callsites cleanly; remove dead
   shims left behind by the old version.
4. **Verify:** Run `test-everything` (unit, typecheck, lint, build) and re-run the advisory scan.
5. **Hand back:** Emit `NIGHT_RESULT` naming exact `package: old -> new` (or pruned package),
   advisory IDs closed, lockfile status, and next candidate.

## Evaluation

- Keep: Manifest and lockfile stay strictly synchronized, advisory count drops or target upgrade/prune
  succeeds, zero untrusted install scripts/registries appear, and build/typecheck/tests stay green.
- Revert: Peer-dependency conflicts, `--force` / `--legacy-peer-deps` hacks, unexplained lockfile
  churn, new CVEs, or failing checks.
- Inconclusive: Offline cache/network restrictions block package resolution or no test/build check
  exists to validate a behavioral upgrade.

## Stop conditions

- All safe patch/minor updates, dead dependencies, and locally fixable advisories are resolved.
- Remaining major upgrades require architectural breaking changes or human product sign-off (record
  in `NIGHT_RESULT` / owner decisions).

## Examples

- Day: "run night-dependencies on the auth and HTTP packages" upgrades one group and verifies lockfile
  and test integrity.
- Night: `/night dependencies` or `/night security` lands atomic, bisect-friendly upgrade commits.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
