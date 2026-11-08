# kenspeckle docs

_kenspeckle_ (Scots): easily recognized, familiar at sight. Svelte 5 utilities shaped the way Svelte shapes its own APIs — singletons and classes with `current`, attachments for element behavior, no `use` prefix.

See the [roadmap](/docs/roadmap) for what's shipped and what's coming, and the [recipes](/docs/recipes) for what Svelte and the platform already cover.

## Classes

- [FiniteStateMachine](/docs/finite-state-machine) — fully typed FSM with reactive context
- [Countdown](/docs/countdown) — milliseconds left until a deadline
- [PersistedState](/docs/persisted-state) — a value synced to localStorage or sessionStorage

## Values

- [documentVisible](/docs/document-visible) — page visibility, a document singleton

## Attachments

- [copy](/docs/copy) — clipboard attachment
- [scrollEdges](/docs/scroll-edges) — which scroll edges an element has reached
- [viewTransitionName](/docs/view-transition-name) — name an element for the transition it takes part in

## Functions

- [viewTransition](/docs/view-transition) — a view transition around an update; `enableViewTransitions` for navigation
- [debounce](/docs/debounce) — debounce any function, with a shared promise
- [throttle](/docs/throttle) — throttle any function, leading and trailing
