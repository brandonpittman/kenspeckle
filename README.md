<picture>
	<source media="(prefers-color-scheme: dark)" srcset="docs/assets/banner-dark.svg">
	<img src="docs/assets/banner-light.svg" alt="kenspeckle, adjective, Scots, from Old Norse kennispeki: 1. easily recognised; conspicuous; familiar at sight. 2. (of Svelte utilities) knowable from the name alone.">
</picture>

Svelte utilities you recognize at sight: each one is shaped the way Svelte shapes its own APIs, so it reads like something Svelte might have shipped.

## Shaped like Svelte

Every export takes the shape Svelte already uses for the same kind of thing.

- **Global browser state is a singleton with `current`**, like `innerWidth` in `svelte/reactivity/window`: `documentVisible.current`, `activeElement.current`. On the server it is `undefined`, as Svelte's are.
- **A configured value is a class with `current`**, like `new MediaQuery(query)`: `new Idle(60_000)`, `new PersistedState('theme', 'light')`.
- **A value that follows another is a class with `.of(fn)`**, like `Spring.of(() => number)`, called in an effect root such as component init: `Previous.of(() => count)`.
- **A thing you drive with methods is a class**: `new FiniteStateMachine()`, `new StateHistory()`.
- **Element behavior is an attachment.** An element value flows into your own `$state` through a callback, the way a function binding does (`bind:clientWidth={null, setWidth}`), never through a box the library owns.
- **Everything else is a plain function**, with no `use` prefix, which is a React Hooks rule Svelte doesn't have.
- **Nothing Svelte or Kit already does.** A binding, `on()`, `onDestroy`, `<svelte:document>` or an `$effect` with a returned cleanup beats a wrapper around it.

## Attachments, curried

