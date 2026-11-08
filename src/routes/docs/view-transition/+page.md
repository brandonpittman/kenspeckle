<script>
	import PageHeading from '../PageHeading.svelte';
</script>

<PageHeading slug="view-transition" />

Run a DOM update inside a CSS view transition. `viewTransition` handles the parts every hand-rolled version gets wrong: a deadline so a slow update cannot read as a hang, a reduced-motion bail that skips the transition entirely, and handlers on all three transition promises so a skip never logs an `AbortError`.

```ts
import { viewTransition } from 'kenspeckle';
```

Navigations use [`enableViewTransitions`](/docs/enable-view-transitions) from `kenspeckle/kit`. The [view transitions guide](/docs/view-transitions) shows how the pieces fit together.

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
  // runs once the transition settles, resolved or rejected — not when a later transition supersedes it
  onSettle: () => {},
  // return true to skip the transition entirely
  reducedMotion: () => prefersReducedMotion.current
});
```

A direct call has no `onStart`: code that must run before the old snapshot is captured runs before the call.

A throw out of `onSettle` is handed to the page's global error handling via `reportError` and goes no further: the attribute is still cleared.
