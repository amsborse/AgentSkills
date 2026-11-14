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

## Test

```
node --test claude-statusline/scripts/statusline.test.js
```
