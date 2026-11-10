# Archiving raw history after learning

Raw transcripts grow by gigabytes within months. Once `hl` has extracted them, the redacted evidence in the state
directory keeps what was learned even if a session file later disappears: `extract` only
replaces evidence for sessions it re-reads, so a deleted session keeps its statements.

This is the one step that touches history, so it runs only when the user asks for it, after
steps 1–6, and never as part of `learn` or a night loop.

## Order

1. `$HL learn`, then synthesis and staging as usual, so nothing new is left unread.
2. Optionally the agent's own built-in reflection over the same period first (Claude Code:
   the user runs `/insights`, which writes `~/.claude/usage-data/report.html`; it reads
   the same transcripts and stops working for anything deleted).
3. Dry run, then the real run (Windows PowerShell 5.1+):

   ```powershell
   $s = "$HOME\agent-skills\history-learning\scripts\Archive-ChatHistory.ps1"
   & $s -WhatIf
   & $s -Days 7 -Dest <drive with room>\ChatArchive
   ```

## What the script guarantees

- A session is archived whole or not at all: if any file of it (a Claude session's
  `subagents/` or `tool-results/`, an Antigravity database's `-wal`) is newer than the cutoff,
  the whole session stays.
- It never touches Claude `memory/` folders, Codex's state and `thread_history` SQLite
  databases (Codex Memories consolidate from them) or Antigravity's
  `conversation_summaries.db`. It refuses to run while Antigravity is open.
- It never follows junctions or symlinks, and never deletes recursively: files are removed one
  by one and only directories that end up empty are removed.
- Originals are deleted only after every zip entry has been re-read and matched by SHA-256 and
  size against the original. On any failure the archive is discarded or kept as `.partial` and
  nothing is deleted. A file that changed after hashing is kept and reported, with exit 1.
- `MANIFEST.csv` (inside the zip and next to it) lists path, size, time and hash. Entries are
  relative to the home folder, so unzipping over `$HOME` restores them.

## Related settings

Claude Code deletes transcripts older than `cleanupPeriodDays` (default 30) on its own. Raise it
in `~/.claude/settings.json` if `hl` runs less often than that, or the history is gone before
it is learned from. Setting it to 0 turns transcript saving off entirely.
