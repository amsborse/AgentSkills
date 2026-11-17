---
capabilities: music, score, audio, sound design, ambience, foley, voice direction
---

# Music and sound

## Plan the score with the cut

- Write a cue map from the cut file: the time of every turn, entrance and resolution. Big events
  land on downbeats; captions and cuts in a pressure section lock to the beat within 0.1-0.15 s;
  above 110 BPM snap text to every other beat.
- Give each world its own sound: urgency with pulse, tight harmony and mechanical rhythm; nature
  with open intervals, air and slow swells; intimacy with one close instrument and room tone.
- Silence is a cue. A hard drop to near-silence at the turn is the strongest edit in the film.
- End on resolution: the tonic, a held note, then a few seconds of ambience or nothing.

## Original music

- Prefer original music (composed, performed or synthesised) or a licence that clearly allows the
  use; record which in `provenance.json`. Never use a track because it is easy to find.
- Paid music or voice generators need the same approval as paid video.
- When synthesising locally (numpy or a DAW), give instruments human life: slow attacks, vibrato
  that develops after the note starts, breath noise for winds, small timing and tuning
  differences between voices, and a shared reverb so they sit in one room.
- A solo melodic instrument (flute, bansuri, cello, voice) carries the feeling; a soft pad or
  string bed carries the harmony underneath. Do not let both move at once.

## Sound design

- Ambience per world (city hum, water, wind in leaves, birds), entering a little before the
  picture and leaving a little after it.
- Spot effects start 0-0.1 s before the visual event they belong to.
- Clocks, traffic and phones are rhythm in the urgency world; let them accelerate into the turn.

## Mix

- Music at about 0.3-0.4 of full scale under effects, never above 0.5; under voice duck it to
  0.12-0.15. Effects 0.55-0.85.
- Fade every element over at least 20 ms; cut music only on bar lines with a 10-30 ms crossfade.
- Master to about -14 LUFS integrated, true peak at or below -1 dBTP; no clipping.
- An agent cannot listen. Measure loudness and peaks, check for clicks, and ask a person to listen
  before final acceptance.
