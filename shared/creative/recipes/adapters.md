# Using recipes in a framework

The recipes are framework-neutral on purpose: one implementation, a thin lifecycle wrapper per
framework. Every `init` or `mount` returns its own clean-up, which is all a framework needs.
Only the plain HTML demos are tested in this repository; the wrappers below are the lifecycle
pattern, not shipped or tested code. Verify in the project after adapting.

Import the CSS wherever the project imports global styles. Import `_runtime/quality.mjs` (it
loads the classic script and re-exports it) and change each `recipe.js` from a global to an
export when copying it, or keep the classic scripts in a `<script>` tag.

## Rules that hold everywhere

- **Run in the browser only.** Recipes touch `window` and `document`. Call them from the
  framework's mount hook, never during server rendering.
- **One runtime per page.** Use `ExperienceQuality.shared()`. Do not create one per component.
- **Always return the clean-up.** Route changes and hot reload re-run mount hooks.
- **Set the tier before first paint if it is stored.** To avoid a flash from balanced to a
  remembered tier, load `quality.js` as a blocking script in the document head, or set
  `data-quality` on `<html>` from a cookie on the server.
- **The CSS works without JavaScript.** If a wrapper never mounts, the page is still complete.

## React and Next.js

```jsx
'use client';
import { useEffect, useRef } from 'react';

export function FlowHero({ children }) {
  const ref = useRef(null);
  useEffect(() => {
    const flow = ExperienceFlow.mount(ref.current);
    return () => flow.destroy();
  }, []);
  return <section ref={ref} className="flow-hero">{children}</section>;
}
```

Delegated recipes (`ExperienceCursorLight.init()`, `ExperienceMagnetic.init()`,
`ExperienceScroll.init()`) belong once in the root layout's effect, not per component. Strict
mode mounts effects twice in development: the returned clean-up makes that safe.

Next.js App Router: the built-in `viewTransition` support and `route-transition/recipe.js` do
the same job; use one. For client state swaps inside a page, wrap the state update:
`ExperienceRoute.transition(() => flushSync(() => setView(next)))`. `flushSync` matters, because
the DOM must have changed by the time the callback returns.

## Vue and Nuxt

```vue
<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
const el = ref(null);
let flow;
onMounted(() => { flow = ExperienceFlow.mount(el.value); });
onBeforeUnmount(() => flow && flow.destroy());
</script>
<template><section ref="el" class="flow-hero"><slot /></section></template>
```

For transitions, await the DOM: `ExperienceRoute.transition(async () => { view.value = next; await nextTick(); })`.
Nuxt: wrap in `<ClientOnly>` or keep the call in `onMounted`.

## Svelte and SvelteKit

An action is the natural fit:

```svelte
<script>
  const flowHero = (node) => {
    const flow = ExperienceFlow.mount(node);
    return { destroy: () => flow.destroy() };
  };
</script>
<section class="flow-hero" use:flowHero><slot /></section>
```

SvelteKit navigation: call `document.startViewTransition` inside `onNavigate` as the SvelteKit
docs describe, and keep only `route-transition/recipe.css` for the timing and tier rules.

## Astro

Astro's `<ClientRouter />` already provides view transitions; keep `recipe.css` for tier rules
and skip `recipe.js`. Other recipes go in a normal `<script>` in the layout. With the client
router, re-run `init` on `astro:page-load` and clean up on `astro:before-swap`.

## Plain HTML and server-rendered apps

Load the CSS, then the scripts at the end of `<body>` as the demos do. For multi-page apps the
`@view-transition { navigation: auto; }` rule in `route-transition/recipe.css` animates full
page loads with no JavaScript in browsers that support it; others navigate normally.

## Motion libraries

If the project already uses Motion, GSAP or a similar library, keep it for what it already does
and take only the tier rules from a recipe (`:root[data-quality]` selectors and `q.budget`).
Do not add a library to run a recipe: none needs one. See `../selector.md` before installing
anything.
