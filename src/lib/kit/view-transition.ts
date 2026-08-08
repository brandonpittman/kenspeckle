import { onNavigate } from '$app/navigation';
import {
	runViewTransition,
	viewTransition as directTransition,
	type ViewTransitionOptions,
	type ViewTransitionUpdate
} from '../view-transition.js';
import { beginPhase, endTransition } from './view-transition-name.js';
import type { Navigation } from './types.js';

export interface NavigationTransitionOptions extends Omit<
	ViewTransitionOptions,
	'retreat' | 'onStart'
> {
	onStart?: (navigation: Navigation) => void;
}

const forward = () => false;

let predicate: (navigation: Navigation) => boolean = forward;

/**
 * A predicate, never a flag: Kit skips `beforeNavigate` for a navigation begun while another is in
 * flight, so a flag set at click time can be stranded and reverse a later navigation.
 *
 * Returns a disposer shaped for `$effect` cleanup.
 */
export function retreat(next: (navigation: Navigation) => boolean): () => void {
	predicate = next;
	return () => {
		// Identity-guarded: a stale disposer must not unregister whoever replaced it.
		if (predicate === next) predicate = forward;
	};
}

/** @internal */
export function isRetreat(navigation: Navigation): boolean {
	// Kit sets delta only on a popstate: negative is Back, positive Forward. Absent, assume Back.
	const back = navigation.type === 'popstate' && (navigation.delta ?? -1) < 0;
	return back || predicate(navigation);
}

/** @internal — the handler `viewTransition()` registers, exported so it is testable without a component. */
export function navigationTransition({
	onStart,
	onSettle,
	...rest
}: NavigationTransitionOptions = {}) {
	return (navigation: Navigation): Promise<void> =>
		new Promise<void>((resolve) => {
			let transitioning = false;
			runViewTransition(
				async () => {
					// resolve() BEFORE awaiting breaks a mutual wait: Kit holds the navigation until this
					// promise settles, the browser holds the snapshot until the callback settles.
					resolve();
					await navigation.complete;
					if (transitioning) beginPhase(navigation, 'arrival');
				},
				{
					...rest,
					state: isRetreat(navigation) ? 'retreat' : 'forward',
					onStart: () => {
						transitioning = true;
						beginPhase(navigation, 'capture');
						onStart?.(navigation);
					},
					onSettle: () => {
						transitioning = false;
						endTransition();
						onSettle?.();
					}
				}
			);
		});
}

export function viewTransition(options?: NavigationTransitionOptions): void;
export function viewTransition(
	update: ViewTransitionUpdate,
	options?: ViewTransitionOptions
): ViewTransition | undefined;
export function viewTransition(
	first?: NavigationTransitionOptions | ViewTransitionUpdate,
	second?: ViewTransitionOptions
): ViewTransition | undefined | void {
	if (typeof first === 'function') return directTransition(first, second);
	onNavigate(navigationTransition(first));
}
