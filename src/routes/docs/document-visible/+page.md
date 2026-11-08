<script>
	import PageHeading from '../PageHeading.svelte';
</script>

<PageHeading slug="document-visible" />

Whether the page is visible, as a singleton read through `current` — the document counterpart of Svelte's `svelte/reactivity/window` values.

```ts
import { documentVisible } from 'kenspeckle';
```

## Reading it

`documentVisible.current` is `true` while the page is visible and `false` while it is hidden: a background tab, a minimized window, a locked screen. Read it anywhere — in markup, a `$derived`, an effect, or plain module code — and it returns the live value:

```svelte
<p>{documentVisible.current !== false ? 'Watching' : 'Away'}</p>
```

Read inside an effect or a `$derived`, it re-runs when visibility changes. The `visibilitychange` listener is added when the first effect reads it and removed when the last one is destroyed, so any number of readers share one listener.

## On the server

There is no document on the server, so `current` is `undefined` there, as `innerWidth.current` is. To gate work on visibility, test `current !== false` rather than `current`, so server rendering counts as visible. A poll that pauses while the tab is hidden, written in a component script:

```ts
$effect(() => {
  if (documentVisible.current !== false) {
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }
});
```

## When a binding is enough

Inside a single component, Svelte's own binding already covers it:

```svelte
<svelte:document bind:visibilityState />
```

Reach for `documentVisible` when the value is needed outside a component — in a `.svelte.ts` module, a class, or a helper shared across components — where there is no `<svelte:document>` to bind.
