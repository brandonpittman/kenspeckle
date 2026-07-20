import { describe, expect, expectTypeOf, it, vi } from 'vitest';
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
		expect(exit.off.mock.invocationCallOrder[0]).toBeLessThan(enter.on.mock.invocationCallOrder[0]);
		expect(exit.on).not.toHaveBeenCalled();
	});

	it('exposes the states definition', () => {
		const { f } = create();
		expect(f.states.off.toggle).toBe('on');
	});
});

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

	it('superseded calls resolve with the final state when the last timer fires', async () => {
		const { f, search } = create();
		const first = f.debounce('search', 30, 'a');
		const second = f.debounce('search', 30, 'ab');
		await expect(first).resolves.toBe('searching');
		await expect(second).resolves.toBe('searching');
		expect(search).toHaveBeenCalledTimes(1);
	});
});

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
