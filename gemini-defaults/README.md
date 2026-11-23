# Gemini / Antigravity (`agy`) Defaults

Portable configuration, lifecycle hooks, terminal colors/status, and Windows Terminal profile for Google Antigravity (`agy`).

## Included

- **`GEMINI.md`** — Concise 1–2 line default response style rule (`~/.gemini/config/GEMINI.md`).
- **`scripts/agy-session-hook.js`** — Tracks live session status (`Ready` / `Working` / `Done` / `Error` / `Paused`), auto-captures the first prompt as tab title, and triggers detached notifications on idle completion/errors.
- **`scripts/agy-pretool-guard.js`** — `PreToolUse` (`run_command`) guardrails: Windows PowerShell 5.1 `&&`/`||` syntax guard, Sutra/Manthan batch-email guard, and destructive `git`/`rm` blocks.
- **`scripts/agy-format.js`** — `PostToolUse` (`edit_file|write_file`) silent auto-formatter using project-local Prettier and `ruff`.
- **`scripts/agy-notify.ps1`** — Persistent Windows toast with colored session badge + sound (`tube-hq.wav` / error sound).
- **`powershell/agy-colors.ps1`** — Wraps `agy` with collision-free distinct text/cursor colors (`OSC 10`/`12`), live tab title + Windows Terminal progress spinner (`OSC 9;4`), and `agyn` for new colored WT tabs.
- **`windows-terminal/agy-profile.json`** — `Antigravity (AGY)` Windows Terminal profile + `Ctrl+Alt+A` (new tab) / `Ctrl+Shift+Alt+A` (split pane) bindings.

## Usage

```powershell
# Preview changes
node gemini-defaults/install.mjs --dry-run

# Install / refresh everything
node gemini-defaults/install.mjs

# Run tests
node --test gemini-defaults/test/gemini-defaults.test.mjs
```
