<script>
	import PageHeading from '../PageHeading.svelte';
</script>

<PageHeading slug="debounce" />

Wrap a function so a burst of calls runs it once, after `wait` ms of quiet, with the latest arguments.

```ts
import { debounce } from 'kenspeckle';

const search = debounce(fetchResults, 300);
```

## Calling it

Every call resets the timer and returns a promise. All the calls since the last run share one promise, which resolves with that run's result:

```ts
const first = search('a');
const last = search('ab');

// both resolve with fetchResults('ab')
await last;
```

An async callback is awaited. The promise rejects only when the callback throws or rejects.

`wait` defaults to 250 and is read once, when the wrapper is created. For a wait that changes, derive a new wrapper and cancel the old one. A replaced wrapper keeps its timer, so without the cancel a call it already scheduled still runs, and one burst runs the callback twice:

```ts
const search = $derived(debounce(fetchResults, delay));

$effect(() => {
  const current = search;
  return () => current.cancel();
});
```

The cleanup also runs when the component unmounts, so this covers teardown too.

## pending

`search.pending` is a reactive boolean: true while a call is scheduled, false once the callback starts. Read it in markup or a `$derived` like any other state:

```svelte
<input aria-label="Search" oninput={(event) => search(event.currentTarget.value)} />
<p role="status">{search.pending ? 'Waiting for you to stop typing…' : 'Up to date'}</p>
```

## flush and cancel

```ts
// run the scheduled call now
search.flush();

// drop it
search.cancel();
```

`flush()` runs the scheduled call with the latest arguments and settles the shared promise. With nothing scheduled, it does nothing.

`cancel()` clears the timer. The shared promise is left unsettled rather than rejected, so a fire-and-forget call in an event handler never raises an unhandled rejection. The next call starts a new promise.

## A debounced value

There is no `debounced()`. Debounce the write into a `$state` instead:

```ts
let query = $state('');
const setQuery = debounce((value: string) => (query = value), 300);
```

```svelte
<input aria-label="Search" oninput={(event) => setQuery(event.currentTarget.value)} />
<p role="status">{setQuery.pending ? 'Waiting…' : `Results for ${query}`}</p>
```

To follow a prop or a `$derived` instead of an input, call it from an `$effect`:

```ts
$effect(() => {
  setQuery(search);
});
```

A `debounced()` value would need that same effect inside it, and then it could only be created during component init. Written here, the effect belongs to the component that owns `search` and is disposed with it. Read `setQuery.pending` in markup, never in that effect: an effect that reads it reruns each time the timer settles, and schedules itself again.

## Teardown

The wrapper holds no effect and no subscription, so it works anywhere: a module, a class, a component. Nothing tears it down for you. A component that must not run a scheduled call after it unmounts cancels in its own cleanup:

```ts
import { onDestroy } from 'svelte';

onDestroy(search.cancel);
```
