import { afterEach, describe, expect, it, vi } from 'vitest';
import { isRetreat, navigationTransition, retreat } from './view-transition.js';
import { endTransition, viewTransitionName } from './view-transition-name.js';
import type { Navigation } from './types.js';

const nav = (overrides: Partial<Navigation> = {}): Navigation => ({
	complete: Promise.resolve(),
	from: { url: new URL('https://x.test/a') },
	to: { url: new URL('https://x.test/b') },
	...overrides
});

afterEach(() => {
	retreat(() => false);
	// The registry is module scope, and a test whose `finished` never settles leaves a phase in flight.
	endTransition();
});

describe('retreat', () => {
	it('defaults to forward', () => {
		expect(isRetreat(nav())).toBe(false);
	});

	it('consults the registered predicate', () => {
		retreat((n) => n.to?.url.pathname === '/b');
		expect(isRetreat(nav())).toBe(true);
	});

	it('treats a popstate as a retreat whatever the predicate says', () => {
		retreat(() => false);
		expect(isRetreat(nav({ type: 'popstate' }))).toBe(true);
	});

	it('treats a backward popstate as a retreat', () => {
		retreat(() => false);
		expect(isRetreat(nav({ type: 'popstate', delta: -1 }))).toBe(true);
	});

	it('treats a forward popstate as a forward navigation', () => {
		retreat(() => false);
		expect(isRetreat(nav({ type: 'popstate', delta: 1 }))).toBe(false);
	});

	it('still consults the predicate on a forward popstate', () => {
		retreat(() => true);
		expect(isRetreat(nav({ type: 'popstate', delta: 1 }))).toBe(true);
	});

	it('replaces the predicate rather than stacking them', () => {
		retreat(() => true);
		retreat(() => false);
		expect(isRetreat(nav())).toBe(false);
	});

	it('stops consulting a disposed predicate', () => {
		const dispose = retreat(() => true);
		dispose();
		expect(isRetreat(nav())).toBe(false);
	});

	it('leaves a newer predicate installed when a stale disposer runs', () => {
		const dispose = retreat(() => false);
		retreat(() => true);
		dispose();
		expect(isRetreat(nav())).toBe(true);
	});
});

const root = () => document.documentElement;
const state = () => root().dataset.viewTransition;

/** Hand-driven stand-in: `finished` stays pending until `finish()`, so cleanup is observable. */
function fakeStart(updateDone: Promise<void> = Promise.resolve()) {
	const skipTransition = vi.fn();
	let finish!: () => void;
	const finished = new Promise<void>((resolve) => (finish = resolve));
	const start = vi.fn((update: () => void | Promise<void>) => {
		void Promise.resolve(update()).catch(() => {});
		return {
			ready: updateDone,
			updateCallbackDone: updateDone,
			finished,
			skipTransition
		} as unknown as ViewTransition;
	});
	return { start, skipTransition, finish };
}

describe('navigationTransition — the attribute', () => {
	afterEach(() => {
		delete root().dataset.viewTransition;
	});

	it('writes forward on an ordinary navigation', () => {
		const { start } = fakeStart();
		void navigationTransition({ start })(nav());
		expect(state()).toBe('forward');
	});

	it('writes retreat when the predicate says so', () => {
		retreat(() => true);
		const { start } = fakeStart();
		void navigationTransition({ start })(nav());
		expect(state()).toBe('retreat');
	});

	it('writes retreat on a popstate', () => {
		const { start } = fakeStart();
		void navigationTransition({ start })(nav({ type: 'popstate' }));
		expect(state()).toBe('retreat');
	});

	it('clears the attribute and calls onSettle once finished settles', async () => {
		const { start, finish } = fakeStart();
		const onSettle = vi.fn();
		void navigationTransition({ start, onSettle })(nav());
		finish();
		await vi.waitFor(() => expect(onSettle).toHaveBeenCalledTimes(1));
		expect(state()).toBeUndefined();
	});

	it('hands onStart the navigation', () => {
		const { start } = fakeStart();
		const onStart = vi.fn();
		const navigation = nav();
		void navigationTransition({ start, onStart })(navigation);
		expect(onStart).toHaveBeenCalledWith(navigation);
	});
});

