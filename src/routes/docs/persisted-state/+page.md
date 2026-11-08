<script>
	import PageHeading from '../PageHeading.svelte';
</script>

<PageHeading slug="persisted-state" />

A value kept in `localStorage` or `sessionStorage`, read and written through `current` — configured at construction, like Svelte's `new MediaQuery(query, fallback)`.

```ts
import { PersistedState } from 'kenspeckle';

const theme = new PersistedState('theme', 'light');
const draft = new PersistedState('draft', '', { storage: 'session' });
```

`storage` is `'local'` (the default) or `'session'`.

## Reading and writing

Reading `current` returns what is stored under the key, or `initial` when nothing is. Assigning it writes to storage straight away:

```svelte
<button onclick={() => (theme.current = theme.current === 'light' ? 'dark' : 'light')}>
  {theme.current}
</button>
```

Nothing is written until the first assignment, so changing `initial` in a later release still reaches every user who never changed the value. There is no `remove()`: assign `initial` to reset.

Values go through [devalue](https://github.com/sveltejs/devalue), so a `Date`, `Map`, `Set`, `URL` or `BigInt` comes back as itself. A class instance does not: assigning one throws at the assignment. devalue does not promise a stable format across versions, so a stored entry that no longer parses reads as `initial` until the next assignment replaces it. Keep the key to entries `PersistedState` wrote: a plain JSON array written by `JSON.stringify` or another library parses as devalue without failing and reads back as the wrong value.

## Assign, don't mutate

`current` is not deeply reactive, the same as `page.data` or a `Spring`'s `current`. An assignment is what persists, and the assigned value keeps its identity. In development an assigned or stored array or plain object, and `initial`, is frozen one level deep, so a top-level mutation that would never reach storage throws instead of failing silently. A nested object or array is not frozen, and mutating one does not persist either. Assign a new value:

```ts
todos.current = [...todos.current, todo];
```

A `Date` or `Map` is not frozen, but mutating one in place does not persist either. Neither is a `$state` object or array you assign. To edit a stored value as `$state`, copy it first, since a frozen value cannot be edited through `$state` in development:

```ts
let form = $state({ ...settings.current });
```

## Staying in sync

Read inside an effect, a `$derived` or markup, `current` updates when another tab writes the key or clears storage, and when another `PersistedState` on the same key in this page writes it. Every assignment that reaches storage dispatches a `storage` event on `window` so that other instances in the page hear it; any `storage` listener of your own sees those events too.

The browser fires no `storage` event in the page that calls `clear()` or `removeItem()`, so no instance in this page sees its own page clear storage. Assign `initial` to reset instead.

When storage refuses a write (a full quota, storage blocked by the browser), the value stays in memory for the life of the page, in the instance that was assigned only, and a warning is logged in development. Other instances on the same key keep what storage holds.

## On the server

During server-side rendering there is no way to know what is stored, so `current` is `initial`, and content may change on hydration. A `PersistedState` created at module level is one instance shared by every request on the server; create it in a component, or share it through context, when an assignment could happen during rendering.
