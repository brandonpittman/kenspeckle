import { afterEach, describe, expect, it, vi } from 'vitest';
import { viewTransition } from './view-transition.js';

// prefersReducedMotion is a MediaQuery built at svelte/motion module scope and its constructor calls
// matchMedia eagerly, so stubbing window.matchMedia here would not reach it.
const motion = vi.hoisted(() => ({ reduced: false }));

vi.mock('svelte/motion', () => ({
	prefersReducedMotion: {
		get current() {
			return motion.reduced;
		}
	}
}));

const settled = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('svelte', async (importOriginal) => ({
	...(await importOriginal<typeof import('svelte')>()),
	settled
}));

const root = () => document.documentElement;
const state = () => root().dataset.viewTransition;

/** Hand-driven stand-in: `finished` stays pending until `finish()`, so cleanup is observable. */
function fakeStart(updateDone: Promise<void> = Promise.resolve(), ready?: Promise<void>) {
	const skipTransition = vi.fn();
	let finish!: () => void;
	const finished = new Promise<void>((resolve) => (finish = resolve));
	const start = vi.fn((update: () => void | Promise<void>) => {
		void Promise.resolve(update()).catch(() => {});
		return {
			ready: ready ?? updateDone,
			updateCallbackDone: updateDone,
			finished,
			skipTransition
		} as unknown as ViewTransition;
	});
	return { start, skipTransition, finish };
}

afterEach(() => {
	vi.useRealTimers();
	motion.reduced = false;
	delete root().dataset.viewTransition;
});

describe('viewTransition — the transition', () => {
	it('runs the update through the injected start', () => {
		const { start } = fakeStart();
		const update = vi.fn();
		viewTransition(update, { start });
		expect(start).toHaveBeenCalledTimes(1);
		expect(update).toHaveBeenCalledTimes(1);
	});

	it('returns the transition object', () => {
		const { start } = fakeStart();
		expect(viewTransition(() => {}, { start })).toBeDefined();
	});

	it('flushes pending svelte updates before the snapshot is taken', async () => {
		const { start } = fakeStart();
		const order: string[] = [];
		settled.mockImplementation(() => {
			order.push('settled');
			return Promise.resolve();
		});
		viewTransition(() => order.push('update'), { start });
		await vi.waitFor(() => expect(order).toEqual(['update', 'settled']));
	});

	it('accepts a concise arrow that returns a value', () => {
		const { start } = fakeStart();
		let count = 0;
		// Compile-time guard: `() => void | Promise<void>` rejects this, a union of signatures accepts it.
		viewTransition(() => (count += 1), { start });
		expect(count).toBe(1);
	});
});

describe('viewTransition — the attribute', () => {
	it('writes step-forward for the duration of the transition', () => {
		const { start } = fakeStart();
		viewTransition(() => {}, { start });
		expect(state()).toBe('step-forward');
	});

	it('writes step-retreat when retreat is set', () => {
		const { start } = fakeStart();
		viewTransition(() => {}, { start, retreat: true });
		expect(state()).toBe('step-retreat');
	});

	it('clears the attribute and calls onSettle once finished settles', async () => {
		const { start, finish } = fakeStart();
		const onSettle = vi.fn();
		viewTransition(() => {}, { start, onSettle });
		expect(state()).toBe('step-forward');
		finish();
		await vi.waitFor(() => expect(onSettle).toHaveBeenCalledTimes(1));
		expect(state()).toBeUndefined();
	});

	it('runs onStart before the snapshot is taken', () => {
		const seen: string[] = [];
		const start = (update: () => void | Promise<void>) => {
			seen.push('start');
			void Promise.resolve(update()).catch(() => {});
			return {
				ready: Promise.resolve(),
				updateCallbackDone: Promise.resolve(),
				finished: new Promise<void>(() => {}),
				skipTransition: () => {}
			} as unknown as ViewTransition;
		};
		viewTransition(() => {}, { start, onStart: () => seen.push('onStart') });
		expect(seen).toEqual(['onStart', 'start']);
	});
});

describe('viewTransition — bailing out', () => {
	it('runs the update without a transition under reduced motion', () => {
		const { start } = fakeStart();
		const update = vi.fn();
		motion.reduced = true;
		const result = viewTransition(update, { start });
		expect(update).toHaveBeenCalledTimes(1);
		expect(start).not.toHaveBeenCalled();
		expect(state()).toBeUndefined();
		expect(result).toBeUndefined();
	});

	it('honours an injected reducedMotion over the default', () => {
		const { start } = fakeStart();
		viewTransition(() => {}, { start, reducedMotion: () => true });
		expect(start).not.toHaveBeenCalled();
	});

	it('runs the update when the API is missing', () => {
		const update = vi.fn();
		const original = document.startViewTransition;
		// defineProperty rather than `delete`: the method is non-optional in lib.dom.
		Object.defineProperty(document, 'startViewTransition', {
			value: undefined,
			configurable: true
		});
		// finally: a throw here would otherwise leave the global stubbed for every later test.
		try {
			viewTransition(update);
		} finally {
			Object.defineProperty(document, 'startViewTransition', {
				value: original,
				configurable: true
			});
		}
		expect(update).toHaveBeenCalledTimes(1);
	});
});

describe('viewTransition — the deadline', () => {
	it('skips the transition once the deadline passes', async () => {
		vi.useFakeTimers();
		const { start, skipTransition } = fakeStart(new Promise<void>(() => {}));
		viewTransition(() => {}, { start, deadline: 600 });
		await vi.advanceTimersByTimeAsync(600);
		expect(skipTransition).toHaveBeenCalledTimes(1);
	});

	it('disarms the deadline once the update callback settles', async () => {
		vi.useFakeTimers();
		const { start, skipTransition } = fakeStart(Promise.resolve());
		viewTransition(() => {}, { start, deadline: 600 });
		await vi.advanceTimersByTimeAsync(0);
		await vi.advanceTimersByTimeAsync(600);
		expect(skipTransition).not.toHaveBeenCalled();
	});
});

describe('viewTransition — promise rejections', () => {
	it('still clears and settles when the update callback throws', async () => {
		const { start, finish } = fakeStart(Promise.reject(new Error('boom')));
		const onSettle = vi.fn();
		viewTransition(() => {}, { start, onSettle });
		finish();
		await vi.waitFor(() => expect(onSettle).toHaveBeenCalledTimes(1));
		expect(state()).toBeUndefined();
	});

	it('leaves no unhandled rejection when ready rejects', async () => {
		const unhandled = vi.fn();
		window.addEventListener('unhandledrejection', unhandled);
		const { start } = fakeStart(Promise.resolve(), Promise.reject(new Error('skipped')));
		viewTransition(() => {}, { start });
		// Two macrotasks: the unhandled-rejection check runs after a microtask checkpoint plus a task.
		await new Promise((r) => setTimeout(r));
		await new Promise((r) => setTimeout(r));
		window.removeEventListener('unhandledrejection', unhandled);
		expect(unhandled).not.toHaveBeenCalled();
	});
});
