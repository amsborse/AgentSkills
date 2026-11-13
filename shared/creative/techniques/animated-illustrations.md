# Animated illustrations

Illustrations, icons and characters that move: an empty-state character that waves, icons
that morph on toggle, an onboarding scene that responds to input.

## Use when

- Empty states, onboarding, success moments, feature explainers, mascots, brand icons.
- The product already has (or commissions) illustration in its language; never generic stock.

## Options

- **SVG + CSS:** animate groups with `transform` and `stroke-dashoffset` for line drawing;
  `d` path morphing where supported or with matching point counts.
- **Rive** (MIT runtime): interactive state machines (hover, click, progress inputs) designed
  in the Rive editor; best for characters that react.
- **dotLottie** (`@lottiefiles/dotlottie-web`, MIT): play After Effects exports; prefer it over
  `lottie-web`.
- **Sprite sheet** with `steps()` for frame-by-frame pixel or hand-drawn art.

## Dependencies

None for SVG/CSS. Rive or dotLottie runtime only when the asset comes from those tools; the
editors are separate (Rive editor is paid). Assets must be owned or licensed by the project.

## Accessibility

Decorative illustrations are `aria-hidden`; meaningful ones have a text alternative. Loops
longer than 5 seconds need a pause control or stop after a few cycles (WCAG 2.2.2).

## Performance

Low for SVG; medium for Rive/Lottie (runtime + file size; check the `.riv`/`.lottie` size).
Pause offscreen; do not autoplay many at once.

## Compatibility

All modern browsers. Rive and dotLottie use WebAssembly + canvas.

## Reduced motion

Show the key pose (a meaningful still frame), not the first frame if that is blank.

## Verify

- Screenshot each state; the still frame under reduced motion is meaningful.
- Asset license or origin noted.
- `visual-audit` offscreen check: no playback when out of view.
