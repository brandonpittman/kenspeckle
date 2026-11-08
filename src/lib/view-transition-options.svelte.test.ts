import { afterEach, describe, expect, it, vi } from 'vitest';
import { viewTransition, type StartViewTransition } from './view-transition.js';

afterEach(() => {
	delete document.documentElement.dataset.viewTransition;
});

describe('viewTransition direct form options', () => {
	it('should not call an onStart passed around the types', () => {
		const start: StartViewTransition = (update) => {
			void Promise.resolve(update()).catch(() => {});
			return {
				ready: Promise.resolve(),
				updateCallbackDone: Promise.resolve(),
				finished: new Promise<void>(() => {}),
				skipTransition: () => {}
			} as unknown as ViewTransition;
		};
		const onStart = vi.fn();
		const options = { start, reducedMotion: () => false, onStart };

		viewTransition(() => {}, options);

		expect(onStart).not.toHaveBeenCalled();
	});
});
