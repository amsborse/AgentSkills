# Research and modernization

Research is a cost. Do it only when a candidate depends on an answer you do not have, and
record the answer so no future night repeats it.

## Before researching

```sh
$EVOLVE memory search "<topic or library>" --global
```

If memory has a verdict younger than ~90 days and nothing material changed (new major version,
security advisory, a new requirement in this repo), reuse it.

## Source order

1. Official documentation and changelogs/release notes of the exact version in the lockfile.
2. The project's repository: open issues, maintenance activity, release cadence, license.
3. Reproducible benchmarks with published methodology, preferably on a workload like ours.
4. Engineering publications from teams running it at scale, dated within the last ~18 months.

Ignore listicles, undated posts, vendor marketing without numbers, and popularity metrics as
evidence of fitness.

## Evaluating a library or pattern

Adopt only if all hold:

- It solves a problem this repository **demonstrably** has (point at the code or metric).
- The standard library, platform, or an installed dependency cannot do it reasonably.
- Maintained (recent releases, responsive issues), license compatible, acceptable size.
- Its cost (bundle bytes, cold start, API surface, migration) is smaller than the measured gain.
- It can be introduced incrementally behind an existing seam and removed again.

Record every evaluation, adopted or not:

```sh
$EVOLVE memory add --kind library --library <name> --verdict adopt|reject|defer \
  --reason "<evidence-based reason>" --sources <url1>,<url2>
$EVOLVE memory add --kind research --title "<question>" --summary "<answer>" --sources <urls>
```

## Modernization candidates

Prefer upgrades that remove code or risk: replacing hand-written utilities with platform
features (`structuredClone`, `AbortSignal.timeout`, `Intl`, native `fetch`, CSS container
queries, view transitions), patch/minor upgrades with security fixes, deprecated API removals.
Major-version or framework migrations are opportunities for the report, not overnight commits.
