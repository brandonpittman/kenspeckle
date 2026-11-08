<script>
	import PageHeading from '../PageHeading.svelte';
</script>

<PageHeading slug="throttle" />

Wrap a function so it runs at most once per `wait` ms: the first call right away, and the latest call of the window once the window ends.

```ts
import { throttle } from 'kenspeckle';

const track = throttle(sendPosition, 100);
```

## Calling it

A call with no window open runs at once and opens a `wait` window. Its promise resolves with the result, or rejects if the callback throws; it never throws synchronously.

Calls inside the window store the latest arguments and share one trailing promise. They don't extend the window. When it ends, the stored call runs with the newest arguments, its promise settles, and a new window opens. With nothing stored, the window closes and the next call leads again.

```ts
// runs now
track(0, 0);
// stored
track(5, 5);
// replaces the stored call: runs at 100ms with (10, 10)
track(10, 10);
```

There are no leading or trailing options: both edges always run, so the first and the last value of a burst always arrive.

`wait` defaults to 250 and is read once, when the wrapper is created. For a wait that changes, create a new wrapper.

## pending

`track.pending` is a reactive boolean, true while a trailing call is stored:

```svelte
<p role="status">{track.pending ? 'Catching up…' : 'In sync'}</p>
```

## cancel

```ts
track.cancel();
```

`cancel()` drops the stored trailing call and closes the window, so the next call leads. The trailing promise is left unsettled rather than rejected, so a fire-and-forget call never raises an unhandled rejection.

There is no `flush()`: the leading call already runs at once.

## Teardown

The wrapper holds no effect and no subscription, so it works anywhere: a module, a class, a component. A component that must not run a stored call after it unmounts cancels in its own cleanup:

```ts
import { onDestroy } from 'svelte';

onDestroy(track.cancel);
```
