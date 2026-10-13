# Reviewing, approving, synchronizing and undoing

## What the user reviews

1. `~/.agent-history-learning/reports/learning.md`: coverage, extracted knowledge by category,
   the strongest and most repeated signals, every proposal with its evidence clusters and
   confidence, rejected clusters with reasons, and conflicts.
2. The `learning/<date>` branch in each affected repository: `git diff main...learning/<date>`.
3. Any rule's evidence: `$HL evidence <cluster-id>` prints every redacted statement behind it.

## Approving

Approval is a normal Git merge done by the user (or a pull request they open and merge).
Because skills are installed as links, merging into the checkout that `~/agent-skills` points
to makes the change live in Claude Code, Codex, OpenCode and Cursor at once. For project skills,
merging in that project is enough. To approve only some rules, edit the branch before merging.

## Synchronizing

- Other machines: `git pull` in their agent-skills checkout, then `scripts/install.sh` when a
  skill was added (the installer links new skill folders and leaves existing ones alone).
- New conversations: `$HL learn` (manually, from a night loop, or from a scheduled task) keeps
  evidence current without model calls. When it reports new clusters, start an agent session
  with this skill to synthesize them into a new `learning/<date>` branch.
- ShadowClone: see `shadowclone.md`. Its learned rules stay in ShadowClone's own store until
  you apply them there. Fold them into this repository through the same branch review.

## Undoing

| Undo | How |
| --- | --- |
| A proposal not yet merged | `git branch -D learning/<date>` |
| A merged change | `git revert <commit>` (and push) |
| Stop reading a source | `$HL consent --disable <source>`, then `$HL forget --source <source>` |
| Stop model review | `$HL consent --model deny` |
| All derived data | `$HL forget` (deletes evidence, clusters, digests, reports; history untouched) |
| ShadowClone learning | `shadowclone learning disable`, `shadowclone history`, `shadowclone undo <revision>`, `shadowclone forget --all` |

Nothing in this workflow modifies the original transcripts or databases, so there is never
anything to restore there.
