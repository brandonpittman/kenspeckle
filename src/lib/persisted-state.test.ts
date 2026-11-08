import { afterEach, describe, expect, it, vi } from 'vitest';
import { PersistedState } from './persisted-state.svelte.js';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('PersistedState on the server', () => {
	it('should return initial from current', () => {
		const initial = { theme: 'light' };

		const state = new PersistedState('theme', initial);

		expect(state.current).toBe(initial);
	});

	it('should hold an assignment in memory', () => {
		const state = new PersistedState('theme', { theme: 'light' });
		const value = { theme: 'dark' };

		state.current = value;

		expect(state.current).toBe(value);
	});

	it('should not throw on construction, read or assignment', () => {
		expect(() => {
			const state = new PersistedState('count', 0, { storage: 'session' });
			void state.current;
			state.current = 1;
		}).not.toThrow();
	});
});

describe('PersistedState on the server in DEV', () => {
	it('should not warn on an assignment', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const state = new PersistedState('theme', { theme: 'light' });

		state.current = { theme: 'dark' };

		expect(warn).not.toHaveBeenCalled();
	});
});
