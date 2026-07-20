# FiniteStateMachine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** kenspeckle's `FiniteStateMachine` — fully typed (event-payload map), reactive context third generic, re-entry semantics, dev warnings — per [spec](../specs/2026-07-18-finite-state-machine-design.md).

**Architecture:** Clean-room class in one `.svelte.ts` module. `$state`-backed `current` + `context`; uniform `states[state][key] ?? states['*'][key]` lookup for events and lifecycle; meta-first handlers. Tests in a sibling `.svelte.test.ts` (browser project — filename convention routes it to chromium; runes compile because `.svelte.` is in the name).

**Tech Stack:** Svelte 5 runes, TypeScript, vitest (browser project, playwright chromium), esm-env for `DEV`.

**Conventions (repo):** jj not git — commit with `jj commit -m '…'` (working copy is the change; no add/stage). No Claude attribution in messages. Tabs. `npm run check` after every task. Test command:

```bash
npm run test:unit -- --run src/lib/finite-state-machine.svelte.test.ts
```

(Server project excludes the file; only the `client` browser project runs it.)

**Files:**
- Create: `src/lib/finite-state-machine.svelte.ts`
- Create: `src/lib/finite-state-machine.svelte.test.ts`
- Modify: `src/lib/index.ts`
- Modify: `package.json` (dep + peer)

---

### Task 1: Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add esm-env as a runtime dependency**

```bash
npm install esm-env
```

