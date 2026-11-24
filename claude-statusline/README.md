# Claude Code status line

Three lines, fitted to the terminal width (the metrics never disappear; folder, branch, model and
labels shrink first):

```
 PEACH  │  Tools  │  ⎇ main · 23 changed  │  Opus 5.5  │  ██████░░░░ 62%
⏱ 2m · 3/5 · ~1m left │ ⚙ 2 bg guard-batch-email 71M · serena-gate 49M │ this 499M │ all 4× 2.6G
5h 27% ↻ 2h03 │ week 72% ↻ 3d23h │ $4.37 · $2.91/h │ RAM 5.9G free
```

1. Session badge, folder, branch with uncommitted file count, model, context bar (amber at 50%,
   red with ⚠ at 80%).
2. Time on the task with Claude's own plan (steps done and time left, from `scripts/eta.js`),
   this session's background processes with the RAM of each process tree, this session's total
   RAM, and the count and RAM of all Claude Code sessions.
3. 5-hour and weekly plan usage with time until reset (amber at 50%, red at 80%), session cost and
   cost per hour, and free RAM (amber under 20% free, red under 10%).

Windows only for the process numbers: `scripts/statusline-procs.ps1` takes a process snapshot in
the background so drawing the line never waits on it. Collector failures show in red on line 2.

## Install

```
node claude-statusline/install.mjs
```

It copies the files into `~/.claude` (or `CLAUDE_CONFIG_DIR`), keeps a `.bak` of any different
file, and prints the `statusLine` and hook entries to add to `settings.json`. The hooks remind
Claude to record a plan on each prompt and mark it done when Claude stops.

## Plan commands (run by Claude)

```
node ~/.claude/scripts/eta.js plan <steps> <minutes> [note]
node ~/.claude/scripts/eta.js step [note]
node ~/.claude/scripts/eta.js done
```

## Calendar log of finished tasks (optional)

`scripts/claude-task-log.js` logs a finished task to a calendar when Claude stops. It is off until
`~/.claude/claude-task-log.json` names the logger command, and it logs only tasks Claude titled
itself (never the prompt text):

```
node ~/.claude/scripts/claude-task-log.js title "Fix the week panel" --kind fix
node ~/.claude/scripts/claude-task-log.js status
```

The duration is the eta plan's elapsed time (1 to 1440 minutes); the request id is the session
plus the plan start, so a retry writes the same event. The Stop hook returns at once and a
detached worker runs the logger. Every outcome goes to `~/.claude/cache/eta/task-log.log`; a
failure also shows one Windows toast, repeated only when the reason changes or after a success.
Config, for Sutra's desktop app:

```json
{ "command": ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
              "D:/.../Sutra/apps/desktop/scripts/Log-ClaudeTask.ps1"],
  "exe": "D:/.../Sutra.Desktop.exe" }
```

Its Stop hook entry: `node "~/.claude/scripts/claude-task-log.js" hook-stop` (timeout 5).

## Test

```
node --test claude-statusline/scripts/statusline.test.js claude-statusline/scripts/claude-task-log.test.js
```
