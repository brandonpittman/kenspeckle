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

/**
 * `leading` runs a call at once when no window is open, and the window it opens is fixed: later
 * calls wait for it to end instead of restarting it.
 */
export class Scheduler<Args extends unknown[], Return> {
	#callback: (...args: Args) => Return;
	#wait: number;
	#leading: boolean;
	#timer: ReturnType<typeof setTimeout> | undefined;
	/** Plain, so a call made inside an `$effect` doesn't make the effect depend on it. */
	#scheduled: Scheduled<Args, Return> | undefined;
	#pending = $state(false);

	constructor(
		callback: (...args: Args) => Return,
		wait: number,
		{ leading = false }: { leading?: boolean } = {}
	) {
		this.#callback = callback;
		this.#wait = wait;
		this.#leading = leading;
	}

	get pending(): boolean {
		return this.#pending;
	}

	call(...args: Args): Promise<Awaited<Return>> {
		if (this.#leading && this.#timer === undefined) {
			const deferred = Promise.withResolvers<Awaited<Return>>();
			this.#start();
			this.#run({ args, deferred });
			return deferred.promise;
		}
		const deferred = this.#scheduled?.deferred ?? Promise.withResolvers<Awaited<Return>>();
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
		this.#timer = setTimeout(() => this.#elapse(), this.#wait);
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
	const scheduler = new Scheduler(callback, wait);
	return Object.defineProperties((...args: Args) => scheduler.call(...args), {
		pending: { get: () => scheduler.pending },
		flush: { value: () => scheduler.flush() },
		cancel: { value: () => scheduler.cancel() }
	}) as DebouncedFunction<Args, Return>;
}
