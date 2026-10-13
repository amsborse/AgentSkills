# Security

Fix demonstrated weaknesses with the smallest change; never touch credentials or
production configuration.

## Deterministic first

- Dependency audit output is in the survey (`pnpm audit --json` / `npm audit` / `pip-audit`
  when configured). Prefer patch/minor upgrades that fix a reachable advisory. Verify the
  vulnerable path is actually used before calling it urgent.
- Secret scanning: search committed files for tokens/keys (high-entropy strings, `BEGIN
  PRIVATE KEY`, provider key prefixes). If one is found, **do not** rotate or edit it: record a
  `failure` memory item and flag it at the top of the PR for the owner.

## Review lenses

- **Authorization:** every state-changing route checks the caller owns the resource; no trust
  in client-supplied ids or roles; admin paths not reachable from public routes.
- **Input handling:** validated at boundaries with a schema; parameterized queries; no shell
  string interpolation of user input; path traversal on file access; SSRF on user-supplied URLs.
- **Output:** HTML escaping, safe Markdown rendering, CSP where the app serves HTML.
- **Secrets in logs and errors:** redact tokens, cookies, emails and personal data.
- **Agent/LLM surfaces:** prompt-injected content treated as data; tool calls bounded by
  allow-lists; model output validated before acting.
- **Supply chain:** pinned lockfile, no install scripts from unknown packages, no new
  dependency without the research rubric.

## Acceptance

Add a regression test that fails before the fix (e.g. an unauthorized request returning 403).
State the threat, the fix and residual risk in `--evidence`. Report exploitable issues at the
top of the PR body.

## Never

Rotate keys, edit `.env*`, change IAM/permissions, disable security checks, or publish details
of an unfixed vulnerability in a public place.
