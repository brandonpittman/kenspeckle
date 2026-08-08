<script>
	import PageHeading from '../PageHeading.svelte';
</script>

<PageHeading slug="view-transition" />

Run a DOM update inside a CSS view transition. `viewTransition` handles the parts every hand-rolled version gets wrong: a deadline so a slow update cannot read as a hang, a reduced-motion bail that skips the transition entirely, and handlers on all three transition promises so a skip never logs an `AbortError`.

```ts
import { viewTransition } from 'kenspeckle';
```

SvelteKit apps import from the `/kit` entry point instead, which adds navigation:

```ts
import { viewTransition, retreat, viewTransitionName } from 'kenspeckle/kit';
```

## Around a DOM update

Pass the update. It runs inside the transition, and the browser animates from the old frame to the new one:

```ts
viewTransition(() => {
  step += 1;
});
```

The update may be async — await whatever has to land before the new frame is captured. In a Svelte 5 app with async components, that means `settled()`:

```ts
import { settled } from 'svelte';

viewTransition(async () => {
  step += 1;
  await settled();
});
```

If the browser lacks the API, or the user prefers reduced motion, the update still runs — it just runs without a transition. That is a bail, not a fallback: a view transition suspends rendering for the whole update, so animating nothing is not the same as not transitioning.

## On navigation

From `kenspeckle/kit`, call it with no update at all. It registers an `onNavigate` handler, so it belongs in a root layout's script — once, at init:

```ts
import { viewTransition } from 'kenspeckle/kit';

viewTransition();
```

Every client-side navigation now runs inside a transition. Nothing else is required.

## Direction

`retreat` registers a predicate that decides which navigations animate in reverse. It is consulted per navigation, at transition time:

```ts
import { retreat } from 'kenspeckle/kit';

retreat((navigation) => navigation.to?.url.pathname === previousStep);
```

A backward `popstate` — the browser back button — is always a retreat, whatever the predicate returns. Forward is an ordinary forward navigation, which the predicate can still claim.

It returns a disposer that unregisters the predicate, so a predicate registered by a component can live and die with it — return it straight from an `$effect` and Svelte runs it as the cleanup:

```ts
$effect(() => retreat((navigation) => navigation.to?.url.pathname === previousStep));
```

Without that, the predicate outlives the page that registered it and keeps closing over dead state for the rest of the session. The disposer is identity-guarded: it only unregisters its own predicate, so a late cleanup cannot clobber a newer registration.

Register a predicate, never set a flag at click time. SvelteKit skips `beforeNavigate` for a navigation begun while another is still in flight, so a flag set by one click can be left behind and reverse a later, unrelated navigation. There is no boolean that closes this.

One trap when the path you compare against is configured rather than observed: Kit strips the trailing slash from `navigation.to`, so `'/profile/gender/'` never equals it and the predicate matches nothing. Normalize both sides — Kit exports `normalizeUrl` for exactly this:

```ts
import { normalizeUrl } from '@sveltejs/kit';

const path = (value: string) => normalizeUrl(value).url.pathname;

retreat((navigation) => path(navigation.to?.url.pathname ?? '') === path(previousStep));
```

## The attribute

For the life of a transition, the document element carries one attribute:

```
data-view-transition="forward" | "retreat" | "step-forward" | "step-retreat"
```

It is absent when idle. `forward` and `retreat` are navigations; the `step-` pair is a direct `viewTransition(update)` call — a step within the same route, whose duration and easing usually differ. Author keyframes against it:

```css
[data-view-transition='retreat']::view-transition-old(profile-content) {
  animation: slide-out-right 200ms both;
}
```

Pass `retreat: true` to a direct call to get `step-retreat`:

```ts
viewTransition(() => (step -= 1), { retreat: true });
```

## Controlling the root snapshot

By default the browser names the whole document `root` and crossfades it. There are three positions, and a consumer hitting a duration surprise is usually in the first without knowing it:

1. Leave it alone — the UA crossfade. Nothing to write.
2. `::view-transition-group(root) { animation-duration: 0s }` — still captured, not animated.
3. `:root { view-transition-name: none }` — not captured at all, so only elements you name animate.

```css
:root {
  view-transition-name: none;
}
```

2 and 3 look identical when the unnamed remainder of the page is the same across screens. Prefer 3 for two reasons: it avoids a full-viewport snapshot pair on every navigation, and it takes the root out of the timing. The UA default is `0.25s`, so while root animates it governs the transition's length — which means `finished`, and therefore the attribute removal and `onSettle`, fire later than the visible motion ends.

## Options

```ts
viewTransition(update, {
  // reverse direction — writes step-retreat
  retreat: false,
  // ms before the transition is skipped; past this a crossfade reads as a hang
  deadline: 600,
  // runs synchronously before the old snapshot is captured
  onStart: () => {},
  // runs once the transition settles, resolved or rejected — not when a later transition supersedes it
  onSettle: () => {},
  // return true to skip the transition entirely
  reducedMotion: () => prefersReducedMotion.current
});
```

A throw out of `onStart` or `onSettle` is handed to the page's global error handling via `reportError` and goes no further: the transition still runs, the attribute is still cleared, and a navigation still completes.

The navigation form takes the same options except `retreat` — that is what the predicate is for — and its `onStart` receives the navigation:

```ts
viewTransition({
  onStart: (navigation) => hideCloak(navigation),
  onSettle: () => showCloak()
});
```
