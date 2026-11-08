import { flushSync, untrack } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from './debounce.svelte.js';

type Settled<T> =
	| { status: 'pending' }
	| { status: 'resolved'; value: T }
	| { status: 'rejected'; reason: unknown };

/** Awaiting a promise that must stay unsettled would hang the test. */
function settle<T>(promise: Promise<T>): { current: Settled<T> } {
	const state: { current: Settled<T> } = { current: { status: 'pending' } };
	promise.then(
		(value) => (state.current = { status: 'resolved', value }),
		(reason) => (state.current = { status: 'rejected', reason })
	);
	return state;
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('debounce', () => {
	describe('Scheduling', () => {
		it('should run the callback once with the last call of a burst', async () => {
			const callback = vi.fn((q: string) => q);
			const search = debounce(callback, 100);

			search('a');
			search('ab');
			search('abc');
			await vi.advanceTimersByTimeAsync(100);

			expect(callback).toHaveBeenCalledExactlyOnceWith('abc');
		});

		it('should not have run at 249ms and have run at 250ms by default', async () => {
			const callback = vi.fn();
			const search = debounce(callback);

			search();
			await vi.advanceTimersByTimeAsync(249);
			expect(callback).not.toHaveBeenCalled();

			await vi.advanceTimersByTimeAsync(1);
			expect(callback).toHaveBeenCalledOnce();
		});

		it('should restart the wait on every call', async () => {
			const callback = vi.fn();
			const search = debounce(callback, 100);

			search();
			await vi.advanceTimersByTimeAsync(60);
			search();
			await vi.advanceTimersByTimeAsync(60);
			expect(callback).not.toHaveBeenCalled();

			await vi.advanceTimersByTimeAsync(40);
			expect(callback).toHaveBeenCalledOnce();
		});
	});

	describe('Shared promise', () => {
		it('should resolve every superseded call with the one run result', async () => {
			let runs = 0;
			const search = debounce((q: string) => `${q}:${++runs}`, 100);

			const first = settle(search('a'));
			const second = settle(search('ab'));
			const last = settle(search('abc'));
			await vi.advanceTimersByTimeAsync(100);

			const run = { status: 'resolved', value: 'abc:1' };
			expect(first.current).toEqual(run);
			expect(second.current).toEqual(run);
			expect(last.current).toEqual(run);
		});

		it('should resolve with an async callback awaited', async () => {
			const search = debounce(async (q: string) => {
				await new Promise((resolve) => setTimeout(resolve, 50));
				return q.toUpperCase();
			}, 100);

			const result = settle(search('a'));
			await vi.advanceTimersByTimeAsync(149);
			expect(result.current).toEqual({ status: 'pending' });

			await vi.advanceTimersByTimeAsync(1);
			expect(result.current).toEqual({ status: 'resolved', value: 'A' });
		});

		it('should reject the shared promise when the callback throws', async () => {
			const error = new Error('boom');
			const search = debounce((): string => {
				throw error;
			}, 100);

			const first = settle(search());
			const last = settle(search());
			await vi.advanceTimersByTimeAsync(100);

			expect(first.current).toEqual({ status: 'rejected', reason: error });
			expect(last.current).toEqual({ status: 'rejected', reason: error });
		});

		it('should reject the shared promise when an async callback rejects', async () => {
			const error = new Error('boom');
			const search = debounce(async (): Promise<string> => {
				throw error;
			}, 100);

			const first = settle(search());
			const last = settle(search());
			await vi.advanceTimersByTimeAsync(100);

			expect(first.current).toEqual({ status: 'rejected', reason: error });
			expect(last.current).toEqual({ status: 'rejected', reason: error });
		});

		it('should start a new promise for a call made during an in-flight async run', async () => {
			const callback = vi.fn(async (q: string) => {
				await new Promise((resolve) => setTimeout(resolve, 50));
				return q;
			});
			const search = debounce(callback, 100);

			const first = settle(search('a'));
			await vi.advanceTimersByTimeAsync(100);
			expect(callback).toHaveBeenCalledOnce();

			const second = settle(search('b'));
			await vi.advanceTimersByTimeAsync(50);
			expect(first.current).toEqual({ status: 'resolved', value: 'a' });
			expect(second.current).toEqual({ status: 'pending' });

			await vi.advanceTimersByTimeAsync(100);
			expect(second.current).toEqual({ status: 'resolved', value: 'b' });
		});
	});

	describe('cancel', () => {
		it('should drop the scheduled call', async () => {
			const callback = vi.fn((q: string) => q);
			const search = debounce(callback, 100);

			search('a');
			search.cancel();
			await vi.advanceTimersByTimeAsync(100);
			expect(callback).not.toHaveBeenCalled();

			search('b');
			await vi.advanceTimersByTimeAsync(100);
			expect(callback).toHaveBeenCalledExactlyOnceWith('b');
		});

		it('should leave the shared promise unsettled without an unhandled rejection', async () => {
			const search = debounce((q: string) => q, 100);

			const cancelled = settle(search('a'));
			search.cancel();
			const next = settle(search('b'));
			await vi.advanceTimersByTimeAsync(100);

			expect(next.current).toEqual({ status: 'resolved', value: 'b' });
			expect(cancelled.current).toEqual({ status: 'pending' });
		});

		it('should start a new promise on the next call', async () => {
			const search = debounce((q: string) => q, 100);

			const cancelled = search('a');
			search.cancel();
			const next = search('b');
			expect(next).not.toBe(cancelled);

			const result = settle(next);
			await vi.advanceTimersByTimeAsync(100);
			expect(result.current).toEqual({ status: 'resolved', value: 'b' });
		});

		it('should do nothing when nothing is scheduled', async () => {
			const search = debounce((q: string) => q, 100);

			expect(() => search.cancel()).not.toThrow();

			const result = settle(search('a'));
			await vi.advanceTimersByTimeAsync(100);
			expect(result.current).toEqual({ status: 'resolved', value: 'a' });
		});
	});

	describe('flush', () => {
		it('should run the scheduled call now with the latest args', async () => {
			const callback = vi.fn((q: string) => q);
			const search = debounce(callback, 100);

			const first = settle(search('a'));
			search('ab');
			search.flush();
			expect(callback).toHaveBeenCalledExactlyOnceWith('ab');

			await vi.advanceTimersByTimeAsync(0);
			expect(first.current).toEqual({ status: 'resolved', value: 'ab' });
		});

		it('should not run the callback again when the wait later elapses', async () => {
			const callback = vi.fn();
			const search = debounce(callback, 100);

			search();
			search.flush();
			await vi.advanceTimersByTimeAsync(100);

			expect(callback).toHaveBeenCalledOnce();
		});

		it('should do nothing when nothing is scheduled', async () => {
			const callback = vi.fn();
			const search = debounce(callback, 100);

			search.flush();
			expect(callback).not.toHaveBeenCalled();

			search();
			await vi.advanceTimersByTimeAsync(100);
			search.flush();
			expect(callback).toHaveBeenCalledOnce();
		});
	});

	describe('pending', () => {
		it('should be true in a $derived while a call is scheduled', async () => {
			const search = debounce(() => {}, 100);
			const pending = $derived(search.pending);
			expect(untrack(() => pending)).toBe(false);

			search();
			flushSync();
			expect(untrack(() => pending)).toBe(true);

			await vi.advanceTimersByTimeAsync(100);
			expect(untrack(() => pending)).toBe(false);
		});

		it('should be false once the callback starts', async () => {
			const seen: boolean[] = [];
			const search = debounce(() => {
				seen.push(search.pending);
			}, 100);

			search();
			expect(search.pending).toBe(true);
			await vi.advanceTimersByTimeAsync(100);

			expect(seen).toEqual([false]);
		});

		it('should be false after cancel', () => {
			const search = debounce(() => {}, 100);
			const pending = $derived(search.pending);

			search();
			flushSync();
			expect(untrack(() => pending)).toBe(true);

			search.cancel();
			flushSync();
			expect(untrack(() => pending)).toBe(false);
		});
	});

	describe('Edge Cases', () => {
		it('should run on the next timer tick when wait is 0', async () => {
			const callback = vi.fn();
			const search = debounce(callback, 0);

			search();
			expect(callback).not.toHaveBeenCalled();

			await vi.advanceTimersByTimeAsync(0);
			expect(callback).toHaveBeenCalledOnce();
		});

		it('should run an $effect that calls it once, through the scheduled run', async () => {
			const callback = vi.fn();
			const search = debounce(callback, 100);
			let runs = 0;
			const cleanup = $effect.root(() => {
				$effect(() => {
					runs++;
					search('a');
				});
			});

			flushSync();
			await vi.advanceTimersByTimeAsync(100);
			flushSync();

			expect(runs).toBe(1);
			expect(callback).toHaveBeenCalledExactlyOnceWith('a');
			cleanup();
		});
	});
});