Element-bound utilities are one name in two forms. Options only → returns an [attachment](https://svelte.dev/docs/svelte/@attach). Element first → the imperative helper, cleanup returned.

```svelte
<script>
	// same import, imperative
	const cleanup = clickOutside(node, () => close());
</script>

<div {@attach clickOutside(() => close())}>…</div>
```

An attachment that observes the element hands what it sees to a callback, so the value lives in your state:

```svelte
<script>
	import { intersected } from 'kenspeckle';

	let seen = $state(false);
</script>

<div {@attach intersected((entry) => (seen = entry.isIntersecting))}>…</div>
```

## Install

```sh
npm install kenspeckle
```

Peer dependencies: `svelte >= 5.40`, plus `@sveltejs/kit >= 2` for the `kenspeckle/kit` subpath (optional). SSR-safe — singletons read `undefined` on the server, as Svelte's window values do.

## What's shipped

Seven exports, two entry points, each documented under [`src/routes/docs/`](src/routes/docs/). `kenspeckle` is Svelte-only; `kenspeckle/kit` adds the SvelteKit
pieces, so `$app/navigation` never enters the main entry.

| export                                                                  | form                                   | lineage                    |
| ----------------------------------------------------------------------- | -------------------------------------- | -------------------------- |
| [`FiniteStateMachine`](src/routes/docs/finite-state-machine/+page.md)   | class, with typed reactive `context`   | runed `FiniteStateMachine` |
| [`copy()` / `copyText()`](src/routes/docs/copy/+page.md)                | attachment + helper                    | svelte-put `copy`          |
| [`viewTransition()`](src/routes/docs/view-transition/+page.md)          | function; navigation form under `/kit` | new                        |
| [`viewTransitionName()`](src/routes/docs/view-transition-name/+page.md) | attachment + helper, `/kit`            | new                        |
| [`retreat()`](src/routes/docs/view-transition/+page.md)                 | function, returns a disposer, `/kit`   | new                        |
| [`debounce()`](src/routes/docs/debounce/+page.md)                       | function wrapper                       | runed `useDebounce`        |
| [`throttle()`](src/routes/docs/throttle/+page.md)                       | function wrapper                       | runed `useThrottle`        |

`FiniteStateMachine` gains a typed, `$state`-backed `context` object visible to lifecycle hooks and
guards — the sidecar-data mechanism every real FSM grows, built in.

View transitions are what the package is for so far; they get their own section below.

## Planned

The rest of the curation. These names are the design, not an API you can call — nothing below has
shipped.

| export            | form                                                      | lineage                                                  |
| ----------------- | --------------------------------------------------------- | -------------------------------------------------------- |
| `StateHistory`    | class: `new StateHistory(get, set)`, `.undo()`, `.redo()` | runed `StateHistory`                                     |
| `Idle`            | class: `new Idle(ms)`, `.current`                         | runed `IsIdle`                                           |
| `PersistedState`  | class: `new PersistedState(key, initial)`, `.current`     | runed `PersistedState`                                   |
| `CurrentPosition` | class: `new CurrentPosition(options)`, `.current`         | runed `useGeolocation`                                   |
| `Previous`        | class: `Previous.of(() => x)`, `.current`                 | runed `Previous`                                         |
| `activeElement`   | singleton, `.current`                                     | runed `ActiveElement`                                    |
| `pressedKeys`     | singleton, read like a set: `.has(key)`                   | runed `PressedKeys`                                      |
| `clickOutside()`  | attachment + helper                                       | runed `onClickOutside` · svelte-put `clickoutside`       |
| `focusWithin()`   | attachment, reports to a callback                         | runed `IsFocusWithin`                                    |
| `intersected()`   | attachment + helper, entries to a callback                | runed `useIntersectionObserver` · svelte-put `intersect` |
| `mutated()`       | attachment + helper, records to a callback                | runed `useMutationObserver`                              |
| `scrollState()`   | attachment, element only, reports to a callback           | runed `ScrollState`                                      |
| `autosize()`      | attachment                                                | runed `TextareaAutosize`                                 |
| `shortcut()`      | attachment + helper                                       | svelte-put `shortcut`                                    |
| `lockScroll`      | attachment ≡ helper, stacked lock counting                | new                                                      |
| `dragScroll()`    | attachment                                                | svelte-put `dragscroll`                                  |

Dropped, deliberately, because Svelte or Kit already does it:

- runed's `Context`: Svelte ≥ 5.40's `createContext` returns a typed `[get, set]` pair.
- runed's `Debounced` / `Throttled`: `debounce()` / `throttle()` writing into a `$state`, with any effect that follows a source kept in the component that owns it.
- `elementSize`, `elementRect`, `resized`: the dimension bindings (`bind:clientWidth`, `bind:contentRect`, `bind:borderBoxSize`) already measure with a `ResizeObserver`.
- `inViewport`: `intersected()` with `entry.isIntersecting`.
- `scrollState`'s window form: `<svelte:window bind:scrollY>` and `scrollY.current`.
- `mounted`: `onMount` setting a `$state`.
- `listen`: `on()` from `svelte/events`.
- `interval`, `animationFrames`: an `$effect` that starts the timer or loop and returns its cleanup.
- `onCleanup`: `onDestroy`, or an effect's returned cleanup.
- `watch` / `watchOnce`: an effect responds to state being a certain way, not to it changing; handle the change where it happens.
- `extract`: nothing here takes a value-or-getter.
- `boolAttr`: Svelte omits nullish attributes, so `data-x={flag || undefined}`.

Waiting in the backlog: runed's `resource`, since SvelteKit remote functions cover the server-data case, and `searchParams`, since Kit's `page.url.searchParams` and `goto` cover reads and writes until a typed layer earns its place.

## View transitions

Two entry points. `kenspeckle` exports the same-route form; `kenspeckle/kit` adds the SvelteKit
navigation form, so `$app/navigation` never enters the main entry. The `/kit` subpath expects
`@sveltejs/kit` — an optional peer.

### The contract

One attribute on `<html>`, absent when idle:

| `data-view-transition` | written by                                            |
| ---------------------- | ----------------------------------------------------- |
| `forward`              | a navigation                                          |
| `retreat`              | a navigation the predicate claims, or a Back popstate |
| `step-forward`         | `viewTransition(update)`                              |
| `step-retreat`         | `viewTransition(update, { retreat: true })`           |

Every animation is yours, keyed off that value. An unprefixed `::view-transition-old|new(name)` rule
matches both kinds, so scope it when a step and a navigation must differ.

```css
html[data-view-transition='forward']::view-transition-old(root) {
	animation: slide-out-left 300ms;
}
```

### Navigations

Register once, from the root layout:

```svelte
<script>
	import { viewTransition } from 'kenspeckle/kit';

	viewTransition();
</script>
```

Direction is a predicate, never a flag: Kit skips `beforeNavigate` for a navigation begun while
another is in flight, so a flag set at click time can be stranded and reverse a later navigation.
`retreat()` returns an identity-guarded disposer, shaped for `$effect` cleanup.

```svelte
<script>
	import { retreat } from 'kenspeckle/kit';

	$effect(() => retreat((navigation) => navigation.to?.route.id === '/'));
</script>
```

A Back popstate is a retreat without asking. A Forward popstate is not.

### Steps within a route

`onNavigate` never fires for a wizard advancing its own state, so drive the primitive directly:

```svelte
<script>
	import { viewTransition } from 'kenspeckle';

	let step = $state(0);
	const go = (delta) => viewTransition(() => (step += delta), { retreat: delta < 0 });
</script>
```

The update callback suspends rendering until it settles, which past half a second reads as a hang —
`deadline` (600ms) skips the transition rather than let it. With no `document.startViewTransition`,
or under `prefers-reduced-motion`, the update still runs, untransitioned, and no attribute is
written.

### Named elements

`viewTransitionName` claims `view-transition-name` for the duration of a transition and releases it
after. Two elements holding one name silently abort the whole transition, which is why claims are
scoped rather than left in static CSS.

```svelte
<button {@attach viewTransitionName('back-button')}>Back</button>
```

`when` claims only for navigations it accepts; `onArrival` claims inside the update callback instead,
for an element that mounts during the transition. The imperative form takes the element first and
returns a disposer:

```js
const dispose = viewTransitionName(element, 'back-button');
```

**Claims are navigation-only.** The registration form drives the capture and arrival phases;
`viewTransition(update)` on a same-route step names nothing. Morph a stepping element with static
`view-transition-name` in CSS instead.

## Claude Code plugin

This repo doubles as a Claude Code plugin with two agent-facing guides.
`skills/view-transitions/` covers the view-transition tier — the
`data-view-transition` contract, `viewTransitionName` claims and their phases,
the duplicate-name abort, and the list of things the library already handles so
an agent stops reimplementing them. `skills/finite-state-machine/` covers
`FiniteStateMachine` — the always-transitions rule, the `'*'` re-entry hazard,
lifecycle ordering and context. Point a marketplace entry at this repo
(`.claude-plugin/plugin.json` is at the root) and it installs as `kenspeckle`,
invoked as `/kenspeckle:view-transitions` and `/kenspeckle:finite-state-machine`.
It bundles no MCP server; for the Svelte MCP, install the official `svelte`
plugin from [`sveltejs/ai-tools`](https://github.com/sveltejs/ai-tools).

The skill and the code ship in the same change, same rule as the docs pages.

## Provenance

kenspeckle is a curation, not a fork. [runed](https://runed.dev) has genuinely useful utilities under three naming regimes at once — PascalCase classes, bare functions, and React-style `use` hooks, with pairs like `Debounced` / `useDebounce` coexisting. [svelte-put](https://svelte-put.vnphanquang.com) has good actions from the Svelte 4 era, before attachments existed. kenspeckle reshapes both pools under one convention and adds what neither ships: attachments as a first-class layer.

Portions adapted from runed (MIT) and svelte-put (MIT). kenspeckle is MIT.
