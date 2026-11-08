import { parse, stringify } from 'devalue';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PersistedState } from './persisted-state.svelte.js';

const key = 'persisted-state-test';

function stored(storage: Storage = localStorage) {
	const raw = storage.getItem(key);
	return raw === null ? null : parse(raw);
}

function watch<T>(state: PersistedState<T>) {
	const seen: T[] = [];
	const cleanup = $effect.root(() => {
		const value = $derived(state.current);
		$effect(() => {
			seen.push(value);
		});
	});
	flushSync();
	return { seen, cleanup };
}

function dispatchStorage(init: StorageEventInit) {
	window.dispatchEvent(new StorageEvent('storage', init));
	flushSync();
}

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('PersistedState', () => {
	describe('Reading', () => {
		it('should read the stored value', () => {
			localStorage.setItem(key, stringify({ theme: 'dark' }));

			const state = new PersistedState(key, { theme: 'light' });

			expect(state.current).toEqual({ theme: 'dark' });
		});

		it('should return initial when the key is empty', () => {
			const initial = { theme: 'light' };

			const state = new PersistedState(key, initial);

			expect(state.current).toBe(initial);
		});

		it('should return initial when the stored value is unparseable', () => {
			localStorage.setItem(key, '{not devalue');
			const initial = { theme: 'light' };

			const state = new PersistedState(key, initial);

			expect(state.current).toBe(initial);
		});
	});

	describe('Writing', () => {
		it('should persist an assignment synchronously', () => {
			const state = new PersistedState(key, { count: 0 });

			state.current = { count: 1 };

			expect(stored()).toEqual({ count: 1 });
		});

		it('should keep the identity of an assigned value', () => {
			const state = new PersistedState(key, [0]);
			const value = [1, 2];

			state.current = value;

			expect(state.current).toBe(value);
		});

		it('should throw at the assignment when the value is a class instance', () => {
			class Point {
				constructor(public x: number) {}
			}
			const state = new PersistedState<unknown>(key, null);

			expect(() => {
				state.current = new Point(1);
			}).toThrow(/non-POJO/);
		});

		it.each([
			{ type: Date, value: new Date('2026-01-02T03:04:05Z') },
			{
				type: Map,
				value: new Map([
					['a', 1],
					['b', 2]
				])
			},
			{ type: URL, value: new URL('https://example.com/a?b=c#d') }
		])('should round-trip a $type.name', ({ type, value }) => {
			new PersistedState<unknown>(key, null).current = value;

			const read = new PersistedState<unknown>(key, null).current;

			expect(read).toBeInstanceOf(type);
			expect(read).toEqual(value);
		});

		it('should write nothing before the first assignment', () => {
			const state = new PersistedState(key, { count: 0 });
			void state.current;

			expect(localStorage.getItem(key)).toBeNull();
		});
	});

	describe('Storage area', () => {
		it("should touch only sessionStorage when storage is 'session'", () => {
			localStorage.setItem(key, stringify(5));
			const state = new PersistedState(key, 0, { storage: 'session' });

			expect(state.current).toBe(0);
			state.current = 1;

			expect(stored(sessionStorage)).toBe(1);
			expect(stored(localStorage)).toBe(5);
		});
	});

	describe('Sync', () => {
		it('should agree across two instances on one key after a write', () => {
			localStorage.setItem(key, stringify({ count: 0 }));
			const writer = new PersistedState(key, { count: 0 });
			const reader = new PersistedState(key, { count: 0 });
			void reader.current;

			writer.current = { count: 1 };

			expect(reader.current).toEqual({ count: 1 });
		});

		it('should update a $derived from the synthetic storage event', () => {
			const writer = new PersistedState(key, 0);
			const { seen, cleanup } = watch(new PersistedState(key, 0));

			writer.current = 1;
			flushSync();
			cleanup();

			expect(seen).toEqual([0, 1]);
		});

		it('should update a $derived on an external storage event', () => {
			const { seen, cleanup } = watch(new PersistedState(key, 0));

			const newValue = stringify(1);
			localStorage.setItem(key, newValue);
			dispatchStorage({ key, newValue, storageArea: localStorage });
			cleanup();

			expect(seen).toEqual([0, 1]);
		});

		it('should ignore a storage event for another key', () => {
			const { seen, cleanup } = watch(new PersistedState(key, 0));

			localStorage.setItem(key, stringify(1));
			dispatchStorage({ key: 'another-key', newValue: stringify(1), storageArea: localStorage });
			cleanup();

			expect(seen).toEqual([0]);
		});

		it('should ignore a storage event for another storage area', () => {
			const { seen, cleanup } = watch(new PersistedState(key, 0));

			localStorage.setItem(key, stringify(1));
			dispatchStorage({ key, newValue: stringify(1), storageArea: sessionStorage });
			cleanup();

			expect(seen).toEqual([0]);
		});

		it('should reset to initial on a storage event with a null key', () => {
			localStorage.setItem(key, stringify(1));
			const { seen, cleanup } = watch(new PersistedState(key, 0));

			localStorage.clear();
			dispatchStorage({ key: null, storageArea: localStorage });
			cleanup();

			expect(seen).toEqual([1, 0]);
		});
	});

	describe('Edge Cases', () => {
		it('should keep the value in memory when setItem throws', () => {
			vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
				throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
			});
			vi.spyOn(console, 'warn').mockImplementation(() => {});
			const state = new PersistedState(key, { count: 0 });
			const value = { count: 1 };

			state.current = value;

			expect(state.current).toBe(value);
		});
	});
});

