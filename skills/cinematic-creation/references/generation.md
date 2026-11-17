---
capabilities: animation, motion, rendering, look development, visual style, art direction
---

# Generation (text-to-video, image-to-video, procedural)

## Pick the backend from what is authorised, not from memory

1. List what is installed and approved for this run: a local renderer (Remotion, WebGL, a path
   tracer, Blender), a local image or video model, or a paid service.
2. For a model service, read its live model list and parameter schema. Never invent a model name,
   preset, voice id or parameter.
3. Paid generation needs explicit approval for this run. Before any paid job: settle every input,
   check tools, estimate the cost with the service's own estimator, write it down, and stop if
   anything is missing. Keep a job ledger; never resubmit while a job is still running.
4. With no approved generator, render procedurally from code (every frame a pure function of time,
   seeded randomness) and keep the per-shot prompts in the cut file for a later generated pass.

## Prompt compiler (one prompt per shot, from the cut file)

`subject + setting + light + camera (size, lens, move) + style + texture`, under about 200 tokens.

- Text-to-video: the full description, present tense, one subject, one action.
- Image-to-video: describe only the motion of the camera and the subject; never redescribe the
  still. "Slow push in, ripples spread from the centre, mist drifts left."
- Edits and variations: describe only the change.
- Phrase negatives positively: "tack sharp, natural colour, soft daylight" instead of "no blur,
  no oversaturation". Put the rest in the shot's `avoid` field for services that take one.
- Realism words that help: photographed, 35 mm film grain, natural light, overcast, shallow depth
  of field, handheld, documentary. Words that hurt: epic, magical, ethereal, glowing, 8k,
  hyper-detailed, fantasy.

## Continuity

- One style key image (or a look description) reused for every shot; check the first clip for
  drift before generating the rest.
- A roster of recurring people, places and props, each with its reference id. Pass the previous
  shot's frame or id as a reference for the next variation in a sequence.
- Keep wardrobe, time of day, weather and screen direction stable inside a world.
- Reference images are targets, not content, unless their licence allows use.

## Procedural looks

When rendering from code, build each look as a function of time and a seed, in a small number of
reusable layers: sky, far plane, water, light shaft, grain. Restraint carries realism: soft
gradients, slow motion, low contrast in the shadows, grain over everything, colour from light
temperature rather than saturation.
