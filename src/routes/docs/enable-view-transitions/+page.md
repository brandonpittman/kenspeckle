<script>
	import PageHeading from '../PageHeading.svelte';
</script>

<PageHeading slug="enable-view-transitions" />

Run every SvelteKit client-side navigation inside a view transition. It's the navigation counterpart of [`viewTransition`](/docs/view-transition), and it keeps the same guarantees: a deadline, a bail under reduced motion, and no stray `AbortError`.

```ts
import { enableViewTransitions, retreat } from 'kenspeckle/kit';
```

The [view transitions guide](/docs/view-transitions) shows how it fits with `viewTransition` and `viewTransitionName`.

## Turning it on

It registers an `onNavigate` handler, so call it once, at init, in a root layout's script:

```ts
import { enableViewTransitions } from 'kenspeckle/kit';

enableViewTransitions();
```

Every client-side navigation now runs inside a transition, and nothing else is required. A shallow navigation, one that changes the URL with no new route, is left alone, since there's no arrival to animate to. To animate a change within one route, call `viewTransition(update)` where it happens.

During a navigation the document element carries `data-view-transition="forward"` or `"retreat"`. Author your keyframes against it as described under [the attribute](/docs/view-transition#the-attribute). [`viewTransitionName`](/docs/view-transition-name) names the elements that should morph between pages.

## Direction

`retreat` registers a predicate that decides which navigations animate in reverse. It is consulted per navigation, at transition time:

```ts
import { retreat } from 'kenspeckle/kit';

retreat((navigation) => navigation.to?.url.pathname === previousStep);
```

A backward `popstate`, the browser's Back button, is always a retreat, whatever the predicate returns. Forward is an ordinary forward navigation, which the predicate can still claim.

It returns a disposer that unregisters the predicate, so a predicate registered by a component can live and die with it. Return it straight from an `$effect` and Svelte runs it as the cleanup:

```ts
$effect(() => retreat((navigation) => navigation.to?.url.pathname === previousStep));
```

Without that, the predicate outlives the page that registered it and keeps closing over dead state for the rest of the session. The disposer only unregisters its own predicate, so a late cleanup can't clobber a newer registration.

Register a predicate, never set a flag at click time. SvelteKit skips `beforeNavigate` for a navigation begun while another is still in flight, so a flag set by one click can be left behind and reverse a later, unrelated navigation.

When the path you compare against is configured rather than observed, note that Kit strips the trailing slash from `navigation.to`, so `'/profile/gender/'` never equals it. Normalize both sides with Kit's `normalizeUrl`:

```ts
import { normalizeUrl } from '@sveltejs/kit';

const path = (value: string) => normalizeUrl(value).url.pathname;

retreat((navigation) => path(navigation.to?.url.pathname ?? '') === path(previousStep));
```

## Options

```ts
enableViewTransitions({
  // ms before the transition is skipped; past this a crossfade reads as a hang
  deadline: 600,
  // runs synchronously before the old snapshot is captured, with the navigation
  onStart: (navigation) => hideCloak(navigation),
  // runs once the transition settles
  onSettle: () => showCloak(),
  // return true to skip the transition entirely
  reducedMotion: () => prefersReducedMotion.current
});
```

There is no `retreat` option; the predicate above decides direction. A throw out of `onStart` or `onSettle` goes to the page's global error handling via `reportError` and goes no further: the transition still runs, the attribute is still cleared, and the navigation still completes.
