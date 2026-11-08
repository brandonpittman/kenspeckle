export type DebouncedFunction<Args extends unknown[], Return> = {
	(...args: Args): Promise<Awaited<Return>>;
	readonly pending: boolean;
	flush(): void;
	cancel(): void;
};

export const DEFAULT_WAIT = 250;

type Scheduled<Args extends unknown[], Return> = {
	args: Args;
	deferred: PromiseWithResolvers<Awaited<Return>>;
};

/** `Promise.withResolvers` would raise the runtime floor to Safari 17.4 and Node 22. */
function withResolvers<T>(): PromiseWithResolvers<T> {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

/**
 * `wait` is a getter so `FiniteStateMachine.debounce` can take a different wait on each call.
 * `leading` runs a call at once when no window is open, and the window it opens is fixed: later
 * calls wait for it to end instead of restarting it.
 */
export class Scheduler<Args extends unknown[], Return> {
	#callback: (...args: Args) => Return;
	#wait: () => number;
	#leading: boolean;
	#timer: ReturnType<typeof setTimeout> | undefined;
	/** Plain, so a call made inside an `$effect` doesn't make the effect depend on it. */
	#scheduled: Scheduled<Args, Return> | undefined;
	#reactive: boolean;
	#tracked = $state(false);
	#untracked = false;

	/**
	 * `reactive: false` keeps `pending` out of Svelte's graph, so a `$derived` or template expression
	 * can call the scheduler: writing `$state` there throws `state_unsafe_mutation`.
	 */
	constructor(
		callback: (...args: Args) => Return,
		wait: () => number,
		{ leading = false, reactive = true }: { leading?: boolean; reactive?: boolean } = {}
	) {
		this.#callback = callback;
		this.#wait = wait;
		this.#leading = leading;
		this.#reactive = reactive;
	}

	get pending(): boolean {
		return this.#pending;
	}

	get #pending(): boolean {
		return this.#reactive ? this.#tracked : this.#untracked;
	}

	set #pending(value: boolean) {
		if (this.#reactive) this.#tracked = value;
		else this.#untracked = value;
	}

	call(...args: Args): Promise<Awaited<Return>> {
		if (this.#leading && this.#timer === undefined) {
			const deferred = withResolvers<Awaited<Return>>();
			this.#start();
			this.#run({ args, deferred });
			return deferred.promise;
		}
		const deferred = this.#scheduled?.deferred ?? withResolvers<Awaited<Return>>();
		this.#scheduled = { args, deferred };
		this.#pending = true;
		if (!this.#leading) this.#start();
		return deferred.promise;
	}

	flush(): void {
		clearTimeout(this.#timer);
		this.#elapse();
	}

	/** The promise is left unsettled: rejecting would be unhandled in every fire-and-forget caller. */
	cancel(): void {
		clearTimeout(this.#timer);
		this.#timer = undefined;
		this.#scheduled = undefined;
		this.#pending = false;
	}

	#start(): void {
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => this.#elapse(), this.#wait());
	}

	#elapse(): void {
		this.#timer = undefined;
		const scheduled = this.#scheduled;
		if (scheduled === undefined) return;
		this.#scheduled = undefined;
		this.#pending = false;
		if (this.#leading) this.#start();
		this.#run(scheduled);
	}

	#run({ args, deferred }: Scheduled<Args, Return>): void {
		try {
			deferred.resolve(this.#callback(...args) as Awaited<Return>);
		} catch (error) {
			deferred.reject(error);
		}
	}
}

export function debounce<Args extends unknown[], Return>(
	callback: (...args: Args) => Return,
	wait = DEFAULT_WAIT
): DebouncedFunction<Args, Return> {
	const scheduler = new Scheduler(callback, () => wait);
	return Object.defineProperties((...args: Args) => scheduler.call(...args), {
		pending: { get: () => scheduler.pending },
		flush: { value: () => scheduler.flush() },
		cancel: { value: () => scheduler.cancel() }
	}) as DebouncedFunction<Args, Return>;
}
