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

/** `wait` is a getter so `FiniteStateMachine.debounce` can take a different wait on each call. */
export class Scheduler<Args extends unknown[], Return> {
	#callback: (...args: Args) => Return;
	#wait: () => number;
	#timer: ReturnType<typeof setTimeout> | undefined;
	/** Plain, so a call made inside an `$effect` doesn't make the effect depend on it. */
	#scheduled: Scheduled<Args, Return> | undefined;
	#pending = $state(false);

	constructor(callback: (...args: Args) => Return, wait: () => number) {
		this.#callback = callback;
		this.#wait = wait;
	}

	get pending(): boolean {
		return this.#pending;
	}

	call(...args: Args): Promise<Awaited<Return>> {
		const deferred = this.#scheduled?.deferred ?? withResolvers<Awaited<Return>>();
		this.#scheduled = { args, deferred };
		this.#pending = true;
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => this.flush(), this.#wait());
		return deferred.promise;
	}

	flush(): void {
		const scheduled = this.#scheduled;
		if (scheduled === undefined) return;
		this.cancel();
		this.#run(scheduled);
	}

	/** The promise is left unsettled: rejecting would be unhandled in every fire-and-forget caller. */
	cancel(): void {
		clearTimeout(this.#timer);
		this.#scheduled = undefined;
		this.#pending = false;
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
