# kenspeckle — design

**Date:** 2026-07-18
**Status:** Approved design; repo scaffolded via sv create

*kenspeckle* (Scots, from Old Norse *kennispeki* / Norwegian *kjennespak*, "quick at recognizing"): easily recognized, familiar at sight.

## Problem

runed has useful utilities but three naming regimes at once: PascalCase classes (19), bare functions (8), `use`-prefixed functions (9) — with pairs like `Debounced`/`useDebounce` coexisting. The `use` prefix is React Hooks cargo cult; Svelte has no such rule. Many classes are forced (`IsMounted` is ~10 lines of trivia; `IsInViewport` wants to be an attachment). Upstream looks unmaintained (~7 months idle). Nobody ships a Svelte attachments library yet.

## Decision

New library, not a fork. Curate runed's utilities, reshape under one convention, add attachments as a first-class layer. Name: `kenspeckle`. Scaffold via `sv create`.

## Naming convention

**The sentence test.** Say it in a sentence:

- "I want a new finite state machine" ✓ → class, PascalCase
- "I want a new element size" ✗ → factory function, camelCase
- "I want a new is idle" ✗ → nonsense; predicates are functions

Rules:

1. **Class** only when "new X" is speakable AND you drive it with methods. Exactly two: `FiniteStateMachine`, `StateHistory`.
2. **Everything callable is camelCase.** No `use` prefix, ever. No `is` prefix either — predicates are bare words read as implicit questions (Ruby `?` feeling): `mounted()`, `idle()`, `documentVisible()`. Callers can write `const isMounted = mounted()` — the question lives in the library, the answer in their variable.
3. Whether a class sits behind a factory is an implementation detail.

## Layering: helpers → attachments

Imperative helpers are the primitives: `(element, options) => cleanup`. Attachments are one-line curried sugar (sveltput action+helper pattern, updated): `(options) => (element) => helper(element, options)`.

**One name, curried.** Element as first arg → imperative helper; options-only → returns an attachment. TypeScript overloads type both:

```svelte
<div {@attach clickOutside(() => close())}>

<script>
	// imperative, same import
	const cleanup = clickOutside(node, () => close());
</script>
```

**Readable-box pattern** for value-producing attachments (`inViewport`, `elementSize`, `elementRect`, `scrollState`, `focusWithin`): the factory returns a function-with-reactive-getters that IS the attachment:

```svelte
<script>
	const size = elementSize(); // no target yet
</script>

<div {@attach size}>…</div>
<p>{size.width} × {size.height}</p>
```

Same export works imperatively with a getter: `elementSize(() => node)`. Arg presence picks the mode.

Element-bound utilities are attachment-first; a non-attachment form exists only where a non-element target does (`documentVisible`, `scrollState(window)`).

## Disposition of runed's utilities

| runed | kenspeckle | form |
| --- | --- | --- |
| `FiniteStateMachine` | `FiniteStateMachine` | class, + typed reactive context (below) |
| `StateHistory` | `StateHistory` | class |
| `Context` | — | **dropped**: Svelte ≥5.40 `createContext` returns typed `[get, set]` |
| `IsMounted` | `mounted()` | value factory |
| `IsIdle` | `idle()` | value factory |
| `IsDocumentVisible` | `documentVisible()` | value factory |
| `IsFocusWithin` | `focusWithin()` | attachment, readable box |
| `IsInViewport` | `inViewport()` | attachment, readable box |
| `ElementSize` | `elementSize()` | attachment, readable box |
| `ElementRect` | `elementRect()` | attachment, readable box |
| `ScrollState` | `scrollState()` | attachment, readable box; window form |
| `TextareaAutosize` | `autosize()` | attachment |
| `onClickOutside` | `clickOutside()` | attachment + curried helper |
| `useIntersectionObserver` | `intersected()` | attachment + curried helper |
| `useResizeObserver` | `resized()` | attachment + curried helper |
| `useMutationObserver` | `mutated()` | attachment + curried helper |
| `Debounced` | `debounced()` | value factory |
| `Throttled` | `throttled()` | value factory |
| `useDebounce` | `debounce()` | function wrapper |
| `useThrottle` | `throttle()` | function wrapper |
| `Previous` | `previous()` | value factory |
| `ActiveElement` | `activeElement()` | value factory |
| `PressedKeys` | `pressedKeys()` | value factory |
| `PersistedState` | `persisted()` | value factory |
| `AnimationFrames` | `animationFrames()` | value factory |
| `useGeolocation` | `geolocation()` | value factory (kept — free to carry) |
| `useEventListener` | `listen()` | wiring |
| `useInterval` | `interval()` | wiring |
| `useSearchParams` + helpers | `searchParams()` + helpers | value factory (the 2100-line keeper) |
| `resource` / `resourcePre` | unchanged | already functions |
| `watch` / `watchOnce` | unchanged | wiring |
| `extract` | unchanged | wiring |
| `onCleanup` | unchanged | wiring |
| `boolAttr` | unchanged | helper |

