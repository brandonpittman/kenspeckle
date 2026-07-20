# FiniteStateMachine — design

**Date:** 2026-07-18
**Status:** Approved design
**Parent:** [kenspeckle design](./2026-07-18-kenspeckle-design.md) · **Requirements spec:** cq-test-web [TestSession design](../../../../splink/cq-test-web/docs/superpowers/specs/2026-07-18-test-session-design-en.md)

## Problem

runed's FSM holds only finite state; real apps grow sidecar data mechanisms (cq-test-web's test-contexts: ~20 lines of getter boilerplate each). Also untyped end to end where it counts: `send(event, ...args: unknown[])`, lifecycle meta `args: unknown`. Latent bugs in practice: self-transitions silently no-op (cq-test-web's replay events never re-fire `_enter`), shared lifecycle requires hand-spreading `_enter` into every state (12 copies in `test-state.ts`).

**Guiding principle: fully typed.** A state machine exists to make correctness checkable — `unknown` payloads defeat the point.

## Decision

Clean-room implementation, runed's mental model: states object, `'*'` fallback, `_enter`/`_exit`, `send`/`debounce`/`current`. Not a port — lifecycle and event dispatch are separate code paths (no runtime meta-sniffing), and the typed core reshapes every signature anyway.

Rejected:

- **Port runed's class, graft context/typing on** — internals shaped around string-union events and positional untyped args; graft fights the shape, keeps the quirks.
- **Statechart core (XState-style nesting/actors)** — different library; kenspeckle is deliberately flat.
- **String-union events as sugar alongside the map** — doubles the type surface to bless an untyped path.

## Type model

```ts
type EventMap = Record<string, unknown[]>;

class FiniteStateMachine<
	StatesT extends string,
	EventsT extends EventMap,
	ContextT = undefined
>
```

Events are a payload map — the only form. No-payload events cost one keystroke: `proceed: []`.

```ts
type Events = {
	proceed: [];
	submit: [key: string];
};

machine.send('submit', 'red'); // checked; send('submit', 42) is a compile error
```

Handlers are a string target (checked against `StatesT`) or a meta-first fn:

```ts
// event handler meta — in state `foo`'s block, Current = 'foo'
type ActionMeta = {
	from: Current;   // literal current state
	event: K;        // the event key
	args: EventsT[K]; // typed tuple
	context: ContextT;
};
// handler: StatesT | ((meta) => StatesT | void)
```

Lifecycle metas are fully correlated: `event`/`args` form a discriminated union over the map (narrowing `event` narrows `args`), plus the initial-enter arm `{ from: null, event: null, args: [] }`. Per-state narrowing: state `foo`'s `_enter` has `to: 'foo'`; its `_exit` has `from: 'foo'`. All metas carry `context`.

Guards are not a separate concept: a handler that returns `undefined` vetoes the transition.

## Transition semantics

- Lookup rule, uniform for events and lifecycle: `states[current][key] ?? states['*'][key]`. One shared `_enter` on `'*'` replaces per-state copies; a state's own `_enter` overrides (call the shared one manually to get both).
- Handler resolves to a state → transition **always**, same state included: re-entry fires `_exit` + `_enter`. Resolves to `undefined` → stay, no lifecycle. Both behaviors expressible; runed's silent self-transition no-op is gone.
- Construction fires synthetic `_enter` for the initial state (`from: null, event: null`).
- Sends from inside lifecycle fns run synchronously, no queue (documented).

**Re-entry hazard, documented:** re-entry-always plus a `'*'` catch-all (e.g. `'*': { complete: 'complete' }`) means a repeated send re-enters and re-runs `_enter` side effects. Intentional-ignore is the fix: declare the event on the target state (`complete: { complete: () => {} }`).

## Context

```ts
new FiniteStateMachine(initial, states);                      // ContextT = undefined
new FiniteStateMachine(initial, states, { context: init });   // ContextT inferred
```

Constructor overloads: the no-context call cannot pass the option; the context call requires it. No-context API is otherwise identical in shape to runed's.

- Backed by deep `$state`: `machine.context.n` is reactive; `results.push(...)` is reactive.
- Handlers mutate `meta.context` directly (same proxy). Whole-value reassignment allowed: `machine.context = next`.
- Domain verbs stay out — wrapper classes (TestSession-style) remain the app-facing pattern; built-in context deletes their getter-boilerplate sidecars.

## Dev warnings

`DEV`-gated via `esm-env`, stripped in prod. One warning: event sent with no handler in current state or `'*'` — catches forgotten wiring and untyped JS senders. A declared no-op handler is the intentional-ignore and silences it:

```ts
actualQuestion: {
	proceed: 'actualAnswer',
	keydown: () => {}, // declared ignore — no warn
}
```

## API surface

```ts
machine.current                                    // StatesT, $state-backed
machine.context                                    // ContextT, deep reactive
machine.send(event, ...args): StatesT
machine.debounce(event, wait = 500, ...args): Promise<StatesT>
machine.states                                     // readonly definition
```

- `send`/`debounce` pre-bound — pass as callbacks directly.
- `debounce` keys timers per event: a resend of the same event resets its timer; other events are independent. Event-first order (runed's `debounce(wait, event, …)` made the defaultable param non-omittable). Every coalesced call's promise resolves with the resulting state when the trailing send fires — no dangling promises (runed leaves superseded promises pending forever).

## Svelte context wiring

No helper shipped — Svelte ≥5.40 `createContext` covers it. Docs show the factory recipe:

```ts
const [getWizard, setWizard] = createContext<WizardMachine>();

export function createWizard(initial: WizardStep = 'intro') {
	const m = new FiniteStateMachine<WizardStep, WizardEvents, WizardCtx>(initial, states, {
		context: { attempts: 0, answers: [] },
	});
	setWizard(m);
	return m;
}
export { getWizard };
```

Revisit a `machineContext()` sugar only if the recipe proves annoying in practice.

## Requirements check: TestSession (cq-test-web)

Walked against the parked TestSession design; every mechanism maps:

- Session data fields (`currentQuestion`, `questionNumber`, `results`, `lastCorrect`, `input`) become `ContextT`; TestSession delegates to `machine.context.*`.
- Question generation, `on` callbacks, timeout timer: one `'*'._enter` keyed on `meta.to`; `meta.context` feeds adaptive `actualQuestion(ctx)` (digit-span).
- Replay events (`replayActualQuestion: 'actualQuestion'`) work via re-entry — `_enter` regenerates the question.
- Timeout's `send('complete')` and synchronous sends from `_enter`: supported.
- Double-`complete` re-entry (see hazard above): declared ignore on `complete`.

## Module layout

`src/lib/finite-state-machine.svelte.ts`, re-exported from `src/lib/index.ts`. Exported types: `FiniteStateMachine`, `EventMap`, `Transition`, `StateHandler`, meta types.

## Testing

TDD. runed's FSM suite ported as behavioral baseline, adjusted where semantics deliberately diverge (re-entry, warnings, handler signature, debounce order). New coverage:

- Context reactivity in components (vitest-browser-svelte)
- Re-entry lifecycle; `'*'` lifecycle fallback; declared-ignore silencing
- Debounce per-event keying
- Dev-warn cases
- Type-level (`expectTypeOf`): payload checking, per-state meta narrowing, context-overload rejection (no-context call rejects the option; context call requires it)

`npm run check` after every change.

## Unresolved questions

- Lifecycle `args` discriminated-union narrowing: confirm the mapped-type gymnastics hold up in TS without wrecking inference at the states-object literal; degrade to `EventsT[keyof EventsT]` union only if they don't.
