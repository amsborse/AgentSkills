# Gemini / Antigravity (`agy`) Defaults

Portable configuration, lifecycle hooks, unified terminal colors/status (`agy` + `claude`), Windows Terminal profile, telemetry, and live feature dashboard for Google Antigravity (`agy`).

## Included

- **`GEMINI.md`** — Concise 1–2 line default response style (`~/.gemini/config/GEMINI.md`).
- **`scripts/agy-session-hook.js`** — Live session status (`Ready`/`Working`/`Done`/`Error`/`Paused`), auto-title from first prompt, and detached notifications.
- **`scripts/agy-pretool-guard.js`** — `PreToolUse` (`run_command`) guardrails: PS 5.1 `&&`/`||` guard, Sutra/Manthan batch-email guard, `.env`/SSH/creds read guard, prod deploy guard, and destructive `git`/`rm` blocks.
- **`scripts/agy-format.js`** — `PostToolUse` (`edit_file|write_file`) silent Prettier + `ruff` auto-formatter.
- **`scripts/agy-handoff.js`** — Context-watch auto-handoff on heavy sessions (`Stop` → `SessionStart`) + `history-learning` (`hl.mjs`) session-start bridge.
- **`scripts/agy-notify.ps1`** — Persistent colored Windows toast + sound + opt-in `ntfy.sh` mobile push (`AGY_NTFY_TOPIC` or `~/.gemini/config/ntfy.json`).
- **`scripts/telemetry.js` & `scripts/collect-stats.mjs`** — Zero-secret local JSONL telemetry (`~/.gemini/config/telemetry/events.jsonl`) and real usage aggregator.
- **`powershell/agy-colors.ps1` & `powershell/claude-colors.ps1`** — Unified collision-free text/cursor colors (`OSC 10`/`12`), live tab titles, WT progress spinner (`OSC 9;4`), and `agyn` tab launcher.
- **`windows-terminal/agy-profile.json`** — `Antigravity (AGY)` WT profile + `Ctrl+Alt+A` / `Ctrl+Shift+Alt+A` bindings.
- **`dashboard/index.html`** — Standalone dark/light feature guide & live usage analytics page.

## Usage

```powershell
# Install / sync everything (also runs automatically from `node scripts/install.mjs`)
node gemini-defaults/install.mjs

# Refresh real usage data into dashboard/index.html (or serve live on http://127.0.0.1:4789)
node gemini-defaults/scripts/collect-stats.mjs
node gemini-defaults/scripts/collect-stats.mjs --serve

# Run tests
node --test gemini-defaults/test/gemini-defaults.test.mjs
```