Nothing else dropped.

## svelte-put coverage

svelte-put's actions (Svelte-4 era) are the second source pool after runed — reborn as kenspeckle attachments, same curried dual-form (helper + attachment; svelte-put's own copy/copyToClipboard pattern, generalized). Low-hanging fruit only in v0; the rest is backlog.

| svelte-put | kenspeckle | notes |
| --- | --- | --- |
| `clickoutside` | `clickOutside()` | already in spec (runed overlap) |
| `intersect` | `intersected()` | already in spec (runed overlap) |
| `resize` | `resized()` | already in spec (runed overlap) |
| `copy` | `copy()` | v0: attachment + imperative clipboard helper, one curried name |
| `shortcut` | `shortcut()` | v0: attachment; window-level helper form too |
| `lockscroll` | `lockScroll` | v0: port from brain-life-platform, not svelte-put (`src/lib/attachments/lock-scroll.ts` + `body-scroll-lock.svelte.ts`). Degenerate curried case: imperative `(node) => cleanup` IS the attachment signature — `{@attach lockScroll}` uncalled, `lockScroll(node)` imperative, `lockScroll(opts)` curried. BLP's body counter generalizes to a per-element lock count inside: stacked locks need matching releases; `lockBodyScroll()` ≡ `lockScroll(document.body)`; reactive predicate `scrollLocked(node)` replaces `bodyScrollLocked()`. Pairs with `scrollbar-gutter: stable` |
| `dragscroll` | `dragScroll()` | v0: attachment |
| `movable`, `swipeable`, `inline-svg`, `toc`, `qr` | backlog | port on demand, same conventions |
| `preaction`, `preprocess-*` | — | out: Svelte-4 glue / preprocessors |
| `async-stack`, `avatar`, `popover`, `ui`, `cloudflare-turnstile` | — | out: components / service-specific |

## FiniteStateMachine: typed reactive context

runed's FSM holds only finite state; real apps grow sidecar data mechanisms (see cq-test-web's `TestSession`, whose design is the requirements spec here). kenspeckle owns its FSM, so context goes in properly:

```ts
const machine = new FiniteStateMachine<States, Events, Ctx>(initial, states, {
	context: { n: 0, results: [] }, // $state-backed, typed
});
machine.context.n; // reactive
// lifecycle fns + guards receive it: _enter({ from, to, event, context })
```

- Third generic defaults to `undefined`; no-context API stays identical to runed's.
- Context reactive by default; visible to `_enter`/`_exit`/handlers/guards.
- Domain verbs stay out — wrapper classes (TestSession-style) remain the pattern for app APIs; built-in context deletes their getter-boilerplate sidecars.

## Docs site

The scaffold's showcase app (`src/routes`) is the docs site, deployed to Cloudflare Workers via `@sveltejs/adapter-cloudflare` (already configured). Splink env conventions apply: Kit config inline in `vite.config.ts`, `wrangler.jsonc` vars as env source of truth.

## Constraints

- Peer dep `svelte >= 5.40` (createContext; 5.49+ context-in-tests niceties available to consumers).
- Helpers usable outside component init where feasible (explicit cleanup returned).
- SSR-safe: value factories return inert defaults on server.

## Testing

- TDD. Unit + browser tests via vitest-browser-svelte.
- `npm run check` (svelte-check) after every change.

## Unresolved questions

- `animationFrames()` has start/stop controls — machine-ish; confirm factory (not class) still feels right at implementation.
- New attachments beyond the runed + svelte-put pools: separate list after v0 ports.
- Readable-box typing: function-with-getters vs `Object.assign` vs class-with-`Symbol`-call — pick during implementation.
- License/attribution for ported runed code (MIT — carry NOTICE?).
