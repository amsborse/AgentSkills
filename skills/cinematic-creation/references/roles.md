---
capabilities: creative direction
---

# Roles and handoffs

Roles are described by capabilities, so any agent (any model, any host) can take any of them. A
small film can give several roles to one agent; a large one gives each role its own agent. One
agent works on one narrow, checkable task, and no two agents edit the same file: the lead owns
the cut file and merges proposals.

| Role | Capabilities it loads | Hands back |
| --- | --- | --- |
| Creative director (lead) | creative direction, story | brief, feeling, worlds, chosen logline, acceptance |
| Screenwriter | screenwriting, narration | beats, captions, narration lines |
| Storyboard artist | storyboarding, shot list | panels and the draft shot list |
| Cinematographer | cinematography, camera, lighting | size, lens, move, light and matches per shot |
| Generation specialist | animation, rendering, look development | per-shot prompts, renders, provenance |
| Music director | music, score | cue map, score file, licence |
| Sound designer | sound design, ambience | ambience and effects per world, the mix |
| Editor | editing, pacing, captions | timed cut, transitions, grade, export |
| Quality reviewer | review, quality, continuity | rubric scores, verdict, fix list |

## Brief for each role

Every task brief names: the goal in one sentence, the inputs (paths), the exact output (path and
format), the check that proves it is done, and what is out of scope. Bad task: "make the film".
Good task: "write prompts for shots 8-11 in `cut.json` from their intent and camera fields, under
200 tokens each, phrased positively".

## Handoffs

brief (lead) -> beats and captions (screenwriter) -> shot list (storyboard, cinematographer) ->
cue map (music) -> prompts and renders (generation) -> rough cut (editor) -> review (reviewer) ->
fixes (owners of the weak shots) -> final cut (editor) -> acceptance (lead).
