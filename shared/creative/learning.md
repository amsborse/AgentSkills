# Learning from creative work

The creative skills improve from real outcomes, through the existing `night-evolve-skills`
loop. Nothing here rewrites a skill on its own.

## Capture

After a visual loop, a review, or owner feedback, record it in the ledger
(`~/.agent-skills/creative/findings.jsonl`, or `$CREATIVE_LEDGER`):

```bash
S=~/agent-skills/skills/audit-design/scripts
node $S/record-findings.mjs --report .visual/after/report.json --skill revamp-ui --outcome fixed
node $S/record-findings.mjs --kind feedback --skill add-interactions --note "owner: hover glow too strong in light mode"
node $S/record-findings.mjs --kind success --skill build-3d --technique shader-distortion --note "OGL plane at DPR 1.5 held 60fps on laptop"
```

Kinds: `defect` (visual defects), `failure` (repeated implementation failures), `performance`,
`review` (design review findings), `success` (techniques that worked), `browser-test`
(audit outcomes), `feedback` (the owner's words, quoted). The ledger drops URLs; keep secrets
and private content out of notes.

## Propose

`node $S/record-findings.mjs --summary` lists patterns that repeat (same skill and check two or
more times). `night-evolve-skills` treats a repeated pattern as evidence for one bounded edit to
the skill or technique file involved. A one-off is not a rule.

## Evaluate before promotion

A change to a creative skill, technique or the audit runner is kept only when the held-out
evaluations still pass:

```bash
node --test tests/creative-evals.test.mjs tests/visual-audit.test.mjs tests/catalog-routing.test.mjs
```

- `evals/creative/routing.json`: held-out request phrasings with the skill each must reach.
  Do not edit these to make a change pass; add new cases instead.
- `tests/fixtures/visual-audit/`: a page with planted defects (every one must be flagged) and a
  clean page (must pass). Set `PLAYWRIGHT_PROJECT` so the browser test runs; a skipped browser
  test counts as unevaluated, not passed.

Stable skills are not rewritten wholesale: one evidence-backed change per iteration, validated
with `node scripts/validate.mjs` and the tests above.
