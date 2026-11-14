# Drag interactions

Users move things directly: reorder lists, swipe cards, scrub sliders, pan canvases, throw
items with momentum.

## Use when

- Reordering, sorting into groups, carousels, comparison sliders, maps and boards, playful
  objects. Only where dragging is the natural verb.
- Never as the only way to do something.

## Options

- **Pointer Events** by hand: `pointerdown` + `setPointerCapture`, track deltas, write
  transforms in rAF, release with inertia (velocity × decay).
- **Motion:** `drag`, `dragConstraints`, `dragElastic`, `Reorder` components.
- **GSAP Draggable + InertiaPlugin** when GSAP is already used.
- **dnd-kit** (React) for accessible sortable lists with keyboard sensors.
- Native HTML drag and drop only for files and simple cross-window drops.

## Dependencies

None for Pointer Events. Library only if already present or accessibility support is needed
(dnd-kit has keyboard sorting built in).

## Accessibility

Provide a keyboard and button alternative (move up/down, arrow keys, a menu). Announce
reorders with a live region. Visible grab affordance and focus states. Do not block page
scrolling on touch (`touch-action` set only on the drag handle).

## Performance

Medium. Transform during drag; commit layout once on drop. Avoid reading layout per move.

## Compatibility

Pointer Events everywhere. Test touch with a real device or Playwright touch emulation.

## Reduced motion

Keep direct manipulation (it is user-driven) but remove fling inertia and bounce-back
animations; snap to the final position.

## Verify

- Drag with mouse and touch emulation; item follows without lag; drop commits correctly.
- Complete the same task with the keyboard only.
- `visual-audit` keyboard check passes; page still scrolls on mobile.
