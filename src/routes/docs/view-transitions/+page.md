# View transitions

Four exports across two entry points work together. `kenspeckle` holds the one that works anywhere; `kenspeckle/kit` holds the ones that need SvelteKit's router, so `$app/navigation` never enters the main entry.

```ts
import { viewTransition } from 'kenspeckle';
import { enableViewTransitions, retreat, viewTransitionName } from 'kenspeckle/kit';
```

| export                                                   | entry  | for                                        |
| -------------------------------------------------------- | ------ | ------------------------------------------ |
| [`enableViewTransitions`](/docs/enable-view-transitions) | `/kit` | every navigation, registered once          |
| [`retreat`](/docs/enable-view-transitions)               | `/kit` | which navigations animate in reverse       |
| [`viewTransitionName`](/docs/view-transition-name)       | `/kit` | an element that morphs across a navigation |
| [`viewTransition`](/docs/view-transition)                | main   | a step within one route, such as a wizard  |

`kenspeckle/kit` expects `@sveltejs/kit`, an optional peer.

## The contract

For the life of a transition, `<html>` carries one attribute, absent when idle:

| `data-view-transition` | written by                                            |
| ---------------------- | ----------------------------------------------------- |
| `forward`              | a navigation                                          |
| `retreat`              | a navigation the predicate claims, or a Back popstate |
| `step-forward`         | `viewTransition(update)`                              |
| `step-retreat`         | `viewTransition(update, { retreat: true })`           |

Every animation is yours, keyed off that value. An unprefixed `::view-transition-old(name)` rule matches both kinds, so scope it when a step and a navigation must differ:

```css
html[data-view-transition='forward']::view-transition-old(root) {
  animation: slide-out-left 300ms;
}
```

## 1. Navigations

In the root layout's script, register once:

```ts
import { enableViewTransitions } from 'kenspeckle/kit';

enableViewTransitions();
```

Every client-side navigation now runs inside a transition.

## 2. Direction

A Back popstate is a retreat without asking. For anything else that should animate backward, register a predicate from the component that knows, and return its disposer from an `$effect`:

```ts
import { retreat } from 'kenspeckle/kit';

$effect(() => retreat((navigation) => navigation.to?.route.id === '/'));
```

It's a predicate rather than a flag because Kit skips `beforeNavigate` for a navigation begun while another is in flight, so a flag set at click time can be left behind and reverse a later navigation.

## 3. Named elements

`viewTransitionName` names an element for the transition it takes part in, then releases the name. Two elements holding one name silently abort the whole transition, which is why the name is claimed per transition rather than left in static CSS:

```svelte
<button {@attach viewTransitionName('back-button')}>Back</button>
```

Claims belong to navigations only. A same-route step names nothing, so an element that should morph on a step gets a static `view-transition-name` in CSS instead.

## 4. Steps within a route

`onNavigate` never fires for a wizard advancing its own state on one URL, so call `viewTransition` where the state changes. In the component script:

```ts
import { viewTransition } from 'kenspeckle';

let step = $state(0);
const go = (delta: number) => viewTransition(() => (step += delta), { retreat: delta < 0 });
```

## What all of them share

The update suspends rendering until it settles, which past half a second reads as a hang, so the transition is skipped after 600ms. With no `document.startViewTransition`, or under `prefers-reduced-motion`, the update still runs, untransitioned, and no attribute is written.
