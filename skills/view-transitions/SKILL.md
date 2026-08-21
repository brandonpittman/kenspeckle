---
name: view-transitions
description: View transitions in Svelte and SvelteKit with kenspeckle — `viewTransition()` for a route navigation or a same-route step, `retreat()` for direction, `viewTransitionName()` for shared-element morphs. Covers registering navigations once from the root layout; direction as a predicate rather than a click-time flag, and why a Back popstate is a retreat for free; steps between two pieces of client state on one URL, which `onNavigate` never sees; the `data-view-transition` attribute contract (`forward` / `retreat` / `step-forward` / `step-retreat`) every animation keys off; named morphs through the `viewTransitionName` attachment, its `when` / `onArrival` claims, and why claims are navigation-only so a stepping element still needs static CSS; the duplicate-name abort that silently kills a whole transition; `<custom-ident>` naming rules and per-item names on lists; what the library already owns (the 600ms `skipTransition` deadline, `settled()` over `tick()`, `prefers-reduced-motion`, SSR, superseded transitions) so none of it gets reimplemented in an app; why a Playwright screenshot of a rendering-suspended page is a false green, and the `start` / `reducedMotion` injection points to unit-test against instead; and an ordered procedure for migrating a repo off the `sveltekit-view-transition` package. Trigger on animating between SvelteKit pages, sliding between steps on one route, shared-element or morph transitions, `onNavigate` + `document.startViewTransition`, `setupViewTransition`, `use:transition`, `view-transition-name`, `prefersReducedMotion` in a transition, or any mention of the `sveltekit-view-transition` package.
---

# View transitions

`npm i kenspeckle`. Peer deps: `svelte >= 5.40`, plus `@sveltejs/kit >= 2` for
the `kenspeckle/kit` subpath, which exists so `$app/navigation` never enters the
main entry.

Verified against kenspeckle 0.1.x. If the installed version disagrees with
anything here, trust its `.d.ts`.

## Don't hand-roll it

