---
name: finite-state-machine
description: Typed finite state machines in Svelte with kenspeckle's `FiniteStateMachine` class — states as a string union, events as a payload map of argument tuples, handlers that are a target state or a function returning one, `_enter` / `_exit` lifecycle, the `'*'` fallback, typed deeply reactive `context`, per-event `debounce`, and sharing a machine through Svelte's `createContext`. Covers why returning a state always transitions (returning the current state re-enters it, firing `_exit` and `_enter` again) and `undefined` is the guard; the re-entry hazard of a `'*'` catch-all and the declared no-op that fixes it; synchronous sends from inside lifecycle functions and why a transition finished inside `_exit` aborts the outer one; the reserved `_enter` / `_exit` names; the dev-only unhandled-event warning and declaring a no-op to keep it meaningful; keeping domain verbs out of the machine behind a wrapper; and SSR. Trigger on a wizard, a multi-step flow, a questionnaire, a status that moves between named phases, a `$state` string compared in many `if`s, hand-rolled `status = 'loading' | 'error'` bookkeeping, `new FiniteStateMachine`, `machine.send`, `machine.current`, or any request for a state machine, statechart, or XState-like helper in a Svelte app.
---

# Finite state machine

`npm i kenspeckle`. Peer dep: `svelte >= 5.40` (`createContext`). One of exactly
two classes in the library, and it passes the sentence test: "I want a _new
finite state machine_."

```ts
import { FiniteStateMachine } from 'kenspeckle';
```

Verified against kenspeckle 0.1.x. If the installed version disagrees with
anything here, trust its `.d.ts`.

## When to reach for it

Two or more named phases, with rules about which moves are legal. A boolean or
a lone `$state` string with no rules does not need one. A `status` that several
`if`s compare, or a flow whose next step depends on the current one, does.

## Typed states and events

States are a string union. Events are a **payload map**: each event declares its
argument tuple, and `send` is checked against it.

```ts
type States = 'idle' | 'searching' | 'done';

type Events = {
	search: [query: string];
	cancel: [];
};

const machine = new FiniteStateMachine<States, Events>('idle', {
	idle: { search: 'searching' },
	searching: { cancel: 'idle', search: 'searching' },
	done: {}
});

machine.send('search', 'red');
```

A missing payload and an unknown event are both compile errors. Every state in
the union must have a block, even an empty one. `machine.current` is
`$state`-backed, so templates and deriveds track it.

`_enter` and `_exit` are reserved. Never use them as event names.

## Handlers

A handler is a **string target** or a **function** that receives
`{ from, event, args, context }` and returns the next state:

```ts
searching: {
	cancel: 'idle',
	result: ({ args: [query] }) => (query.length > 0 ? 'done' : undefined)
}
```

- A returned state **always transitions**. Returning the current state
  re-enters it: `_exit` and `_enter` fire again. There is no silent self-move.
- `undefined` vetoes. The machine stays, no lifecycle fires. A guard is a
  handler that returns `undefined`; there is no separate guard concept.
- `send` returns the resulting state.

Meta is narrowed per state block: inside `idle`, `from` is `'idle'`, and
narrowing `event` narrows `args`.

### The `'*'` fallback

An event or lifecycle function missing from the current state falls back to
`'*'`. A state's own handler always wins.

```ts
'*': { reset: 'idle' }
```

**Re-entry hazard.** `'*': { complete: 'complete' }` means a second
`send('complete')` re-enters `complete` and re-runs its `_enter` side effects.
Declare the event on the target state as an explicit no-op:

```ts
complete: {
	reset: 'idle',
	complete: () => {}
}
```

## Lifecycle

On a transition: old `_exit`, then `current` changes, then new `_enter`.

```ts
searching: {
	_enter: ({ from, to, event, args, context }) => {},
	_exit: ({ from, to, event, args, context }) => {}
}
```

Construction fires a synthetic `_enter` for the initial state with
`{ from: null, event: null, args: [] }`, so narrow on `from` before reading the
event. A single `_enter` on `'*'` observes every state that has none of its own.

Sends from inside lifecycle functions run synchronously, with no queue. A send
from `_enter` runs after the state is set and the outer `send` returns the final
state. A transition completed inside `_exit` supersedes the outer one, which
aborts.

## Context

The third generic is typed, deeply reactive extended state. When declared the
constructor requires it; when not, the option cannot be passed.

```ts
type Ctx = { attempts: number; results: string[] };

const machine = new FiniteStateMachine<States, Events, Ctx>('idle', states, {
	context: { attempts: 0, results: [] }
});
```

Handlers and lifecycle functions get the live context and mutate it directly;
deep mutation is reactive. `machine.context = next` reassigns the whole value
and stays reactive.

Keep domain verbs out of the machine. When consumers need an API richer than
`send`, wrap it in a class or factory that exposes those verbs.

## Debounce

```ts
machine.debounce('search', 300, query);
```

Keyed per event: re-debouncing one event resets its timer, different events do
not interfere. The wait defaults to 500ms. Every coalesced call's promise
resolves with the resulting state when the trailing send fires, so a superseded
call never hangs. `send` and `debounce` are pre-bound, so they pass straight to
event handlers.

## Dev warning

In dev only, sending an event with no handler in the current state or `'*'`
logs `kenspeckle: unhandled event 'x' in state 'y'`. If dropping an event is
intentional, such as keyboard events fired at the machine in every state,
declare a no-op where they should be dropped so the warning stays meaningful
everywhere else.

## Sharing a machine

No wrapper needed; `createContext` from `svelte` covers it. Build the machine in
a factory that also sets it, call the factory from the parent layout, and call
the getter in any descendant:

```ts
import { createContext } from 'svelte';

const [getWizard, setWizard] = createContext<WizardMachine>();

export function createWizard(initial: WizardStep = 'intro') {
	const machine = new FiniteStateMachine<WizardStep, WizardEvents, WizardCtx>(initial, states, {
		context: { attempts: 0, answers: [] }
	});
	setWizard(machine);
	return machine;
}

export { getWizard };
```

File must be `.svelte.ts`. The machine is plain reactive state with no DOM
access, so it constructs fine on the server and outside component init.

## Pairing with view transitions

A step machine is the natural driver for same-route transitions. Send inside
`viewTransition(() => machine.send('next'), { retreat })` from the
`view-transitions` skill; the machine owns which step is legal, the transition
owns the animation.

## Testing

Test the transition table and guards against a real machine; it needs no DOM.
Assert on `send`'s return value and `current`. A case the types make
unconstructable (an unknown event, a missing payload) needs no test.
