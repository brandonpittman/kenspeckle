<script>
	import PageHeading from '../PageHeading.svelte';
</script>

<PageHeading slug="copy" />

Copy text to the clipboard on an event. `copy(options)` returns an **attachment**. Its companion `copyText` is the bare clipboard primitive.

```ts
import { copy, copyText } from 'kenspeckle';
```

The copy buttons on every code block in these docs are this utility.

## As an attachment

Call `copy(options)` and attach the result to any element. It listens for the event (default `click`) and copies:

With a `copied` flag declared as `let copied = $state(false)` in your component script:

```svelte
<button
  {@attach copy({
    text: 'https://kenspeckle.dev',
    onCopy: () => (copied = true)
  })}
>
  {copied ? 'Copied' : 'Copy link'}
</button>
```

The attachment only runs in the browser, so it is SSR-safe by construction.

## Outside a template

An attachment is a function of the element, so call it on one. It returns a cleanup function:

```ts
const cleanup = copy({ text: 'copied!' })(node);

// later
cleanup();
```

## What gets copied

`text` is a string, or a function given the node that returns a string — sync or async. Omit it and the node's own `textContent` is copied:

```ts
// a fixed string
copy({ text: 'literal' })(node);

// resolved from the node
copy({ text: (el) => el.dataset.value ?? '' })(node);

// an async source
copy({ text: async () => (await fetch('/token')).text() })(node);

// default: the element's own text
copy({})(node);
```

## Options

```ts
copy({
  // string | (node) => string | Promise<string>
  text,
  // event name or array of names; default 'click'
  event: 'click',
  // set false to wire nothing
  enabled: true,
  // called with the copied text after a successful copy
  onCopy: (text) => {}
});
```

`onCopy` is the feedback channel — flip a `$state` flag, show a toast, revert a label after a timeout. It fires with the exact text that was written.

## copyText

The bare primitive: write a string to the clipboard, no element or event involved. It uses `navigator.clipboard` with an `execCommand` fallback for older or non-secure contexts.

```ts
import { copyText } from 'kenspeckle';

async function share(url: string) {
  await copyText(url);
}
```

Reach for `copy` when a trigger element drives the copy; reach for `copyText` when you already hold the text.
