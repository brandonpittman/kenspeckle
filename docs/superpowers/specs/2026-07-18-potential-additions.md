# kenspeckle — potential additions

**Date:** 2026-07-18
**Status:** Backlog; nothing here is committed to v0
**Parent spec:** [2026-07-18-kenspeckle-design.md](./2026-07-18-kenspeckle-design.md)

Utilities considered and deferred, with the rationale. Promotion requires a real consumer need, not completeness.

## `resource()` / `resourcePre()` (runed)

Reactive async wrapper: tracks reactive deps, runs a fetcher, exposes `current` / `loading` / `error`.

**Why deferred:** SvelteKit remote functions obviate the dominant case — client component wanting server data keyed on reactive inputs. `query` gives typed RPC, `.current`/`.loading`/`.error`, refresh/invalidation, batching, single-flight mutations, at the framework level. Same platform-obviation logic that dropped `Context` for `createContext`.

**The asymmetry that keeps it backlog rather than hard-dropped:** `Context` was obviated by Svelte itself (every consumer has it); `resource` is obviated by Kit's experimental layer (some consumers, someday). Still-uncovered niches:

- Client-only async sources: IndexedDB, device APIs, third-party SDKs, wasm, direct external-API calls without a server hop.
- Non-Kit consumers: plain Vite+Svelte SPAs, Tauri, embedded widgets.

**Promotion trigger:** a concrete client-only async need in a real project. Ports cleanly — no Kit dependency.

## svelte-put backlog

`movable`, `swipeable`, `inline-svg`, `toc`, `qr` — port on demand, same conventions (per parent spec).
