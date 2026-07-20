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
