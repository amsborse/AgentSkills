# Shared-element transitions

An element travels from its place in one state to its place in the next (thumbnail to detail,
card to modal, list to page) instead of disappearing and reappearing. This is the owner's
"things travel to their new place" rule.

## Use when

- Navigation between list and detail, opening and closing panels, reordering, filtering.
- Any product type; on Operate surfaces keep it fast (≤250 ms).

## Options

- **View Transitions API:** `document.startViewTransition(update)`, `view-transition-name` on
  the shared element; style with `::view-transition-*` pseudo-elements.
  Framework integration: Next.js/React `<ViewTransition>` (experimental), Astro, SvelteKit
  `onNavigate`.
- **Motion:** `layout` and `layoutId` props, `AnimatePresence` for exit.
- **FLIP by hand:** measure first and last rects, invert with transform, play with WAAPI.

## Dependencies

None for View Transitions or FLIP. Motion if the project is React and already uses it.

## Accessibility

Move focus to the new view's heading or the opened element; announce route changes for screen
readers. Transitions never block input for long.

## Performance

Low to medium. View Transitions snapshot the page; very large pages or many named elements cost
memory. Name only the elements that travel. Avoid animating `width/height` directly (FLIP or
the API handles it with transforms).

## Compatibility

Same-document View Transitions: Baseline since Oct 2025. Cross-document (`@view-transition`):
not Baseline; feature-detect and fall back to an instant swap. Unique `view-transition-name`s
per page or the transition aborts.

## Reduced motion

Cross-fade only (or instant), no travel: `@media (prefers-reduced-motion: reduce)
{ ::view-transition-group(*) { animation-duration: 0s } }` or a short fade.

## Verify

- Click through each transition: the element visibly travels, no flash of the old state.
- Frame captures mid-transition; check both themes.
- Keyboard: focus lands where expected after the transition.
