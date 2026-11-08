import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Countdown } from './countdown.svelte.js';

/** The `$derived` drops repeat values, so `seen` records only what an effect would act on. */
function watch(countdown: Countdown) {
	const seen: (number | undefined)[] = [];
	const cleanup = $effect.root(() => {
		const left = $derived(countdown.current);
		$effect(() => {
			seen.push(left);
		});
	});
	flushSync();
	return { seen, cleanup };
}

async function advance(ms: number) {
	await vi.advanceTimersByTimeAsync(ms);
	flushSync();
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('Countdown', () => {
	describe('Reading current', () => {
		it('should be undefined while the deadline getter returns undefined', () => {
			const countdown = new Countdown(() => undefined);
			const { seen, cleanup } = watch(countdown);

			expect(countdown.current).toBeUndefined();
			expect(seen).toEqual([undefined]);
			cleanup();
		});

		it('should return fresh milliseconds left when read outside an effect', () => {
			const deadline = Date.now() + 5000;
			const countdown = new Countdown(() => deadline);

			expect(countdown.current).toBe(5000);

			vi.advanceTimersByTime(1500);
			expect(countdown.current).toBe(3500);
		});
	});

	describe('Ticking', () => {
		it('should update at 2,000 ms left when started at 2,500 ms left, then every 1,000 ms, reaching 0 exactly at the deadline', async () => {
			const deadline = Date.now() + 2500;
			const { seen, cleanup } = watch(new Countdown(() => deadline));
			expect(seen).toEqual([2500]);

			await advance(499);
			expect(seen).toEqual([2500]);

			await advance(1);
			expect(seen).toEqual([2500, 2000]);

			await advance(1000);
			expect(seen).toEqual([2500, 2000, 1000]);

			await advance(999);
			expect(seen).toEqual([2500, 2000, 1000]);

			await advance(1);
			expect(seen).toEqual([2500, 2000, 1000, 0]);

			await advance(5000);
			expect(seen).toEqual([2500, 2000, 1000, 0]);
			cleanup();
		});

		it('should reflect a deadline change on the next read and on the next tick', async () => {
			let deadline = Date.now() + 5000;
			const countdown = new Countdown(() => deadline);
			const { seen, cleanup } = watch(countdown);
			expect(seen).toEqual([5000]);

			deadline = Date.now() + 20000;
			expect(countdown.current).toBe(20000);

			await advance(1000);
			expect(seen.at(-1)).toBe(19000);
			cleanup();
		});
	});

	describe('Deadline changes', () => {
		it('should re-arm the pending tick when a read outside an effect sees a new deadline', async () => {
			let deadline = Date.now() + 5000;
			const countdown = new Countdown(() => deadline);
			const { seen, cleanup } = watch(countdown);

			deadline = Date.now() + 20300;
			expect(countdown.current).toBe(20300);

			await advance(299);
			expect(seen).toEqual([5000]);

			await advance(1);
			expect(seen).toEqual([5000, 20000]);
			cleanup();
		});

		it('should push 0 to tracked readers when a read outside an effect sees a deadline moved into the past', async () => {
			let deadline = Date.now() + 5000;
			const countdown = new Countdown(() => deadline);
			const { seen, cleanup } = watch(countdown);

			deadline = Date.now() - 1000;
			expect(countdown.current).toBe(0);

			await advance(1000);
			expect(seen).toEqual([5000, 0]);
			cleanup();
		});

		it('should keep ticking on whole seconds left for a fractional deadline', async () => {
			const deadline = Date.now() + 2500.5;
			const { seen, cleanup } = watch(new Countdown(() => deadline));

			await advance(500);
			expect(seen).toEqual([2500.5]);

			await advance(1);
			expect(seen).toEqual([2500.5, 1999.5]);

			await advance(999);
			expect(seen).toEqual([2500.5, 1999.5]);

			await advance(1);
			expect(seen).toEqual([2500.5, 1999.5, 999.5]);

			await advance(1000);
			expect(seen).toEqual([2500.5, 1999.5, 999.5, 0]);
			cleanup();
		});

		it('should land the next tick on the new deadline when it moves earlier', async () => {
			let deadline = $state(Date.now() + 5000);
			const { seen, cleanup } = watch(new Countdown(() => deadline));

			deadline = Date.now() + 300;
			flushSync();
			expect(seen).toEqual([5000, 300]);

			await advance(299);
			expect(seen).toEqual([5000, 300]);

			await advance(1);
			expect(seen).toEqual([5000, 300, 0]);
			cleanup();
		});

		it('should tick on whole seconds left once an undefined deadline is set', async () => {
			let deadline = $state<number | undefined>(undefined);
			const { seen, cleanup } = watch(new Countdown(() => deadline));
			await advance(400);

			deadline = Date.now() + 1500;
			flushSync();
			expect(seen).toEqual([undefined, 1500]);

			await advance(500);
			expect(seen).toEqual([undefined, 1500, 1000]);
			cleanup();
		});

		it('should rerun a reader once when the deadline jumps into the past', async () => {
			let deadline = $state(Date.now() + 5000);
			const countdown = new Countdown(() => deadline);
			const runs: (number | undefined)[] = [];
			const cleanup = $effect.root(() => {
				$effect(() => {
					runs.push(countdown.current);
				});
			});
			flushSync();

			deadline = Date.now() - 1000;
			flushSync();
			await advance(3000);

			expect(runs).toEqual([5000, 0]);
			cleanup();
		});
	});

	describe('Settled values', () => {
		it('should not rerun a reader once current reaches 0', async () => {
			const deadline = Date.now() + 1000;
			const countdown = new Countdown(() => deadline);
			const runs: (number | undefined)[] = [];
			const cleanup = $effect.root(() => {
				$effect(() => {
					runs.push(countdown.current);
				});
			});
			flushSync();

			await advance(6000);

			expect(runs).toEqual([1000, 0]);
			cleanup();
		});

		it('should not rerun a reader while the deadline is undefined', async () => {
			const countdown = new Countdown(() => undefined);
			const runs: (number | undefined)[] = [];
			const cleanup = $effect.root(() => {
				$effect(() => {
					runs.push(countdown.current);
				});
			});
			flushSync();

			await advance(5000);

			expect(runs).toEqual([undefined]);
			cleanup();
		});
	});

	describe('Teardown', () => {
		it('should clear the timer when the last reading effect is destroyed', async () => {
			const deadline = Date.now() + 5000;
			const { cleanup } = watch(new Countdown(() => deadline));
			expect(vi.getTimerCount()).toBe(1);

			cleanup();
			await vi.advanceTimersByTimeAsync(0);

			expect(vi.getTimerCount()).toBe(0);
		});
	});

	describe('Edge Cases', () => {
		it('should read 0 for a NaN deadline', () => {
			expect(new Countdown(() => Number.NaN).current).toBe(0);
		});

		it('should read 0 for a past deadline', () => {
			const deadline = Date.now() - 1000;

			expect(new Countdown(() => deadline).current).toBe(0);
		});
	});
});
