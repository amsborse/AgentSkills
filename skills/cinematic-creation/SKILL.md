---
name: cinematic-creation
description: Turn a creative brief into a cinematic short film: script, storyboard, shot prompts, original music, editing and automated review, on free or local backends with paid generators gated. Use for "make a cinematic film", "storyboard this", "score this film" or "review this cut".
license: MIT
metadata:
  aliases: "make a cinematic film, make a short film, cinematic video, film from this brief, storyboard this, shot list, write shot prompts, score this film, edit the rough cut, review this cut, animatic"
  keywords: "cinematic, film, cinematography, storyboard, shot list, camera, score, music, sound design, editing, transitions, color grade, text-to-video, image-to-video, animatic, render, continuity, pacing"
  capabilities: "creative direction, story, screenwriting, storyboarding, cinematography, camera, editing, music, sound design, review, rendering"
  composes: "research, verify, coordinate-agents, build-animation"
  requires: "video-render?, image-generation?, video-generation?, audio-synthesis?"
  risk: "medium"
  version: "1.0.0"
---

# Cinematic creation

One workflow from brief to finished film, for any genre and any backend. It distils three MIT
sources (Higgsfield `skills`, Higgsfield `code-based-films`, latent-spaces `brag`); credits and
what was taken from each are in `references/sources.md`.

## Laws

- **Feeling first.** Name the one feeling the viewer leaves with and the turn that earns it. Every
  shot has an intent; a shot without one is cut.
- **One cut file.** The whole film is a timed shot list (`templates/cut.json`): world, start,
  duration, intent, camera, transition, prompt, avoid, caption, sound. Every backend renders from
  it; nothing renders until it validates.
- **Animatic before assets.** Lock timing as a rough cut under the music, judge it in motion,
  then spend on final pictures. Stills hide edit problems.
- **Every frame stands alone.** Restraint over spectacle: no oversaturation, artificial glow,
  random particles, impossible places or constant camera motion. Stillness is part of the language.
- **Grounded.** Facts, names and quotes are real; tone and images are free to invent.
- **Free and local first.** Never call a paid generator, voice or music service without explicit
  approval for that run. Unknown cost means stop and ask. Record actual cost, even when it is $0.
- **Reproducible.** Prompts, seeds, settings, backend and licences go in `provenance.json`.

## Phases and gates

| Phase | Owner (capability) | Gate |
| --- | --- | --- |
| 1 Brief and direction | creative direction | feeling, arc, worlds, three loglines; one chosen |
| 2 Script and structure | screenwriting, story | reads without words; hook within 2 s; turn at 25-35 % |
| 3 Storyboard and shots | storyboarding, cinematography | `cut.json` validates; every cut changes size or angle |
| 4 Music and sound plan | music, sound design | cue map timed to the cut; licence is original or cleared |
| 5 Rough cut / animatic | editing, rendering | full-length render with score; contact sheet of real frames |
| 6 Review and iterate | review | rubric scored; weakest shots fixed; at most 3 passes |
| 7 Final render, export | editing, rendering | H.264 yuv420p, faststart, poster frame, provenance, cost |

## Roles are capabilities, not models

Any agent can hold any role. A role loads this file plus the references tagged with its
capabilities. One agent may hold several roles on a small film. The lead (creative direction)
owns the cut file and acceptance; others hand back proposals.

## References

- `references/story-and-direction.md`: brief, feeling, arc, worlds, loglines, captions.
- `references/cinematography.md`: shot sizes, motivated movement, light, match transitions.
- `references/generation.md`: the prompt compiler, text- and image-to-video, continuity, cost gate.
- `references/editing-and-presentation.md`: rhythm, transitions, grade, captions, export.
- `references/music-and-sound.md`: score form, cue map, mix levels, original synthesis.
- `references/quality-review.md`: rubric, machine pass, fresh-eyes review, fix format.
- `references/roles.md`: role briefs and handoffs.
- `templates/`: `brief.md`, `cut.json`, `provenance.json`, `review.md`.
