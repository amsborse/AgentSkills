# Sources and licences

This skill rewrites ideas from three MIT-licensed skills in its own words; no text, code, music or
assets are copied. Read on 2026-11-12 at the commits below.

| Source | Licence | Commit | Taken |
| --- | --- | --- | --- |
| [higgsfield-ai/skills](https://github.com/higgsfield-ai/skills) (`higgsfield-generate`, `higgsfield-faceless-video`), v0.14.0 | MIT | `27000402` | prompt formula and length, image-to-video motion-only prompts, positive phrasing of negatives, "discover models from the live schema", the cost gate before paid jobs, narration words per 10 s and rewrite-not-speed-up, style key, roster and job ledger for continuity, shot-size prefixes and the hook/build/turn/payoff arc |
| [higgsfield-ai/higgsfield-video-engineer](https://github.com/higgsfield-ai/higgsfield-video-engineer) (`code-based-films`) | MIT | `082bfd7b` (main) | animatic before final assets, motivated eased camera moves, decisive cuts and the 180-degree rule, light standard (key plus rim, two temperatures, dark base), music-first timing, frame-pure determinism, machine QA pass, fresh-eyes reviewer, ACCEPT/FIX/REBUILD and the fix-line format, one narrow task per agent |
| [latent-spaces/brag](https://github.com/latent-spaces/brag), v0.5.0 | MIT (code and text); its bundled music is CC BY 4.0 and its effects CC0, none of which this skill uses | `669ab928` | gated steps, reading-time numbers ("fast in, then hold"), tone presets with numeric pacing, beat-lock tolerances, mix levels, grounded facts versus free invention, poster frame and share copy, checking stills mid-transition |

## Not used

- No Higgsfield model, credit or account is assumed: every Higgsfield generation is paid in
  platform credits, so it is reachable only through the paid-generation gate.
- Brag's renderer (HeyGen Hyperframes) and its music are not required; any local renderer works.
- The Higgsfield path tracer and its optional rented GPUs are not required.

## Added here

The world structure, match-transition table, rubric, role table and the cut-file contract are this
skill's own; none of the three sources has a full shot taxonomy or a cut file shared by every
backend.
