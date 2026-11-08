<script>
	import PageHeading from '../PageHeading.svelte';
</script>

<PageHeading slug="idle" />

Whether the user has gone idle, read through `current` and shared across the tabs of one origin.

```ts
import { Idle } from 'kenspeckle';
```

## Reading it

Pass the timeout in milliseconds. `current` turns `true` once that long passes with no `pointermove`, `pointerdown`, `keydown` or `wheel` on the window, and back to `false` on the next one:

```ts
const idle = new Idle(15 * 60 * 1000);
```

```svelte
{#if idle.current}
  <p>Still there?</p>
{/if}
```

Hiding the tab is not activity: the timer keeps running in a background tab, and hiding it doesn't make it idle at once either. A browser may throttle timers in a tab hidden for a while, Chrome to once a minute after five minutes, so `current` can turn `true` up to about a minute late there.

Listeners and the timer exist only while an effect or `$derived` reads `current`, and are removed when the last one is destroyed. Activity is sampled at most once a second, so `current` can turn `true` up to a second late, which doesn't matter at minute-scale timeouts.

With no effect or `$derived` reading it, nothing watches for activity, so a read from an event handler or a `setInterval` reports `true` once the timeout has passed since the last activity seen while something was reading it, however active the user is. Read `current` from an effect, a `$derived` or the template, and let event handlers read what those already hold.

## Across tabs

Activity in one tab keeps every tab of the same origin awake. Each tab broadcasts its activity on a `BroadcastChannel` named `kenspeckle:idle` and works out idle from the latest activity it has heard about, its own or another tab's. Only activity is broadcast, never idle state.

## Acting on it

There is no idle callback. Respond to the value in an effect, written in a component script:

```ts
const idle = new Idle(15 * 60 * 1000);

$effect(() => {
  if (idle.current) signOut();
});
```

## On the server

There is no user to watch on the server, so `current` is `undefined` there. Test `current === true` rather than `!current` when the server render must count as active.
