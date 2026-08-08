import { settled } from 'svelte';
import { prefersReducedMotion } from 'svelte/motion';

export type StartViewTransition = (update: () => void | Promise<void>) => ViewTransition;

/** A union of signatures, not `() => void | Promise<void>`: TS's void-return relaxation applies per
 *  member, so only this shape accepts a concise arrow like `() => (count += 1)`. */
export type ViewTransitionUpdate = (() => void) | (() => Promise<void>);

export interface ViewTransitionOptions {
	/** Reverse direction — writes `step-retreat` instead of `step-forward`. */
	retreat?: boolean;
	/** Past this a crossfade reads as a hang: the update callback suspends rendering until it settles. */
	deadline?: number;
	onStart?: () => void;
	onSettle?: () => void;
	reducedMotion?: () => boolean;
	/** Injected in tests; keeps the `bind` internal and init SSR-safe. */
	start?: StartViewTransition;
}

/** @internal — `/kit` supplies its own attribute vocabulary. Not re-exported from the barrel. */
export interface RunOptions extends ViewTransitionOptions {
	state?: string;
}

const ignore = () => {};
const root = () => document.documentElement;

// A consumer throw must not strand the transition, so it goes to the page's error handling instead.
const guard = (callback?: () => void) => {
	try {
		callback?.();
	} catch (error) {
		reportError(error);
	}
};

// One transition per document: starting a second skips the first, whose `finished` then settles.
let active: ViewTransition | undefined;

export function viewTransition(
	update: ViewTransitionUpdate,
	options: ViewTransitionOptions = {}
): ViewTransition | undefined {
	return runViewTransition(update, {
		...options,
		state: options.retreat ? 'step-retreat' : 'step-forward'
	});
}

/** @internal */
export function runViewTransition(
	update: ViewTransitionUpdate,
	{
		deadline = 600,
		onStart,
		onSettle,
		reducedMotion = () => prefersReducedMotion.current,
		start,
		state = 'step-forward'
	}: RunOptions = {}
): ViewTransition | undefined {
	// Resolved per call, never at module scope: SSR must not touch document.
	const startTransition =
		start ??
		(typeof document === 'undefined' ? undefined : document.startViewTransition?.bind(document));

	// No transition at all, not merely no animation — the update callback suspends rendering.
	if (!startTransition || reducedMotion()) {
		// A sync throw still propagates; an async rejection is swallowed as the transition path swallows `finished`.
		void Promise.resolve(update()).catch(ignore);
		return;
	}

	root().dataset.viewTransition = state;
	guard(onStart);

	// `settled()`, not `tick()`: the browser snapshots the moment this callback resolves, and an async
	// component's commit is batched — `tick()` only flushes synchronous updates and passes by luck.
	const transition = startTransition(async () => {
		await update();
		await settled();
	});

	// Synchronously, before any microtask: a superseded predecessor settles one tick later.
	active = transition;

	const timer = setTimeout(() => transition.skipTransition(), deadline);

	// Disarmed on the update callback, not `finished`: armed through the animation it snaps a running morph.
	void transition.updateCallbackDone.catch(ignore).finally(() => clearTimeout(timer));

	// Swallowed so cleanup still runs when the update callback threw; a skip fulfils `finished`.
	void transition.finished.catch(ignore).finally(() => {
		// Superseded: the successor owns the state and the claimed names, so its cleanup is not ours to run.
		if (active !== transition) return;
		active = undefined;
		delete root().dataset.viewTransition;
		guard(onSettle);
	});

	// A skip rejects `ready`; unhandled, Chrome logs AbortError on the slow navigations the deadline rescues.
	void transition.ready.catch(ignore);

	return transition;
}
