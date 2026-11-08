import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Idle } from './idle.svelte.js';

const TIMEOUT = 5000;
const ACTIVITY = ['pointermove', 'pointerdown', 'keydown', 'wheel'];

/** Captured before the fake timers patch it, because channel delivery runs on the real event loop. */
const realSetTimeout = globalThis.setTimeout.bind(globalThis);

const cleanups: (() => void)[] = [];

function watch(idle: Idle) {
	const seen: (boolean | undefined)[] = [];
	const cleanup = $effect.root(() => {
		const value = $derived(idle.current);
		$effect(() => {
			seen.push(value);
		});
	});
	cleanups.push(cleanup);
	flushSync();
	return { seen, cleanup };
}

function channel() {
	const opened = new BroadcastChannel('kenspeckle:idle');
	cleanups.push(() => opened.close());
	return opened;
}

function deliver() {
	return new Promise((resolve) => realSetTimeout(resolve, 50));
}

async function advance(ms: number) {
	await vi.advanceTimersByTimeAsync(ms);
	flushSync();
}

function setVisibility(state: DocumentVisibilityState) {
	Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
	document.dispatchEvent(new Event('visibilitychange'));
}

function handlersFor(spy: { mock: { calls: unknown[][] } }) {
	return spy.mock.calls
		.filter(([type]) => ACTIVITY.includes(type as string))
		.map(([type, handler]) => [type, handler])
		.sort(([a], [b]) => String(a).localeCompare(String(b)));
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	cleanups.splice(0).forEach((cleanup) => cleanup());
	Reflect.deleteProperty(document, 'visibilityState');
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe('Idle', () => {
	describe('Timeout', () => {
		it('should be false before the timeout and true at it', async () => {
			const { seen } = watch(new Idle(TIMEOUT));
			expect(seen).toEqual([false]);

			await advance(TIMEOUT - 1);
			expect(seen).toEqual([false]);

			await advance(1);
			expect(seen).toEqual([false, true]);
		});

		it('should not reset when the tab is hidden', async () => {
			const { seen } = watch(new Idle(TIMEOUT));

			await advance(2000);
			setVisibility('hidden');
			await advance(TIMEOUT - 2000);

			expect(seen).toEqual([false, true]);
		});
	});

	describe('Activity', () => {
		it.each(ACTIVITY)('should reset on %s', async (type) => {
			const { seen } = watch(new Idle(TIMEOUT));

			await advance(4000);
			window.dispatchEvent(new Event(type));
			await advance(TIMEOUT - 1);
			expect(seen).toEqual([false]);

			await advance(1);
			expect(seen).toEqual([false, true]);
		});
	});

	describe('Cross-tab', () => {
		it('should reset on a message from a second instance or channel', async () => {
			const other = channel();
			const { seen } = watch(new Idle(TIMEOUT));

			await advance(3000);
			other.postMessage(Date.now());
			await deliver();
			await advance(TIMEOUT - 1);
			expect(seen).toEqual([false]);

			await advance(1);
			expect(seen).toEqual([false, true]);
		});

		it('should turn false as soon as a message ends an idle stretch', async () => {
			const other = channel();
			const { seen } = watch(new Idle(500));
			await advance(500);
			expect(seen).toEqual([false, true]);

			await advance(300);
			other.postMessage(Date.now());
			await deliver();
			flushSync();
			expect(seen).toEqual([false, true, false]);
		});

		it('should broadcast at most once per second', async () => {
			const received: unknown[] = [];
			channel().addEventListener('message', (event) => received.push(event.data));
			watch(new Idle(TIMEOUT));

			for (let i = 0; i < 10; i++) {
				window.dispatchEvent(new Event('pointermove'));
				await advance(99);
			}
			await deliver();
			expect(received).toHaveLength(1);

			await advance(1000 - 990);
			await deliver();
			expect(received).toHaveLength(2);
		});

		it('should ignore a remote timestamp older than its own latest activity', async () => {
			const other = channel();
			const { seen } = watch(new Idle(TIMEOUT));

			await advance(3000);
			window.dispatchEvent(new Event('pointermove'));
			other.postMessage(Date.now() - 2000);
			await deliver();

			await advance(TIMEOUT - 1);
			expect(seen).toEqual([false]);

			await advance(1);
			expect(seen).toEqual([false, true]);
		});
	});

	describe('Subscribing', () => {
		it('should start the idle clock when the first reader subscribes, not at construction', async () => {
			const idle = new Idle(TIMEOUT);
			await advance(3000);

			const { seen } = watch(idle);
			await advance(TIMEOUT - 1);
			expect(seen).toEqual([false]);

			await advance(1);
			expect(seen).toEqual([false, true]);
		});

		it('should restart the idle clock when a reader subscribes after the last one left', async () => {
			const idle = new Idle(TIMEOUT);
			const first = watch(idle);
			first.cleanup();
			await advance(TIMEOUT + 1000);

			const { seen } = watch(idle);
			expect(seen).toEqual([false]);

			await advance(TIMEOUT);
			expect(seen).toEqual([false, true]);
		});

		it('should turn true exactly a timeout after activity that ends an idle stretch', async () => {
			const { seen } = watch(new Idle(500));
			await advance(500);
			expect(seen).toEqual([false, true]);

			await advance(300);
			window.dispatchEvent(new Event('pointerdown'));
			flushSync();
			expect(seen).toEqual([false, true, false]);

			await advance(499);
			expect(seen).toEqual([false, true, false]);

			await advance(1);
			expect(seen).toEqual([false, true, false, true]);
		});
	});

	describe('Raw readers', () => {
		it('should rerun an effect reading current only when the boolean flips', async () => {
			const idle = new Idle(TIMEOUT);
			const seen: (boolean | undefined)[] = [];
			cleanups.push(
				$effect.root(() => {
					$effect(() => {
						seen.push(idle.current);
					});
				})
			);
			flushSync();

			for (let i = 0; i < 3; i++) {
				window.dispatchEvent(new Event('pointermove'));
				await advance(1000);
			}
			expect(seen).toEqual([false]);

			await advance(TIMEOUT);
			expect(seen).toEqual([false, true]);
		});

		it('should read fresh outside an effect', () => {
			const idle = new Idle(TIMEOUT);
			expect(idle.current).toBe(false);

			vi.advanceTimersByTime(TIMEOUT);
			expect(idle.current).toBe(true);
		});
	});

	describe('Teardown', () => {
		it('should drop a pending throttled activity when the last reading effect is destroyed', async () => {
			const received: unknown[] = [];
			channel().addEventListener('message', (event) => received.push(event.data));
			const { cleanup } = watch(new Idle(TIMEOUT));

			window.dispatchEvent(new Event('pointermove'));
			await advance(500);
			window.dispatchEvent(new Event('pointermove'));
			await deliver();
			expect(received).toHaveLength(1);

			cleanup();
			await vi.advanceTimersByTimeAsync(0);
			expect(vi.getTimerCount()).toBe(0);

			await advance(1000);
			await deliver();
			expect(received).toHaveLength(1);
		});

		it('should remove the listeners and close the channel when the last reading effect is destroyed', async () => {
			const add = vi.spyOn(window, 'addEventListener');
			const remove = vi.spyOn(window, 'removeEventListener');
			const close = vi.spyOn(BroadcastChannel.prototype, 'close');
			const { cleanup } = watch(new Idle(TIMEOUT));
			expect(handlersFor(add).map(([type]) => type)).toEqual(expect.arrayContaining(ACTIVITY));
			expect(close).not.toHaveBeenCalled();

			cleanup();
			await vi.advanceTimersByTimeAsync(0);

			expect(handlersFor(remove)).toEqual(handlersFor(add));
			expect(close).toHaveBeenCalledOnce();
		});
	});
});
