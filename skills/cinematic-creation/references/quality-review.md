---
capabilities: review, quality, critique, continuity, consistency
---

# Quality review and iteration

Review the rendered film, never the plan alone. Missing evidence (no frame, no render, no audio
measurement) scores as a fail.

## 1. Machine pass

- The cut file validates (contiguous timeline, target length, caption limits, every world used).
- From the render: duration and frame count match the cut; no black or frozen stretches that were
  not planned; scene changes land at the planned cut times; loudness, true peak and clipping are
  within the export targets.
- Contact sheet: one real frame from the middle of every shot, and one from the middle of every
  dissolve.

## 2. Rubric (score 1-5, with one line of evidence each)

| Dimension | 5 looks like |
| --- | --- |
| Emotion | the arc is felt without the captions; the turn lands |
| Story | each shot's intent is visible; the film reads without words |
| Visuals | every frame stands alone; natural light; no AI-fantasy tells |
| Camera | movement is motivated and follows the arc; at least one true hold |
| Continuity | screen direction, light and palette hold inside each world; matches align |
| Pacing | pressure feels compressed, release feels spacious; no shot outstays its intent |
| Music and sound | the score supports the arc; silence at the turn; clean mix, no clicks |
| Captions | readable, short, held long enough, never over the subject |

## 3. Fresh eyes

Give a reviewer with no context only the film (or the contact sheet and score) and ask: what is
it about, where did it lose you, and what looks cheap, templated or repeated?

## 4. Verdict and fixes

- ACCEPT (every dimension 4+), FIX (a dimension at 3), REBUILD (any 1-2, or the turn does not land).
- Write each fix as `shot <id> (<start>-<end> s): what is wrong - why it matters - concrete fix`.
- Fix the weakest shots first, re-render, and score again. Stop after three passes and report what
  is still weak instead of looping.
- Log every pass (scores, fixes, what changed) in `review.md`, so the iteration is visible.