Expected: `esm-env` appears under `"dependencies"` in package.json (it's already in the lock transitively; this declares it).

- [ ] **Step 2: Bump svelte peer range per parent spec (≥5.40, createContext)**

In `package.json`, change:

```json
	"peerDependencies": {
		"svelte": "^5.0.0"
	},
```

to:

```json
	"peerDependencies": {
		"svelte": "^5.40.0"
	},
```

- [ ] **Step 3: Verify install is coherent**

Run: `npm run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Commit**

```bash
jj commit -m 'chore: esm-env dep, svelte peer >=5.40'
```

---

### Task 2: Core — construction, string transitions, lifecycle

**Files:**
- Create: `src/lib/finite-state-machine.svelte.test.ts`
- Create: `src/lib/finite-state-machine.svelte.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/finite-state-machine.svelte.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { FiniteStateMachine } from './finite-state-machine.svelte.js';

describe('core: toggle machine', () => {
	type States = 'on' | 'off';
	type Events = { toggle: [] };

	function create() {
		const enter = { on: vi.fn(), off: vi.fn() };
		const exit = { on: vi.fn(), off: vi.fn() };
		const f = new FiniteStateMachine<States, Events>('off', {
			off: { toggle: 'on', _enter: enter.off, _exit: exit.off },
			on: { toggle: 'off', _enter: enter.on, _exit: exit.on }
		});
		return { f, enter, exit };
	}

	it('starts in the initial state', () => {
		const { f } = create();
		expect(f.current).toBe('off');
	});

	it('transitions on string targets; send returns the new state', () => {
		const { f } = create();
		expect(f.send('toggle')).toBe('on');
		f.send('toggle');
		expect(f.current).toBe('off');
	});

	it('fires synthetic _enter for the initial state', () => {
		const { enter, exit } = create();
		expect(enter.off).toHaveBeenCalledExactlyOnceWith({
			from: null,
			to: 'off',
			event: null,
			args: [],
			context: undefined
		});
		expect(exit.off).not.toHaveBeenCalled();
		expect(enter.on).not.toHaveBeenCalled();
	});

	it('fires _exit on the old state then _enter on the new, with full metas', () => {
		const { f, enter, exit } = create();
		f.send('toggle');
		expect(exit.off).toHaveBeenCalledExactlyOnceWith({
			from: 'off',
			to: 'on',
			event: 'toggle',
			args: [],
			context: undefined
		});
		expect(enter.on).toHaveBeenCalledExactlyOnceWith({
			from: 'off',
			to: 'on',
			event: 'toggle',
			args: [],
			context: undefined
		});
		expect(exit.off.mock.invocationCallOrder[0]).toBeLessThan(
			enter.on.mock.invocationCallOrder[0]
		);
		expect(exit.on).not.toHaveBeenCalled();
	});

	it('exposes the states definition', () => {
		const { f } = create();
		expect(f.states.off.toggle).toBe('on');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --run src/lib/finite-state-machine.svelte.test.ts`
Expected: FAIL — cannot resolve `./finite-state-machine.svelte.js`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/finite-state-machine.svelte.ts`. Full types up front (later tasks only touch the class body). Note: `_enter`/`_exit` are reserved — an `EventsT` key with those names collides with the lifecycle slots by design.

```ts
import { DEV } from 'esm-env';

export type EventMap = Record<string, unknown[]>;

type EventArgs<EventsT extends EventMap> = {
	[K in keyof EventsT]: { event: K; args: EventsT[K] };
}[keyof EventsT];

export type ActionMeta<
	StatesT extends string,
	EventsT extends EventMap,
	ContextT,
	CurrentT extends StatesT,
	K extends keyof EventsT
> = {
	from: CurrentT;
	event: K;
	args: EventsT[K];
	context: ContextT;
};

export type EnterMeta<
	StatesT extends string,
	EventsT extends EventMap,
	ContextT,
	CurrentT extends StatesT
> = { to: CurrentT; context: ContextT } & (
	| ({ from: StatesT } & EventArgs<EventsT>)
	| { from: null; event: null; args: [] }
);

export type ExitMeta<
	StatesT extends string,
	EventsT extends EventMap,
	ContextT,
	CurrentT extends StatesT
> = { from: CurrentT; to: StatesT; context: ContextT } & EventArgs<EventsT>;

export type Action<
	StatesT extends string,
	EventsT extends EventMap,
	ContextT,
	CurrentT extends StatesT,
	K extends keyof EventsT
> = StatesT | ((meta: ActionMeta<StatesT, EventsT, ContextT, CurrentT, K>) => StatesT | void);

export type StateHandler<
	StatesT extends string,
	EventsT extends EventMap,
	ContextT,
	CurrentT extends StatesT
> = {
	[K in keyof EventsT]?: Action<StatesT, EventsT, ContextT, CurrentT, K>;
} & {
	_enter?: (meta: EnterMeta<StatesT, EventsT, ContextT, CurrentT>) => void;
	_exit?: (meta: ExitMeta<StatesT, EventsT, ContextT, CurrentT>) => void;
};

export type Transition<StatesT extends string, EventsT extends EventMap, ContextT = undefined> = {
	[S in StatesT]: StateHandler<StatesT, EventsT, ContextT, S>;
} & {
	'*'?: StateHandler<StatesT, EventsT, ContextT, StatesT>;
};

export class FiniteStateMachine<
	StatesT extends string,
	EventsT extends EventMap,
	ContextT = undefined
> {
	#current: StatesT = $state()!;
	#context: ContextT = $state()!;
	readonly states: Transition<StatesT, EventsT, ContextT>;

	constructor(
		initial: StatesT,
		states: Transition<StatesT, EventsT, ContextT>,
		...options: undefined extends ContextT ? [] : [{ context: ContextT }]
	) {
		this.#current = initial;
		this.states = states;
		this.#context = (options[0]?.context ?? undefined) as ContextT;
		this.#lifecycle('_enter', initial, {
			from: null,
			to: initial,
			event: null,
			args: [],
			context: this.#context
		});
	}

	send = <K extends keyof EventsT>(event: K, ...args: EventsT[K]): StatesT => {
		const action = this.states[this.#current]?.[event] ?? this.states['*']?.[event];
		if (action === undefined) return this.#current;
		const target = typeof action === 'string' ? action : undefined;
		if (target !== undefined) this.#transition(target, event, args);
		return this.#current;
	};

	#transition(to: StatesT, event: keyof EventsT, args: unknown[]) {
		const from = this.#current;
		this.#lifecycle('_exit', from, { from, to, event, args, context: this.#context });
		this.#current = to;
		this.#lifecycle('_enter', to, { from, to, event, args, context: this.#context });
	}

	#lifecycle(kind: '_enter' | '_exit', state: StatesT, meta: unknown) {
		const fn = this.states[state]?.[kind] ?? this.states['*']?.[kind];
		(fn as ((meta: unknown) => void) | undefined)?.(meta);
	}

	get current(): StatesT {
		return this.#current;
	}

	get context(): ContextT {
		return this.#context;
	}

	set context(next: ContextT) {
		this.#context = next;
	}
}
```

(`DEV` import is used from Task 6; if eslint complains about the unused import before then, add it in Task 6 instead.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --run src/lib/finite-state-machine.svelte.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Check and commit**

Run: `npm run check` — expected 0 errors.

```bash
jj commit -m 'feat: fsm core, string transitions and lifecycle'
```

---

### Task 3: Function handlers — meta arg, veto, typed payloads

**Files:**
- Modify: `src/lib/finite-state-machine.svelte.test.ts`
- Modify: `src/lib/finite-state-machine.svelte.ts`

- [ ] **Step 1: Write the failing tests**

Append to the test file:

```ts
describe('function handlers', () => {
	type States = 'idle' | 'painted';
	type Events = { paint: [color: string, coats: number] };

	function create() {
		const idleExit = vi.fn();
		const paintedEnter = vi.fn();
		const paint = vi.fn(({ args }: { args: [string, number] }) =>
			args[0] === 'red' ? ('painted' as const) : undefined
		);
		const f = new FiniteStateMachine<States, Events>('idle', {
			idle: { paint, _exit: idleExit },
			painted: { _enter: paintedEnter }
		});
		return { f, paint, idleExit, paintedEnter };
	}

	it('calls the handler with a full meta and transitions on its return', () => {
		const { f, paint } = create();
		f.send('paint', 'red', 2);
		expect(paint).toHaveBeenCalledExactlyOnceWith({
			from: 'idle',
			event: 'paint',
			args: ['red', 2],
			context: undefined
		});
		expect(f.current).toBe('painted');
	});

	it('vetoes: undefined return stays put, no lifecycle', () => {
		const { f, idleExit, paintedEnter } = create();
		f.send('paint', 'blue', 1);
		expect(f.current).toBe('idle');
		expect(idleExit).not.toHaveBeenCalled();
		expect(paintedEnter).not.toHaveBeenCalled();
	});

	it('passes typed args through to lifecycle metas', () => {
		const { f, paintedEnter } = create();
		f.send('paint', 'red', 2);
		expect(paintedEnter).toHaveBeenCalledExactlyOnceWith({
			from: 'idle',
			to: 'painted',
			event: 'paint',
			args: ['red', 2],
			context: undefined
		});
	});
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm run test:unit -- --run src/lib/finite-state-machine.svelte.test.ts`
Expected: the 3 new tests FAIL (handler never called — send only understands strings); prior 5 pass.

- [ ] **Step 3: Implement function dispatch in `send`**

Replace the `send` body's middle lines:

```ts
	send = <K extends keyof EventsT>(event: K, ...args: EventsT[K]): StatesT => {
		const action = this.states[this.#current]?.[event] ?? this.states['*']?.[event];
		if (action === undefined) return this.#current;
		const target =
			typeof action === 'function'
				? (action as (meta: unknown) => StatesT | void)({
						from: this.#current,
						event,
						args,
						context: this.#context
					})
				: action;
		if (target !== undefined) this.#transition(target, event, args);
		return this.#current;
	};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --run src/lib/finite-state-machine.svelte.test.ts`
Expected: 8 passed.

- [ ] **Step 5: Check and commit**

Run: `npm run check` — expected 0 errors.

```bash
jj commit -m 'feat: fsm function handlers with meta and veto'
```

---

### Task 4: Wildcard fallback — events and lifecycle

**Files:**
- Modify: `src/lib/finite-state-machine.svelte.test.ts`

Implementation already resolves via `?? states['*']` in both `send` and `#lifecycle`; this task pins the behavior with tests (they should pass immediately — that's fine, the lookup rule shipped in Task 2 and this locks it).

- [ ] **Step 1: Write the tests**

Append:

```ts
describe('wildcard fallback', () => {
	type States = 'a' | 'b' | 'done';
	type Events = { go: []; finish: [] };

	it('falls back to * for events the current state lacks; own handler wins', () => {
		const f = new FiniteStateMachine<States, Events>('a', {
			a: { go: 'b' },
			b: {},
			done: {},
			'*': { go: 'a', finish: 'done' }
		});
		f.send('go'); // own handler: a -> b
		expect(f.current).toBe('b');
		f.send('go'); // b lacks go, * sends back to a
		expect(f.current).toBe('a');
		f.send('finish'); // only on *
		expect(f.current).toBe('done');
	});

	it('shares one _enter via *; a state with its own _enter overrides', () => {
		const shared = vi.fn();
		const own = vi.fn();
		const f = new FiniteStateMachine<States, Events>('a', {
			a: { go: 'b' },
			b: { go: 'done', _enter: own },
			done: {},
			'*': { _enter: shared }
		});
		expect(shared).toHaveBeenCalledTimes(1); // initial enter of a
		f.send('go');
		expect(own).toHaveBeenCalledTimes(1); // b's own wins
		expect(shared).toHaveBeenCalledTimes(1); // not called for b
		f.send('go');
		expect(shared).toHaveBeenCalledTimes(2); // done falls back
		expect(shared).toHaveBeenLastCalledWith({
			from: 'b',
			to: 'done',
			event: 'go',
			args: [],
			context: undefined
		});
	});
});
```

- [ ] **Step 2: Run tests**

Run: `npm run test:unit -- --run src/lib/finite-state-machine.svelte.test.ts`
Expected: 10 passed (no implementation change needed; if either fails, the lookup rule in `send`/`#lifecycle` is wrong — fix there).

- [ ] **Step 3: Check and commit**

Run: `npm run check` — expected 0 errors.

```bash
jj commit -m 'test: fsm wildcard fallback for events and lifecycle'
```

---

### Task 5: Re-entry — returned state always transitions

**Files:**
- Modify: `src/lib/finite-state-machine.svelte.test.ts`
- Modify: `src/lib/finite-state-machine.svelte.ts` (only if needed — Task 3's dispatch already transitions on any returned state)

- [ ] **Step 1: Write the tests**

Append:

```ts
describe('re-entry', () => {
	type States = 'question' | 'done';
	type Events = { replay: []; finish: [] };

	it('self-transition fires _exit and _enter (from === to)', () => {
		const enter = vi.fn();
		const exit = vi.fn();
		const f = new FiniteStateMachine<States, Events>('question', {
			question: { replay: 'question', finish: 'done', _enter: enter, _exit: exit },
			done: {}
		});
		enter.mockClear(); // drop initial enter
		f.send('replay');
		expect(f.current).toBe('question');
		expect(exit).toHaveBeenCalledExactlyOnceWith({
			from: 'question',
			to: 'question',
			event: 'replay',
			args: [],
			context: undefined
		});
		expect(enter).toHaveBeenCalledExactlyOnceWith({
			from: 'question',
			to: 'question',
			event: 'replay',
			args: [],
			context: undefined
		});
	});

	it('handler returning the current state also re-enters', () => {
		const enter = vi.fn();
		const f = new FiniteStateMachine<States, Events>('question', {
			question: { replay: () => 'question', finish: 'done', _enter: enter },
			done: {}
		});
		enter.mockClear();
		f.send('replay');
		expect(enter).toHaveBeenCalledTimes(1);
	});
});
```

- [ ] **Step 2: Run tests**

Run: `npm run test:unit -- --run src/lib/finite-state-machine.svelte.test.ts`
Expected: 12 passed. Task 3's dispatch has no same-state guard, so these pass; if one fails, remove whatever `target !== current` comparison crept in — the only stay-put path is `undefined`.

- [ ] **Step 3: Check and commit**

Run: `npm run check` — expected 0 errors.

```bash
jj commit -m 'test: fsm re-entry on self-transition'
```

---

### Task 6: Dev warning + declared ignore

**Files:**
- Modify: `src/lib/finite-state-machine.svelte.test.ts`
- Modify: `src/lib/finite-state-machine.svelte.ts`

- [ ] **Step 1: Write the failing tests**

Append (vitest runs with `DEV === true`):

```ts
describe('dev warnings', () => {
	type States = 'idle' | 'busy';
	type Events = { start: []; keydown: [key: string] };

	it('warns once for an unhandled event', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const f = new FiniteStateMachine<States, Events>('idle', {
			idle: { start: 'busy' },
			busy: {}
		});
		f.send('keydown', 'a');
		expect(f.current).toBe('idle');
		expect(warn).toHaveBeenCalledExactlyOnceWith(
			"kenspeckle: unhandled event 'keydown' in state 'idle'"
		);
		warn.mockRestore();
	});

	it('declared no-op handler is a silent ignore', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const f = new FiniteStateMachine<States, Events>('idle', {
			idle: { start: 'busy', keydown: () => {} },
			busy: {}
		});
		f.send('keydown', 'a');
		expect(f.current).toBe('idle');
		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
	});
});
```

- [ ] **Step 2: Run tests to verify the first fails**

Run: `npm run test:unit -- --run src/lib/finite-state-machine.svelte.test.ts`
Expected: 'warns once' FAILS (no warning emitted); 'declared no-op' passes.

- [ ] **Step 3: Implement the warning**

In `send`, replace the early return:

```ts
		if (action === undefined) {
			if (DEV) {
				console.warn(
					`kenspeckle: unhandled event '${String(event)}' in state '${this.#current}'`
				);
			}
			return this.#current;
		}
```

(Add `import { DEV } from 'esm-env';` now if it was deferred in Task 2.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --run src/lib/finite-state-machine.svelte.test.ts`
Expected: 14 passed.

- [ ] **Step 5: Check and commit**

Run: `npm run check` — expected 0 errors.

```bash
jj commit -m 'feat: fsm dev warning for unhandled events'
```

---

### Task 7: Context — option, reactivity, mutation, reassignment

**Files:**
- Modify: `src/lib/finite-state-machine.svelte.test.ts`

Runtime support (constructor rest tuple, `#context` `$state`, `context` accessor, `context` in metas) shipped in Task 2; this task proves the behaviors that matter.

- [ ] **Step 1: Write the tests**

Append:

```ts
describe('context', () => {
	type States = 'idle' | 'done';
	type Events = { incr: []; record: [name: string]; finish: [] };
	type Ctx = { n: number; results: string[] };

	function create() {
		const enter = vi.fn();
		const f = new FiniteStateMachine<States, Events, Ctx>(
			'idle',
			{
				idle: {
					incr: ({ context }) => {
						context.n++;
					},
					record: ({ context, args: [name] }) => {
						context.results.push(name);
					},
					finish: 'done',
					_enter: enter
				},
				done: { _enter: enter }
			},
			{ context: { n: 0, results: [] } }
		);
		return { f, enter };
	}

	it('initializes from the option and appears in metas', () => {
		const { f, enter } = create();
		expect(f.context.n).toBe(0);
		expect(enter).toHaveBeenCalledExactlyOnceWith({
			from: null,
			to: 'idle',
			event: null,
			args: [],
			context: { n: 0, results: [] }
		});
	});

	it('handlers mutate context through the meta; veto still applies the mutation', () => {
		const { f } = create();
		f.send('incr');
		f.send('incr');
		expect(f.current).toBe('idle'); // handlers returned undefined
		expect(f.context.n).toBe(2);
	});

	it('is deeply reactive', () => {
		const { f } = create();
		const total = $derived(f.context.n + f.context.results.length);
		expect(total).toBe(0);
		f.send('incr');
		f.send('record', 'a');
		expect(total).toBe(2);
	});

	it('current is reactive', () => {
		const { f } = create();
		const done = $derived(f.current === 'done');
		expect(done).toBe(false);
		f.send('finish');
		expect(done).toBe(true);
	});

	it('supports whole-value reassignment, still reactive', () => {
		const { f } = create();
		const n = $derived(f.context.n);
		f.context = { n: 10, results: ['x'] };
		expect(n).toBe(10);
		f.send('incr');
		expect(n).toBe(11);
	});
});
```

- [ ] **Step 2: Run tests**

Run: `npm run test:unit -- --run src/lib/finite-state-machine.svelte.test.ts`
Expected: 19 passed. Failures here mean `#context` isn't `$state`-backed or metas capture a stale copy — metas must be built per dispatch with the live `this.#context`.

- [ ] **Step 3: Check and commit**

Run: `npm run check` — expected 0 errors.

```bash
jj commit -m 'test: fsm reactive context'
```

---

### Task 8: debounce — event-first, per-event keying

**Files:**
- Modify: `src/lib/finite-state-machine.svelte.test.ts`
- Modify: `src/lib/finite-state-machine.svelte.ts`

- [ ] **Step 1: Write the failing tests**

Append:

```ts
describe('debounce', () => {
	type States = 'idle' | 'searching' | 'paused';
	type Events = { search: [q: string]; pause: [] };

	function create() {
		const search = vi.fn(() => 'searching' as const);
		const f = new FiniteStateMachine<States, Events>('idle', {
			idle: { search, pause: 'paused' },
			searching: { search, pause: 'paused' },
			paused: {}
		});
		return { f, search };
	}

	it('coalesces same-event sends; last args win', async () => {
		const { f, search } = create();
		await Promise.any([f.debounce('search', 30, 'a'), f.debounce('search', 30, 'ab')]);
		expect(search).toHaveBeenCalledExactlyOnceWith({
			from: 'idle',
			event: 'search',
			args: ['ab'],
			context: undefined
		});
		expect(f.current).toBe('searching');
	});

	it('later call resets the timer even with a different wait', async () => {
		const { f, search } = create();
		await Promise.any([f.debounce('search', 60, 'a'), f.debounce('search', 30, 'ab')]);
		expect(search).toHaveBeenCalledTimes(1);
	});

	it('keys timers per event — different events do not cancel each other', async () => {
		const { f, search } = create();
		await Promise.all([f.debounce('search', 30, 'a'), f.debounce('pause', 30)]);
		expect(search).toHaveBeenCalledTimes(1);
		expect(f.current).toBe('paused'); // search fired first, then pause
	});

	it('defaults wait to 500', async () => {
		vi.useFakeTimers();
		try {
			const { f } = create();
			const p = f.debounce('search', undefined, 'a');
			vi.advanceTimersByTime(499);
			expect(f.current).toBe('idle');
			vi.advanceTimersByTime(1);
			await expect(p).resolves.toBe('searching');
		} finally {
			vi.useRealTimers();
		}
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --run src/lib/finite-state-machine.svelte.test.ts`
Expected: 4 new FAIL — `f.debounce` is not a function.

- [ ] **Step 3: Implement debounce**

Add to the class (after `send`):

```ts
	#timeouts: { [K in keyof EventsT]?: ReturnType<typeof setTimeout> } = {};

	debounce = <K extends keyof EventsT>(
		event: K,
		wait: number = 500,
		...args: EventsT[K]
	): Promise<StatesT> => {
		clearTimeout(this.#timeouts[event]);
		return new Promise((resolve) => {
			this.#timeouts[event] = setTimeout(() => {
				delete this.#timeouts[event];
				resolve(this.send(event, ...args));
			}, wait);
		});
	};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --run src/lib/finite-state-machine.svelte.test.ts`
Expected: 23 passed.

- [ ] **Step 5: Check and commit**

Run: `npm run check` — expected 0 errors.

```bash
jj commit -m 'feat: fsm debounce, event-first with per-event timers'
```

- [ ] **Step 6 (added during execution, from Svelte review): superseded promises must settle**

runed's shape (Step 3 above) leaves a superseded call's promise pending forever. Append inside the debounce describe block:

```ts
	it('superseded calls resolve with the final state when the last timer fires', async () => {
		const { f, search } = create();
		const first = f.debounce('search', 30, 'a');
		const second = f.debounce('search', 30, 'ab');
		await expect(first).resolves.toBe('searching');
		await expect(second).resolves.toBe('searching');
		expect(search).toHaveBeenCalledTimes(1);
	});
```

And replace `#timeouts`/`debounce` so each event keys `{ id, resolvers[] }`: supersede carries resolvers forward, the trailing fire resolves them all with the resulting state. Commit: `fix: fsm debounce resolves superseded calls`.

---

### Task 9: Type-level tests

**Files:**
- Modify: `src/lib/finite-state-machine.svelte.test.ts`

`@ts-expect-error` correctness is enforced by `npm run check` (svelte-check fails on unused suppressions); `expectTypeOf` documents the positive cases.

- [ ] **Step 1: Write the tests**

Add `expectTypeOf` to the existing vitest import at the top of the file:

```ts
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
```

Append:

```ts
describe('type-level', () => {
	type States = 'idle' | 'busy';
	type Events = { start: []; load: [id: string, force: boolean] };
	type Ctx = { n: number };

	it('checks payloads, targets, narrowing, and context overloads', () => {
		const f = new FiniteStateMachine<States, Events>('idle', {
			idle: {
				start: 'busy',
				load: ({ from, event, args }) => {
					expectTypeOf(from).toEqualTypeOf<'idle'>();
					expectTypeOf(event).toEqualTypeOf<'load'>();
					expectTypeOf(args).toEqualTypeOf<[id: string, force: boolean]>();
				},
				_enter: (meta) => {
					expectTypeOf(meta.to).toEqualTypeOf<'idle'>();
					if (meta.event === 'load') {
						expectTypeOf(meta.args).toEqualTypeOf<[id: string, force: boolean]>();
					}
				},
				_exit: (meta) => {
					expectTypeOf(meta.from).toEqualTypeOf<'idle'>();
				}
			},
			busy: {}
		});

		expectTypeOf(f.current).toEqualTypeOf<States>();
		expectTypeOf(f.context).toEqualTypeOf<undefined>();
		f.send('load', 'a', true);

		// @ts-expect-error unknown event
		f.send('nope');
		// @ts-expect-error missing payload
		f.send('load');
		// @ts-expect-error wrong payload types
		f.send('load', 42, 'yes');
		// @ts-expect-error extra payload on a no-payload event
		f.send('start', 1);
		// @ts-expect-error debounce payloads are checked too
		f.debounce('load', 100, 42, true);

		new FiniteStateMachine<States, Events>('idle', {
			idle: {
				// @ts-expect-error string target must be a valid state
				start: 'nonexistent'
			},
			busy: {}
		});

		// @ts-expect-error no-context machine rejects the options argument
		new FiniteStateMachine<States, Events>('idle', { idle: {}, busy: {} }, { context: { n: 0 } });

		// @ts-expect-error context machine requires the options argument
		new FiniteStateMachine<States, Events, Ctx>('idle', { idle: {}, busy: {} });

		const g = new FiniteStateMachine<States, Events, Ctx>(
			'idle',
			{ idle: {}, busy: {} },
			{ context: { n: 0 } }
		);
		expectTypeOf(g.context).toEqualTypeOf<Ctx>();

		expect(f.current).toBe('busy'); // ts-expect-error is compile-only: the start send above ran and transitioned
	});
});
```

- [ ] **Step 2: Run tests and check**

Run: `npm run test:unit -- --run src/lib/finite-state-machine.svelte.test.ts`
Expected: 24 passed.

Run: `npm run check`
Expected: 0 errors — this is the step that actually validates every `@ts-expect-error`. If check reports "unused '@ts-expect-error' directive", the type surface is looser than spec: fix the types in `finite-state-machine.svelte.ts`, not the test. Likely culprits: the conditional rest tuple on the constructor (both overload errors), `EventsT[K]` not flowing through `send`'s rest params (payload errors).

- [ ] **Step 3: Commit**

```bash
jj commit -m 'test: fsm type-level coverage'
```

---

### Task 10: Export, lint, full suite

**Files:**
- Modify: `src/lib/index.ts`

- [ ] **Step 1: Export from the package entry**

Replace the placeholder content of `src/lib/index.ts`:

```ts
export { FiniteStateMachine } from './finite-state-machine.svelte.js';
export type {
	Action,
	ActionMeta,
	EnterMeta,
	EventMap,
	ExitMeta,
	StateHandler,
	Transition
} from './finite-state-machine.svelte.js';
```

- [ ] **Step 2: Full verification**

```bash
npm run format
npm run lint
npm run check
npm run test:unit -- --run
```

Expected: lint clean, check 0 errors, all unit tests pass (FSM suite + scaffold examples).

- [ ] **Step 3: Commit**

```bash
jj commit -m 'feat: export FiniteStateMachine from package entry'
```

---

## Self-Review Notes

- Spec coverage: type model (T2/T9), transition semantics + re-entry (T2/T3/T5), wildcard incl. lifecycle sharing (T4), context (T7), dev warnings + declared ignore (T6), debounce (T8), module layout/exports (T10), testing incl. type-level (T9). Svelte-context recipe and re-entry hazard are docs-site content — out of scope here (docs site has no FSM page yet; belongs to the docs plan).
- Spec's unresolved question (lifecycle args discriminated-union narrowing) is exercised by T9's `if (meta.event === 'load')` narrowing test; if TS inference breaks at the states-object literal, degrade `EventArgs` to a plain `{ event: keyof EventsT; args: EventsT[keyof EventsT] }` and delete that one narrowing assertion — spec sanctions this fallback.
- vitest `expect: { requireAssertions: true }` — every `it` above contains at least one runtime `expect`.
