---
name: night-compliance
description: Legal and compliance engineering loop. Enforces SPDX license hygiene, GDPR/CCPA privacy controls, consent gating, and AI/store disclosures. Use for "/night compliance".
metadata:
  aliases: "night-compliance, night compliance, night legal, night legal compliance, overnight legal compliance"
  keywords: "night, loop, compliance, legal, gdpr, ccpa, spdx, sbom, license, consent"
  composes: "security-audit, production-ready, test-everything, verify"
  requires: "git, shell"
  risk: "medium"
  night-loop: "compliance, legal"
  night-writes: "code"
  night-minutes: "25"
  night-signals: "deps, saas, ai, game, frontend, backend"
  night-keep: "no-regression"
---

# Night compliance

One iteration audits and hardens **one** code-enforceable legal, privacy, licensing, or platform
compliance control—using `security-audit`, `production-ready`, `test-everything` and `verify`,
guided by `workflows/compliance-matrix.md`. Shared contract: `../night/references/loop-interface.md`.

## Activation

- Use on any commercial, SaaS, AI, open-source, or game repository (`deps`, `saas`, `ai`, `game`,
  `frontend`, `backend`).
- **Hard boundary (engineering vs legal counsel):**
  - Implement and test **technical compliance controls** (SPDX license scanning, attribution files,
    PII log redaction, consent/GPC gating, DSAR export/erasure cascades, AI output metadata tags,
    symmetric click-to-cancel flows).
  - **Never** invent binding legal counsel sign-off, fabricate regulatory certifications (SOC 2,
    HIPAA, ISO 27001, GDPR adequacy), or publish unreviewed Terms/Privacy prose as final; mark draft
    policy scaffolds clearly with `DRAFT — REQUIRES LEGAL REVIEW` or queue an owner decision via
    `NIGHT_RESULT.blocker` (`{"kind":"authorization", ...}`).

## Workflow

1. **Audit compliance seams (`workflows/compliance-matrix.md`):** Inspect the codebase for the highest-risk
   verifiable gap not yet addressed in the handoff:
   1. **OSS, SPDX & Asset Licensing:** check manifest `license` SPDX validity, scan installed/vendored
      packages and font/audio/sprite assets for copyleft contamination (`AGPL-3.0`, `GPL-*`, `SSPL`,
      `CC-BY-NC`) in proprietary repos, and generate/verify `THIRD_PARTY_NOTICES.md` or SBOM scripts.
   2. **Privacy, Consent & PII Minimization (GDPR / CCPA / CPRA):** gate non-essential analytics/pixels
      behind explicit opt-in + honor `Sec-GPC: 1` (`navigator.globalPrivacyControl`), scrub PII from
      logs/telemetry, and verify DSAR user-data export + right-to-erasure deletion/anonymization cascades.
   3. **AI Act & Storefront Disclosures (EU AI Act Art. 50 / Steam / App Store):** attach machine- and
      user-readable provenance flags (`ai_generated`) on synthetic outputs, enforce dataset/source
      license guards, and verify Steam/storefront AI & loot-probability disclosure accuracy.
   4. **Consumer Protection & Statutory Accessibility (FTC Click-to-Cancel / EAA):** ensure self-serve
      subscription cancellation takes no more steps than signup, renewal terms are explicit before
      charge, and legal/accessibility links resolve cleanly without dead `href="#"` stubs.
2. **One bounded control + regression test:** Implement one clean technical control and a deterministic
   unit/integration test proving enforcement (e.g., copyleft license detector test, GPC opt-out blocking
   analytics init, DSAR erasure removing PII across tables/caches, PII redactor test).
3. **Escalate legal/policy choices cleanly:** If an `AGPL`/`GPL` dependency is wired into proprietary
   core code and cannot be swapped without product impact, do not break the build—record exact `file:line`
   evidence and set `NIGHT_RESULT.blocker` (`authorization`).
4. **Verify & hand back:** Run `test-everything` and emit `NIGHT_RESULT` with evidence and next control.

## Evaluation

- Keep: Technical compliance control is enforced through real code paths with passing test proof, zero
  fabricated legal claims appear, and all baseline checks stay green.
- Revert: Unapproved legal claims/certifications added, valid user flows broken, copyleft packages
  introduced, or tests regress.
- Inconclusive: Required runtime/test harness unavailable.

## Stop conditions

- Applicable technical controls in `workflows/compliance-matrix.md` are verified by tests, and any
  remaining counsel/policy decisions are queued once in `approvals`.

## Examples

- Day: "run night-compliance on analytics consent and third-party licenses" gates telemetry on consent/GPC
  and adds an SPDX copyleft check test.
- Night: `/night compliance` or `/night legal` hardens licensing, privacy, and AI/SaaS controls overnight.

End the final message with `NIGHT_RESULT: {json}` using the shared contract's fields.