describe('PersistedState boundaries', () => {
	it('should not rerun an effect that assigns current', () => {
		const state = new PersistedState(key, { theme: 'light' });
		let theme = $state('dark');
		let runs = 0;
		const cleanup = $effect.root(() => {
			$effect(() => {
				runs += 1;
				state.current = { theme };
			});
		});
		flushSync();

		theme = 'light';
		flushSync();
		cleanup();

		expect(runs).toBe(2);
		expect(stored()).toEqual({ theme: 'light' });
	});

	it('should update a $derived after a write that setItem refuses', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
		});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const state = new PersistedState(key, 0);
		const { seen, cleanup } = watch(state);

		state.current = 1;
		flushSync();
		cleanup();

		expect(seen).toEqual([0, 1]);
	});

	it('should warn once in DEV when setItem throws', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
		});
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const state = new PersistedState(key, 0);

		state.current = 1;

		expect(warn).toHaveBeenCalledOnce();
	});

	it('should keep the assigned value when getItem throws', () => {
		const state = new PersistedState(key, { count: 0 });
		const value = { count: 1 };
		state.current = value;
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new DOMException('The operation is insecure.', 'SecurityError');
		});

		expect(state.current).toBe(value);
	});
});

describe('PersistedState with $state values', () => {
	it('should persist an assigned $state object without freezing it', () => {
		const state = new PersistedState<Record<string, string>>(key, {});
		const form = $state<Record<string, string>>({ name: 'a' });

		state.current = form;
		form.email = 'b';

		expect(stored()).toEqual({ name: 'a' });
		expect(Object.keys(form)).toEqual(['name', 'email']);
	});

	it('should accept a $state array as initial without freezing it', () => {
		const items = $state<number[]>([]);

		const state = new PersistedState(key, items);
		items.push(1);

		expect(state.current).toBe(items);
		expect(items).toEqual([1]);
	});
});

describe('PersistedState in sessionStorage', () => {
	it('should update a $derived on a sessionStorage event', () => {
		const { seen, cleanup } = watch(new PersistedState(key, 0, { storage: 'session' }));

		const newValue = stringify(1);
		sessionStorage.setItem(key, newValue);
		dispatchStorage({ key, newValue, storageArea: sessionStorage });
		cleanup();

		expect(seen).toEqual([0, 1]);
	});

	it('should ignore a localStorage event', () => {
		const { seen, cleanup } = watch(new PersistedState(key, 0, { storage: 'session' }));

		sessionStorage.setItem(key, stringify(1));
		dispatchStorage({ key, newValue: stringify(1), storageArea: localStorage });
		cleanup();

		expect(seen).toEqual([0]);
	});
});

describe('PersistedState after a refused write', () => {
	it('should take a later write of the string stored before the failure', () => {
		const setItem = vi.spyOn(Storage.prototype, 'setItem');
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const state = new PersistedState(key, 0);
		const other = new PersistedState(key, 0);
		const { seen, cleanup } = watch(state);
		state.current = 1;
		flushSync();
		setItem.mockImplementationOnce(() => {
			throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
		});
		state.current = 2;
		flushSync();

		other.current = 1;
		flushSync();
		cleanup();

		expect(state.current).toBe(1);
		expect(seen).toEqual([0, 1, 2, 1]);
	});
});

describe('PersistedState read identity', () => {
	it('should return the same parsed object on repeated reads', () => {
		localStorage.setItem(key, stringify({ count: 1 }));
		const state = new PersistedState(key, { count: 0 });

		expect(state.current).toBe(state.current);
	});
});
