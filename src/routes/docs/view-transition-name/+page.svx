<script>
	import PageHeading from '../PageHeading.svelte';
</script>

<PageHeading slug="view-transition-name" />

Name an element so it morphs across a navigation instead of crossfading with the page. `viewTransitionName` names it just before the old frame is captured and clears the name once the transition settles — nothing is named while idle, which is what keeps a name available to whichever element should claim it next.

```ts
import { viewTransitionName } from 'kenspeckle/kit';
```

It needs `viewTransition()` registered in your root layout; the navigation is what drives it.

## As an attachment

```svelte
<img src={photo.url} alt="" {@attach viewTransitionName('hero')} />
```

Attach the same name to an element on the destination screen and the two morph into each other.

## Imperative form

Pass an element first to wire it directly. It returns a cleanup function:

```ts
const cleanup = viewTransitionName(node, 'hero');

// later
cleanup();
```

Element first → imperative helper. Name only → attachment. The presence of the element picks the mode.

## Claiming a name from a list

Only one element may carry a given name during a transition. Twenty thumbnails all named `hero` abort the transition outright — so a list needs a gate. `when` receives the navigation and decides whether this element is the one:

```svelte
{#each photos as photo (photo.id)}
  <a
    href={resolve(`/photo/${photo.id}`)}
    {@attach viewTransitionName('hero', {
      when: (navigation) => navigation.to?.url.pathname === `/photo/${photo.id}`
    })}
  >
    <img src={photo.thumb} alt="" />
  </a>
{/each}
```

Each attachment closes over its own item, so only the one being navigated to claims the name. This is why static CSS cannot express the canonical morph: it has no navigation to gate on.

## Elements that arrive during the transition

The default moment for naming is before the old frame is captured, which only reaches elements already on the outgoing page. The destination half of a morph does not exist yet at that point — it mounts *during* the transition, after the DOM commits and before the new frame is captured. That window is the only one it can join, and `onArrival` is how you ask for it:

```svelte
<img src={photo.url} alt="" {@attach viewTransitionName('hero', { onArrival: true })} />
```

Use it on the incoming element, the plain form on the outgoing one. An element present on both sides needs neither — the default moment already covers it.

## Scope

This is navigation-scoped: it participates in transitions started by `viewTransition()`, not in a direct `viewTransition(update)` call within a route. An element that should animate on a same-route step wants a plain CSS `view-transition-name` instead, since nothing has to arbitrate who claims it.

## Options

```ts
viewTransitionName('hero', {
  // claim the name only for navigations this returns true for
  when: (navigation) => true,
  // claim inside the update callback, for an element that mounts during the transition
  onArrival: false
});
```
