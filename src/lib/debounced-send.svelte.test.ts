import { untrack } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from './debounce.svelte.js';
import { FiniteStateMachine } from './finite-state-machine.svelte.js';

type States = 'idle' | 'searching';
type Events = { search: [q: string] };

function create() {
	const search = vi.fn(() => 'searching' as const);
	const machine = new FiniteStateMachine<States, Events>('idle', {
		idle: { search },
		searching: { search }
	});
	return { machine, search };
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('debounce wrapping FiniteStateMachine.send', () => {
	it('should coalesce rapid calls into one send with the last argument', async () => {
		const { machine, search } = create();
		const send = debounce((q: string) => machine.send('search', q), 300);

		send('a');
		send('ab');
		await vi.advanceTimersByTimeAsync(300);

		expect(search).toHaveBeenCalledExactlyOnceWith({
			from: 'idle',
			event: 'search',
			args: ['ab'],
			context: undefined
		});
		expect(machine.current).toBe('searching');
	});

	it('should drop a pending send when cancel is called', async () => {
		const { machine, search } = create();
		const send = debounce((q: string) => machine.send('search', q), 300);

		send('a');
		send.cancel();
		await vi.advanceTimersByTimeAsync(300);

		expect(search).not.toHaveBeenCalled();
		expect(machine.current).toBe('idle');
	});

	it('should expose pending as reactive state inside a $derived', async () => {
		const { machine } = create();
		const send = debounce((q: string) => machine.send('search', q), 300);
		const pending = $derived(send.pending);

		send('a');
		expect(untrack(() => pending)).toBe(true);

		await vi.advanceTimersByTimeAsync(300);
		expect(untrack(() => pending)).toBe(false);
	});

	it('should not expose debounce on the machine', () => {
		expect(create().machine).not.toHaveProperty('debounce');
	});
});
