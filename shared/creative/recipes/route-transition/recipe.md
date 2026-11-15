# Route transition

View changes where a shared element travels to its new place and the rest cross-fades, built on
the View Transitions API. Technique notes: `../../techniques/shared-element-transitions.md` and
`../../techniques/scene-transitions.md`.

**Use for** list-to-detail, tab or step changes, and page navigation where continuity helps
people keep their place. **Not for** every state change: a transition on each small update is
noise.

## Files

`recipe.css` (timing, tier rules, cross-document opt-in), `recipe.js` (same-document helper).

## API

```js
await ExperienceRoute.transition(() => { showDetail(item); }, {
  shared: [{ from: tileEl, to: () => document.querySelector('#hero'), name: 'hero' }]
}); // resolves { animated: true | false }
```

- `update` must change the DOM before it returns (or return a promise that resolves once it has).
- `shared`: elements that should morph. `from` is in the old view; `to` is an element or a
  function returning one in the new view; `name` must be unique on the page.
- Transition names are set only for the duration of the transition, then removed, so a list of
  many tiles never carries duplicate names.
- Multi-page sites: `@view-transition { navigation: auto; }` in `recipe.css` animates same-origin
  page loads with no JavaScript.

## Tiers and fallback

- **No API support, static, reduced motion:** `update` runs at once; `{ animated: false }`.
- **low:** cross-fade only, shared elements are not named.
- **balanced and up:** shared elements travel on a spring; the root cross-fades in 220 ms.

The view always changes, whatever the tier: the transition is decoration on a working update.

## Accessibility

Moving focus is the caller's job and is not optional: after the update, focus the new view's
heading or first control, and return focus to the trigger when going back (the demo does both,
and closes on Escape). Announce the new view through the page's normal route announcer. The
old view is a snapshot during the transition, so keep transitions short.

## Performance

Snapshots are GPU textures of what is on screen; a shared element the size of the viewport
costs a full-screen texture. Keep shared elements modest and transitions under about 500 ms.

## Verify

Open and close by mouse, by keyboard and with `?quality=static`; check focus lands in the new
view each time and that no element keeps a `view-transition-name` afterwards. Automated: "route
transition" in `tests/recipes-browser.test.mjs`.