The helper looks small enough to be free — one `onNavigate` wrapping navigation
in `document.startViewTransition` — and then you own the freeze deadline, the
`settled()` timing, the reduced-motion skip and the superseded-transition case,
per repo, forever. Those are the parts nobody gets right on the first pass; see
[What the library already handles](#what-the-library-already-handles).

Migrating off the `sveltekit-view-transition` package →
[references/migrating-off-sveltekit-view-transition.md](references/migrating-off-sveltekit-view-transition.md).

What stays yours in every case: **the animation**. The library writes one
attribute and manages one property. Every keyframe is CSS you write.

## Navigations: register once

`src/routes/+layout.svelte`, once:

```svelte
<script lang="ts">
	import { viewTransition } from 'kenspeckle/kit';

	let { children } = $props();

	viewTransition();
</script>

{@render children()}
```

That is `onNavigate` under the hood, so registering per page re-registers on
every mount. Options: `deadline` (ms), `onStart(navigation)`, `onSettle()`, plus
the `reducedMotion` and `start` injection points.

## Direction is a predicate, not a flag

```svelte
<script lang="ts">
	import { retreat } from 'kenspeckle/kit';

	$effect(() => retreat((navigation) => navigation.to?.url.pathname === previousPath));
</script>
```

`retreat()` returns an identity-guarded disposer shaped for `$effect` cleanup —
a stale disposer will not unregister whoever replaced it. It is a single slot,
not a stack: a second call replaces the first, so two components registering
means last-one-wins.

Why a predicate: Kit skips `beforeNavigate` for a navigation begun while another
is in flight, so a flag set at click time can be stranded and then reverse a
later navigation.

A **Back popstate is a retreat without asking** (`delta < 0`, or an absent delta
assumed Back). A Forward popstate is not. The predicate only has to claim the
in-app cases — a "back" button that calls `goto`.

**The argument is kenspeckle's own structural `Navigation`**, not Kit's:
`complete`, `type`, `delta`, and `from` / `to` as `{ url: URL }`. There is no
`route` and no `params` on it, so match on `navigation.to?.url.pathname`; a
`navigation.to?.route.id` comparison does not type-check.

## Steps within a route

`onNavigate` never fires for a transition between two pieces of client state on
one URL — a wizard, a questionnaire walking 1→6, a multi-stage form. Drive the
primitive directly, from the main entry (`kenspeckle/kit` re-exports the same
function, so either import works):

```svelte
<script lang="ts">
	import { viewTransition } from 'kenspeckle';

	let step = $state(0);

	const go = (delta: number) => viewTransition(() => (step += delta), { retreat: delta < 0 });
</script>
```

Pass the state change, not the delta, and one helper serves both a linear
`go(±1)` and a skip-ahead `jumpTo(n)`.

The step form returns the live `ViewTransition` — `undefined` when the
transition was skipped — so a custom WAAPI animation can hang off its `ready`.
Its option and update types live on the main entry only: `/kit` re-exports the
function, not `ViewTransitionOptions` / `ViewTransitionUpdate`.

## The attribute contract

One attribute on `<html>`, absent when idle:

| `data-view-transition` | written by                                            |
| ---------------------- | ----------------------------------------------------- |
| `forward`              | a navigation                                          |
| `retreat`              | a navigation the predicate claims, or a Back popstate |
| `step-forward`         | `viewTransition(update)`                              |
| `step-retreat`         | `viewTransition(update, { retreat: true })`           |

Every animation is yours, keyed off that value:

```css
html[data-view-transition='forward']::view-transition-old(root) {
	animation: 300ms slide-out-left;
}
```

An unprefixed `::view-transition-old(name)` rule matches both kinds, so scope by
attribute value when a step and a navigation must differ. Nothing is written at
all when the transition is skipped, so a rule keyed off the attribute cannot
fire on an unsupported browser or under reduced motion.

## Named elements

```svelte
<button {@attach viewTransitionName('back-button')}>Back</button>
```

`viewTransitionName` claims `view-transition-name` for the transition's duration
and releases it after. Claims are scoped rather than left in static CSS because
**two elements holding one name silently aborts the whole transition** — see the
duplicate trap below.

- `when` claims only for navigations the predicate accepts.
- `onArrival` claims inside the update callback instead, for an element that
  mounts during the transition. A claim belongs to exactly one phase — capture or
  arrival, never both.
- Imperative form takes the element first and returns a disposer:
  `const dispose = viewTransitionName(element, 'back-button')`.

**Claims are navigation-only.** The registration form drives the capture and
arrival phases; `viewTransition(update)` on a same-route step names nothing.
Morph a stepping element with static `view-transition-name` in CSS instead.

**A list↔detail morph is one name in two places.** Same name on the list item
and on the detail hero, and the browser interpolates position, size and content
between the two snapshots — no click tracking, no gating, and it works in both
directions:

```svelte
<img {@attach viewTransitionName(`post-image-${post.id}`)} src={post.image} alt={post.title} />
```

Names are CSS `<custom-ident>`s. Prefix anything generated from data —
`post-image-42`, never a bare `42` — and derive them from a stable id, not the
`{#each}` index, which collides on reorder.

Nothing dedupes claims: the registry is a set of claim objects, never keyed by
name, so two live claims on one name both apply. Uniqueness is yours to
guarantee, which per-item names do by construction.

## The CSS is yours

The pseudo-elements to target: `::view-transition-old(name)` /
`::view-transition-new(name)` for the two snapshots,
`::view-transition-group(name)` for the box that interpolates position and size,
`::view-transition-image-pair(name)` for the crossfade pair. In a component
`<style>` they need `:global(...)` — they are not scoped.

Retune or kill the default page crossfade:

```css
::view-transition-old(root),
::view-transition-new(root) {
	animation-duration: 250ms;
}

/* No page crossfade at all. */
:root {
	view-transition-name: none;
}
```

**With the root group gone, "nothing animates" is often correct rather than
broken.** Only named elements animate, and a pair that sits in the same place on
both screens is imperceptible. Check that something is named on *both* sides
before debugging a missing animation.

**The duplicate-name trap, twice, both silent.** A name must be unique among
rendered elements at capture time; a duplicate makes Chromium abort the
**entire** transition and log `Unexpected duplicate view-transition-name`, so a
whole route stops animating.

- Never hang a name off a shared composition class (`.page-layout`, `.wrapper`,
  `.card`) — one declaration then names every element using it.
- A global rule plus a nested wrapper: a component declaring
  `:global(.back-button) { view-transition-name: back-button }` collides with any
  page that wraps it in `<div class="back-button">` to borrow the styling. Grep
  the class, not the component: `rg 'class="[^"]*back-button'`.

`animation: 0s !important` on the element does **not** suppress its transition —
element rules cannot reach the pseudo-elements. Target
`::view-transition-group(name)` to hold a named element still.

**Long lists:** every named element is a separate snapshot the browser tracks. A
dozen is free, a virtualised hundreds is not — name the card, not each part of
it, and strip the name (`view-transition-name: none`) off items that are
scrolled out of view, or a return morph flies across the screen to an offscreen
target.

## What the library already handles

Do not reimplement any of this in an app, and do not test it there:

- **The freeze deadline.** The update callback suspends rendering for its whole
  lifetime — for a navigation, that is until the navigation completes, so nothing
  paints in between and any loading UI is in the DOM but never painted. A
  `deadline` (600ms by default) arms `skipTransition()`, and it is disarmed on
  `updateCallbackDone` rather than `finished`: armed through the animation it
  would snap a running morph to its end state on an ordinary fast navigation.
- **`settled()`, not `tick()`**, around the update — `tick()` only flushes
  synchronous updates and passes by luck when the subtree contains an `await`.
- **Reduced motion and unsupported browsers.** The update still runs,
  untransitioned, and no attribute is written. It is a real skip, not
  `animation: none`, because `animation: none` still creates the pseudo-elements
  and still freezes rendering — the pause without the animation. So an app needs
  no `@media (prefers-reduced-motion)` block for view transitions.
- **SSR.** `document` is resolved per call, never at module scope.
- **Superseded transitions.** Starting a second skips the first; only the
  survivor clears the attribute and releases the claimed names.
- **Consumer throws.** An `onStart` / `onSettle` throw is reported to the page's
  error handling instead of stranding the transition.

## Don't pixel-test it

While the document is rendering-suspended a Playwright screenshot captures the
**old, frozen frame** — a test can therefore pass while the app is visibly hung.
Screenshots cannot tell a working transition from a frozen one.

Unit-test your own step logic instead, against the two injection points every
entry accepts. `start` replaces `document.startViewTransition` and
`reducedMotion` replaces the `prefersReducedMotion` read, so a test forces
either path without mocking `svelte/motion`:

```ts
viewTransition(update, { start: fakeStart, reducedMotion: () => false });
```

`start` takes the update callback and returns a `ViewTransition`. Keep the
fake's `finished` **deferred** with its own resolver: the real one settles when
the animation ends, long after the update, and that window is what a "cleanup
ran on finish" assertion needs.

**One flake to recognise, not chase.** `<html …> intercepts pointer events`, or
Playwright timing out on `waiting for element to be visible, enabled and
stable`, means a click landed while a real transition was running — "stable"
means *not animating*. Re-run the file alone before concluding anything; if it
reproduces identically on an idle box, it is your change.

## Reference files

- [references/migrating-off-sveltekit-view-transition.md](references/migrating-off-sveltekit-view-transition.md)
  — the ordered removal: audit greps that size the job, `use:transition` →
  `viewTransitionName`, why `applyImmediately` decides whether static CSS is a
  1:1 swap or a widening, `shouldApply` → `when`, `classes` and the lifecycle
  events → the attribute plus `onStart` / `onSettle`.
