---
name: security-audit
description: Audit a codebase or change for security problems — secrets, authentication and authorization, injection, XSS/CSRF/SSRF, unsafe deserialization, dependency CVEs, risky install scripts, permissions and data exposure — with a threat model sized to the system, concrete exploit scenarios, and fixes. Also reviews third-party skills, plugins and MCP servers before adoption. Read-only unless fixes are asked for. Use for "security audit", "security review", "threat model", "is this safe" or "check for secrets".
metadata:
  aliases: "security audit, security review, threat model, find vulnerabilities, is this safe, check for secrets, audit dependencies, review this skill for safety"
  keywords: "security, vulnerability, secret, credential, auth, authorization, injection, xss, csrf, ssrf, cve, dependency, owasp, permission, sandbox"
  composes: "fix-bug, test-everything"
  requires: "shell"
  risk: "low"
---

# Security audit

Read-only by default. Never print a secret you find: report its file:line and type only. Never
run exploit code against systems you don't own; prove issues with tests against local code.

## Size it

- **A diff:** check the changed trust boundaries only (inputs, auth checks, queries, file and
  shell access, new dependencies).
- **A repository:** the steps below.
- **A third-party skill, plugin or MCP server:** read every script and hook. List shell
  execution, network calls, telemetry, credential access, always-on hooks and instructions that
  try to widen permissions. Give a verdict (adopt / adopt ideas only / reject) with reasons;
  the policy is in `~/agent-skills/docs/SOURCES.md`.

## Repository audit

1. **Threat model** (short): assets, entry points, trust boundaries, attackers that matter.
2. **Secrets:** search the tree and git history for keys, tokens and `.env` files committed; check
   that logs and error messages don't leak them.
3. **Authn/authz:** every route or command checks identity and ownership; no client-side-only
   checks.
4. **Injection and output:** SQL/NoSQL, shell, path traversal, template and HTML output, SSRF from
   user URLs, unsafe deserialization.
5. **Dependencies:** run the ecosystem's audit (`npm audit`, `pip-audit`, `cargo audit`) if
   available offline or approved. Flag postinstall scripts and unpinned versions.
6. **Config:** CORS, cookies, CSP, TLS, debug flags, permissions of tokens and CI secrets.
7. **Report:** findings by severity, each with file:line, an exploit scenario and the fix. If fixes
   are asked for, fix each with a regression test (`fix-bug`).

Static tools (Semgrep, CodeQL) help when installed; their hits still need manual confirmation.
