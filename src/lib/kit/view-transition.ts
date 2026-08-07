import type { Navigation } from './types.js';

let predicate: (navigation: Navigation) => boolean = () => false;

/**
 * A predicate, never a flag: Kit skips `beforeNavigate` for a navigation begun while another is in
 * flight, so a flag set at click time can be stranded and reverse a later navigation.
 */
export function retreat(next: (navigation: Navigation) => boolean) {
	predicate = next;
}

/** @internal */
export function isRetreat(navigation: Navigation): boolean {
	return navigation.type === 'popstate' || predicate(navigation);
}
