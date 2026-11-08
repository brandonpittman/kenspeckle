import { afterEach, describe, expect, it, vi } from 'vitest';
import * as kit from './kit/index.js';
import type { Navigation, NavigationTransitionOptions } from './kit/index.js';
import { endTransition } from './kit/view-transition-name.js';

const { onNavigate } = vi.hoisted(() => ({ onNavigate: vi.fn() }));

vi.mock('$app/navigation', () => ({ onNavigate }));

const { enableViewTransitions } = kit as typeof kit & {
	enableViewTransitions?: (options?: NavigationTransitionOptions) => void;
};

function fakeStart() {
	return vi.fn((update: () => void | Promise<void>) => {
		void Promise.resolve(update()).catch(() => {});
		return {
			ready: Promise.resolve(),
			updateCallbackDone: Promise.resolve(),
			finished: new Promise<void>(() => {}),
			skipTransition: () => {}
		} as unknown as ViewTransition;
	});
}

afterEach(() => {
	onNavigate.mockReset();
	endTransition();
	delete document.documentElement.dataset.viewTransition;
});

describe('enableViewTransitions', () => {
	it('should register exactly one onNavigate handler', () => {
		enableViewTransitions?.();

		expect(onNavigate).toHaveBeenCalledOnce();
		expect(onNavigate).toHaveBeenCalledWith(expect.any(Function));
	});

	it('should not export viewTransition from kenspeckle/kit', () => {
		expect(kit).not.toHaveProperty('viewTransition');
	});

	it('should still pass the navigation to onStart in the navigation form', () => {
		const onStart = vi.fn();
		const navigation: Navigation = { complete: Promise.resolve() };

		enableViewTransitions?.({ start: fakeStart(), onStart });
		const handler = onNavigate.mock.calls[0]?.[0] as
			((navigation: Navigation) => Promise<void>) | undefined;
		void handler?.(navigation);

		expect(onStart).toHaveBeenCalledWith(navigation);
	});
});
