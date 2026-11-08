import { DEFAULT_WAIT, Scheduler } from './debounce.svelte.js';

export type ThrottledFunction<Args extends unknown[], Return> = {
	(...args: Args): Promise<Awaited<Return>>;
	readonly pending: boolean;
	cancel(): void;
};

export function throttle<Args extends unknown[], Return>(
	callback: (...args: Args) => Return,
	wait = DEFAULT_WAIT
): ThrottledFunction<Args, Return> {
	const scheduler = new Scheduler(callback, () => wait, { leading: true });
	return Object.defineProperties((...args: Args) => scheduler.call(...args), {
		pending: { get: () => scheduler.pending },
		cancel: { value: () => scheduler.cancel() }
	}) as ThrottledFunction<Args, Return>;
}
