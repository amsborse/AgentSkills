# Polyglot Ecosystems & Supply-Chain Guardrails

## 1. Ecosystem Commands & Lockfile Pairing

Always keep the manifest and its canonical lockfile in sync inside the same iteration:

| Ecosystem | Manifest & Lockfile | Audit / Outdated | Safe Update / Prune |
| --- | --- | --- | --- |
| **Node (npm / pnpm / yarn / bun)** | `package.json` + `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` / `bun.lock` | `npm audit --omit=dev`, `pnpm audit` | Prefer `--ignore-scripts` during resolution check; never mix lockfiles. |
| **Python (uv / pip / poetry)** | `pyproject.toml` + `uv.lock` / `poetry.lock` / `requirements*.txt` | `pip-audit`, `uv lock --upgrade-package <pkg>` | Keep runtime venv imports verified with `pytest` + `ruff` + `mypy`. |
| **Rust** | `Cargo.toml` + `Cargo.lock` | `cargo audit` (if installed) | `cargo update -p <crate>`, then `cargo check` + `cargo test`. |
| **Go** | `go.mod` + `go.sum` | `govulncheck ./...` (if installed) | `go get <mod>@<ver> && go mod tidy`, then `go vet ./...` + `go test ./...`. |
| **.NET** | `*.csproj` + `packages.lock.json` (if used) | `dotnet list package --vulnerable` | `dotnet add package <Id> -v <Ver>`, then `dotnet test`. |
| **Swift** | `Package.swift` + `Package.resolved` | `swift package show-dependencies` | `swift package update <pkg>`, then `swift test`. |

## 2. Supply-Chain Red Flags (Immediate Revert)

1. **Registry / Source Drift:** Lockfile `resolved` URLs must point only to the repository's existing registry (`registry.npmjs.org`, `pypi.org`, `crates.io`, `proxy.golang.org`, or the repo's configured enterprise mirror).
2. **Lifecycle Script Injection:** Inspect `node_modules/<pkg>/package.json` or lockfile `hasInstallScript` flags when adding/bumping packages. Reject unexpected new `preinstall` / `install` / `postinstall` hooks unless required by a known native toolchain (e.g., `esbuild`, `playwright`).
3. **Override / Resolution Debt:** Only add `overrides` / `pnpm.overrides` / `[patch]` for a transitive CVE when direct parent bumping cannot resolve it, and document the expiry condition.

## 3. Stage Adaptation

- **`seed` / `prototype`:** Focus on pruning unused boilerplate packages and patching high/critical CVEs; skip major version migrations until `night-tests` establishes behavioral coverage.
- **`mvp` / `production`:** Tackle advisory remediation, dead-dependency removal, lockstep framework minor bumps, and characterization-backed single-package major migrations.
