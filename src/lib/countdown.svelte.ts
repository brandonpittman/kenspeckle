import { BROWSER } from 'esm-env';
import { untrack } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';

const SECOND = 1000;

/** A `NaN` deadline counts as already passed, the way a server treats an unparseable expiry. */
function remaining(deadline: number | undefined): number | undefined {
	if (deadline === undefined) return undefined;
	return Math.max(0, deadline - Date.now()) || 0;
}

export class Countdown {
	#deadline: () => number | undefined;
	#shown: number | undefined;

	#subscribe = createSubscriber((update) => {
		let timer: ReturnType<typeof setTimeout>;
		const arm = (deadline: number | undefined) => {
			/** Landing on whole seconds left keeps a `Math.ceil(current / 1000)` display flipping on time; rounding up keeps a fractional deadline from truncating to a zero delay that lands short of the boundary. */
			const delay = Math.ceil((remaining(deadline) ?? 0) % SECOND) || SECOND;
			timer = setTimeout(() => {
				const next = untrack(() => this.#deadline());
				const left = remaining(next);
				/** Rerunning readers on an unchanged 0 or `undefined` would repeat an expiry side effect every second. */
				if (left !== this.#shown) {
					this.#shown = left;
					update();
				}
				arm(next);
			}, delay);
		};
		const follow = () => {
			clearTimeout(timer);
			let deadline: number | undefined;
			try {
				deadline = this.#deadline();
			} catch {
				/** The error is left to the reader's own read of `current`, which rethrows it inside the reader's boundary; the root has none above it. */
				return;
			}
			this.#shown = remaining(deadline);
			arm(deadline);
		};
		/** The effect below inherits the first reader's boundary and waits while that boundary is pending, so arming here keeps every other reader ticking meanwhile. */
		follow();
		/** A root rather than a plain effect, so the watch belongs to every reader together and not to whichever subscribed first. */
		const stop = $effect.root(() => {
			$effect(follow);
		});
		return () => {
			stop();
			clearTimeout(timer);
		};
	});

	constructor(deadline: () => number | undefined) {
		this.#deadline = deadline;
	}

	get current(): number | undefined {
		if (!BROWSER) return undefined;
		this.#subscribe();
		return remaining(this.#deadline());
	}
}
