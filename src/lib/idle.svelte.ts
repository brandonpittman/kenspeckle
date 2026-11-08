import { BROWSER } from 'esm-env';
import { on } from 'svelte/events';
import { createSubscriber } from 'svelte/reactivity';
import { Countdown } from './countdown.svelte.js';
import { throttle } from './throttle.svelte.js';

const ACTIVITY = ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const;

export class Idle {
	/** Plain, because the subscriber's start can run during render, where writing `$state` throws. */
	#last = Date.now();
	#countdown: Countdown;
	#subscribe = createSubscriber((update) => {
		this.#last = Date.now();
		const channel = new BroadcastChannel('kenspeckle:idle');
		const active = throttle(() => {
			this.#last = Date.now();
			update();
			channel.postMessage(this.#last);
		}, 1000);
		channel.addEventListener('message', ({ data }: MessageEvent<number>) => {
			if (data <= this.#last) return;
			this.#last = data;
			update();
		});
		const off = ACTIVITY.map((type) => on(window, type, active));
		return () => {
			off.forEach((remove) => remove());
			active.cancel();
			channel.close();
		};
	});

	/** Countdown and activity rerun subscribers about once a second, so a reader tracking them directly would rerun while the boolean holds still. */
	#idle = $derived.by(() => {
		this.#subscribe();
		return this.#countdown.current === 0;
	});

	constructor(timeout: number) {
		this.#countdown = new Countdown(() => this.#last + timeout);
	}

	get current(): boolean | undefined {
		if (!BROWSER) return undefined;
		/** An unowned derived would cache across untracked reads, since nothing it depends on changes when the clock passes the deadline. */
		if (!$effect.tracking()) return this.#countdown.current === 0;
		return this.#idle;
	}
}
