import { stringify } from 'devalue';
import { beforeEach, describe, expect, it } from 'vitest';
import { PersistedState } from './persisted-state.svelte.js';

const key = 'persisted-state-freezing-test';

beforeEach(() => {
	localStorage.clear();
});

describe('PersistedState without dev freezing', () => {
	it('should not freeze an assigned object in dev', () => {
		const state = new PersistedState(key, { count: 0 });
		const value = { count: 1 };

		state.current = value;

		expect(Object.isFrozen(value)).toBe(false);
	});

	it('should not freeze a stored object in dev', () => {
		localStorage.setItem(key, stringify([1]));
		const state = new PersistedState<number[]>(key, []);

		expect(Object.isFrozen(state.current)).toBe(false);
	});

	it('should not freeze the initial object the caller passes', () => {
		const initial = { count: 0 };

		new PersistedState(key, initial);

		expect(Object.isFrozen(initial)).toBe(false);
	});
});
