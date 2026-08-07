import type { Attachment } from 'svelte/attachments';
import type { Navigation } from './types.js';

export interface ViewTransitionNameOptions {
	/** Only claim the name for navigations this returns true for. */
	when?: (navigation: Navigation) => boolean;
	/** Claim inside the update callback instead, for an element that mounts during the transition. */
	onArrival?: boolean;
}

type Phase = 'capture' | 'arrival';

interface Claim {
	element: HTMLElement;
	name: string;
	options: ViewTransitionNameOptions;
	named: boolean;
}

const claims = new Set<Claim>();
let current: { navigation: Navigation; phase: Phase } | null = null;

function wanted(claim: Claim, phase: Phase, navigation: Navigation): boolean {
	if ((claim.options.onArrival ? 'arrival' : 'capture') !== phase) return false;
	return claim.options.when?.(navigation) ?? true;
}

function apply(claim: Claim) {
	claim.element.style.viewTransitionName = claim.name;
	claim.named = true;
}

function release(claim: Claim) {
	if (!claim.named) return;
	claim.element.style.viewTransitionName = '';
	claim.named = false;
}

/** @internal — driven by the navigation registration. */
export function beginPhase(navigation: Navigation, phase: Phase) {
	current = { navigation, phase };
	for (const claim of claims) if (wanted(claim, phase, navigation)) apply(claim);
}

/** @internal */
export function endTransition() {
	current = null;
	for (const claim of claims) release(claim);
}

function wire(
	element: HTMLElement,
	name: string,
	options: ViewTransitionNameOptions = {}
): () => void {
	const claim: Claim = { element, name, options, named: false };
	claims.add(claim);
	// An element mounting mid-transition registers after its phase already swept.
	if (current && wanted(claim, current.phase, current.navigation)) apply(claim);
	return () => {
		release(claim);
		claims.delete(claim);
	};
}

export function viewTransitionName(
	name: string,
	options?: ViewTransitionNameOptions
): Attachment<HTMLElement>;
export function viewTransitionName(
	element: HTMLElement,
	name: string,
	options?: ViewTransitionNameOptions
): () => void;
export function viewTransitionName(
	first: string | HTMLElement,
	second?: string | ViewTransitionNameOptions,
	third?: ViewTransitionNameOptions
): Attachment<HTMLElement> | (() => void) {
	if (typeof Element !== 'undefined' && first instanceof Element) {
		return wire(first as HTMLElement, second as string, third);
	}
	const options = second as ViewTransitionNameOptions | undefined;
	return (element) => wire(element, first as string, options);
}