describe('navigationTransition — the ordering guarantee', () => {
	it('resolves before navigation.complete settles', async () => {
		const { start } = fakeStart();
		// Never settles: if the handler awaited it, Kit and the browser would wait on each other forever.
		const navigation = nav({ complete: new Promise<void>(() => {}) });
		await navigationTransition({ start })(navigation);
		expect(state()).toBe('forward');
		delete root().dataset.viewTransition;
	});

	it('resolves under reduced motion without starting a transition', async () => {
		const { start } = fakeStart();
		await navigationTransition({ start, reducedMotion: () => true })(nav());
		expect(start).not.toHaveBeenCalled();
		expect(state()).toBeUndefined();
	});
});

describe('navigationTransition — naming integration', () => {
	afterEach(() => {
		delete root().dataset.viewTransition;
		document.body.replaceChildren();
	});

	it('names a claimed element for the transition and clears it after', async () => {
		const node = document.createElement('div');
		document.body.appendChild(node);
		const cleanup = viewTransitionName(node, 'hero');
		const { start, finish } = fakeStart();
		void navigationTransition({ start })(nav());
		expect(node.style.viewTransitionName).toBe('hero');
		finish();
		await vi.waitFor(() => expect(node.style.viewTransitionName).toBe(''));
		cleanup();
	});

	it('names an onArrival element only once the DOM has committed', async () => {
		const node = document.createElement('div');
		document.body.appendChild(node);
		const cleanup = viewTransitionName(node, 'hero', { onArrival: true });
		let commit!: () => void;
		const complete = new Promise<void>((resolve) => (commit = resolve));
		const { start } = fakeStart();
		void navigationTransition({ start })(nav({ complete }));
		expect(node.style.viewTransitionName).toBe('');
		commit();
		await vi.waitFor(() => expect(node.style.viewTransitionName).toBe('hero'));
		cleanup();
	});

	it('keeps the successor navigation names when a superseded transition finishes', async () => {
		const node = document.createElement('div');
		document.body.appendChild(node);
		const cleanup = viewTransitionName(node, 'hero');
		const first = fakeStart();
		const second = fakeStart();
		void navigationTransition({ start: first.start })(nav());
		void navigationTransition({ start: second.start })(nav());
		first.finish();
		await new Promise((r) => setTimeout(r));
		expect(node.style.viewTransitionName).toBe('hero');
		expect(state()).toBe('forward');
		cleanup();
	});

	it('resolves the navigation and releases the name when a consumer onStart throws', async () => {
		const reported = vi.spyOn(window, 'reportError').mockImplementation(() => {});
		const node = document.createElement('div');
		document.body.appendChild(node);
		const cleanup = viewTransitionName(node, 'hero');
		const { start, finish } = fakeStart();
		const boom = new Error('onStart');
		await navigationTransition({
			start,
			onStart: () => {
				throw boom;
			}
		})(nav());
		expect(node.style.viewTransitionName).toBe('hero');
		finish();
		await vi.waitFor(() => expect(node.style.viewTransitionName).toBe(''));
		expect(reported).toHaveBeenCalledWith(boom);
		cleanup();
		reported.mockRestore();
	});

	it('leaves claims alone when reduced motion skips the transition', async () => {
		const node = document.createElement('div');
		document.body.appendChild(node);
		const cleanup = viewTransitionName(node, 'hero', { onArrival: true });
		const { start } = fakeStart();
		await navigationTransition({ start, reducedMotion: () => true })(nav());
		await new Promise((r) => setTimeout(r));
		expect(node.style.viewTransitionName).toBe('');
		cleanup();
	});
});
