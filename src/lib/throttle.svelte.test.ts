import { flushSync, untrack } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { throttle } from './throttle.svelte.js';

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

describe('throttle', () => {
	describe('Leading call', () => {
		it('should run at once when no window is open', () => {
			const callback = vi.fn((x: number) => x);
			const track = throttle(callback, 100);

			track(1);

			expect(callback).toHaveBeenCalledExactlyOnceWith(1);
		});

		it('should resolve its promise with the result', async () => {
			const track = throttle((x: number) => x * 2, 100);

			const result = settle(track(21));
			await vi.advanceTimersByTimeAsync(0);

			expect(result.current).toEqual({ status: 'resolved', value: 42 });
		});

		it('should reject its promise instead of throwing synchronously', async () => {
			const error = new Error('boom');
			const track = throttle((): number => {
				throw error;
			}, 100);

			let promise: Promise<number> | undefined;
			expect(() => (promise = track())).not.toThrow();

			const result = settle(promise!);
			await vi.advanceTimersByTimeAsync(0);
			expect(result.current).toEqual({ status: 'rejected', reason: error });
		});
	});

	describe('Trailing call', () => {
		it('should run with the latest args when the window ends', async () => {
			const callback = vi.fn((x: number) => x);
			const track = throttle(callback, 100);

			track(1);
			track(2);
			track(3);
			await vi.advanceTimersByTimeAsync(99);
			expect(callback).toHaveBeenCalledTimes(1);

			await vi.advanceTimersByTimeAsync(1);
			expect(callback).toHaveBeenCalledTimes(2);
			expect(callback).toHaveBeenLastCalledWith(3);
		});

		it('should resolve every call made during the window with the trailing result', async () => {
			const track = throttle((x: number) => x * 10, 100);

			const leading = settle(track(1));
			const second = settle(track(2));
			const third = settle(track(3));
			await vi.advanceTimersByTimeAsync(100);

			expect(leading.current).toEqual({ status: 'resolved', value: 10 });
			expect(second.current).toEqual({ status: 'resolved', value: 30 });
			expect(third.current).toEqual({ status: 'resolved', value: 30 });
		});

		it('should reject the trailing promise when the callback throws', async () => {
			const error = new Error('boom');
			const track = throttle((x: number) => {
				if (x > 1) throw error;
				return x;
			}, 100);

			const leading = settle(track(1));
			const trailing = settle(track(2));
			await vi.advanceTimersByTimeAsync(100);

			expect(trailing.current).toEqual({ status: 'rejected', reason: error });
			expect(leading.current).toEqual({ status: 'resolved', value: 1 });
		});

		it('should not extend the window when called inside it', async () => {
			const callback = vi.fn((x: number) => x);
			const track = throttle(callback, 100);

			track(1);
			await vi.advanceTimersByTimeAsync(80);
			track(2);
			await vi.advanceTimersByTimeAsync(20);

			expect(callback).toHaveBeenCalledTimes(2);
			expect(callback).toHaveBeenLastCalledWith(2);
		});

		it('should open a new window after a trailing run', async () => {
			const callback = vi.fn((x: number) => x);
			const track = throttle(callback, 100);

			track(1);
			track(2);
			await vi.advanceTimersByTimeAsync(110);
			expect(callback).toHaveBeenCalledTimes(2);

			track(3);
			expect(callback).toHaveBeenCalledTimes(2);

			await vi.advanceTimersByTimeAsync(90);
			expect(callback).toHaveBeenCalledTimes(3);
			expect(callback).toHaveBeenLastCalledWith(3);
		});

		it('should close the window when none is stored, so the next call leads', async () => {
			const callback = vi.fn((x: number) => x);
			const track = throttle(callback, 100);

			track(1);
			await vi.advanceTimersByTimeAsync(100);
			expect(callback).toHaveBeenCalledTimes(1);

			track(2);
			expect(callback).toHaveBeenCalledTimes(2);
			expect(callback).toHaveBeenLastCalledWith(2);
		});
	});

	describe('Defaults', () => {
		it('should not have opened a new window at 249ms and have at 250ms by default', async () => {
			const callback = vi.fn((x: number) => x);
			const track = throttle(callback);

			track(1);
			await vi.advanceTimersByTimeAsync(249);
			track(2);
			expect(callback).toHaveBeenCalledTimes(1);

			await vi.advanceTimersByTimeAsync(1);
			expect(callback).toHaveBeenCalledTimes(2);
			expect(callback).toHaveBeenLastCalledWith(2);
		});
	});

	describe('cancel', () => {
		it('should drop the trailing call', async () => {
			const callback = vi.fn((x: number) => x);
			const track = throttle(callback, 100);

			track(1);
			track(2);
			expect(callback).toHaveBeenCalledTimes(1);

			track.cancel();
			await vi.advanceTimersByTimeAsync(100);
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should leave the trailing promise unsettled without an unhandled rejection', async () => {
			const track = throttle((x: number) => x, 100);

			const leading = settle(track(1));
			const trailing = settle(track(2));
			track.cancel();
			await vi.advanceTimersByTimeAsync(100);

			expect(leading.current).toEqual({ status: 'resolved', value: 1 });
			expect(trailing.current).toEqual({ status: 'pending' });
		});

		it('should close the window so the next call leads', () => {
			const callback = vi.fn((x: number) => x);
			const track = throttle(callback, 100);

			track(1);
			track.cancel();
			track(2);

			expect(callback).toHaveBeenCalledTimes(2);
			expect(callback).toHaveBeenLastCalledWith(2);
		});

		it('should do nothing when no window is open', () => {
			const callback = vi.fn((x: number) => x);
			const track = throttle(callback, 100);

			expect(() => track.cancel()).not.toThrow();
			track(1);

			expect(callback).toHaveBeenCalledExactlyOnceWith(1);
		});
	});

	describe('pending', () => {
		it('should be false after a leading call', () => {
			const callback = vi.fn();
			const track = throttle(callback, 100);
			const pending = $derived(track.pending);

			track();
			flushSync();

			expect(callback).toHaveBeenCalledOnce();
			expect(untrack(() => pending)).toBe(false);
		});

		it('should be true in a $derived while a trailing call is stored', () => {
			const track = throttle(() => {}, 100);
			const pending = $derived(track.pending);

			track();
			flushSync();
			expect(untrack(() => pending)).toBe(false);

			track();
			flushSync();
			expect(untrack(() => pending)).toBe(true);
		});

		it('should be false once the trailing call runs', async () => {
			const seen: boolean[] = [];
			const track = throttle(() => {
				seen.push(track.pending);
			}, 100);
			const pending = $derived(track.pending);

			track();
			track();
			flushSync();
			expect(untrack(() => pending)).toBe(true);

			await vi.advanceTimersByTimeAsync(100);
			expect(seen).toEqual([false, false]);
			expect(untrack(() => pending)).toBe(false);
		});

		it('should be false after cancel', () => {
			const track = throttle(() => {}, 100);
			const pending = $derived(track.pending);

			track();
			track();
			flushSync();
			expect(untrack(() => pending)).toBe(true);

			track.cancel();
			flushSync();
			expect(untrack(() => pending)).toBe(false);
		});
	});

	describe('Edge Cases', () => {
		it('should run a same-tick trailing call on the next timer tick when wait is 0', async () => {
			const callback = vi.fn((x: number) => x);
			const track = throttle(callback, 0);

			track(1);
			track(2);
			expect(callback).toHaveBeenCalledTimes(1);

			await vi.advanceTimersByTimeAsync(0);
			expect(callback).toHaveBeenCalledTimes(2);
			expect(callback).toHaveBeenLastCalledWith(2);
		});

		it('should run an $effect that stores a trailing call once', async () => {
			const callback = vi.fn((x: number) => x);
			const track = throttle(callback, 100);
			track(1);
			let runs = 0;
			const cleanup = $effect.root(() => {
				$effect(() => {
					runs++;
					track(2);
				});
			});

			flushSync();
			await vi.advanceTimersByTimeAsync(100);
			flushSync();

			expect(runs).toBe(1);
			expect(callback).toHaveBeenCalledTimes(2);
			expect(callback).toHaveBeenLastCalledWith(2);
			cleanup();
		});
	});
});
