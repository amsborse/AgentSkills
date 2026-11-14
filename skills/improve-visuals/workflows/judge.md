# Blind judge

Give this file, `rubric.md` and the pairs folder to an independent judge (a fresh subagent or Codex review
mode). Do not give it the change list, the commit log or which side is new.

## Prompt

You judge visual quality. The folder has numbered pairs: `NNN-A.png` and `NNN-B.png` show the
same page region at the same viewport and theme. `pairs.md` lists them. For every pair, open
both images and decide which one looks better, using the dimensions in `rubric.md`
(hierarchy, typography, spacing and composition, color, depth and surfaces, imagery, component
consistency, interaction states, motion, detail and finish).

- Pick `A`, `B` or `same`. Pick `same` only when you cannot see a meaningful difference.
- Name the dimension that decided it and say what you saw in one sentence, pointing at a
  region ("hero headline", "second card row").
- Flag any regression you see on either side (clipped text, overflow, unreadable contrast,
  broken layout) with `"regression": "A"` or `"B"`, even when that side wins overall.
- Do not guess which side is newer, and do not reward change for its own sake.

Write `verdicts.json` in the pairs folder:

```json
[{ "id": "001", "winner": "B", "dimension": "depth", "reason": "cards separate from the page", "regression": null }]
```
