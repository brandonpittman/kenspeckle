import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';

export type UtilityType = 'class' | 'value' | 'attachment' | 'function';

export type TagType = UtilityType;

export interface Utility {
	slug: string;
	href: ResolvedPathname;
	label: string;
	type: UtilityType;
	blurb: string;
}

export const tagLabels: Record<TagType, string> = {
	class: 'class',
	value: 'value',
	attachment: 'attachment',
	function: 'function'
};

export const groupLabels: Record<UtilityType, string> = {
	class: 'Classes',
	value: 'Values',
	attachment: 'Attachments',
	function: 'Functions'
};

export const utilityTypes: UtilityType[] = ['class', 'value', 'attachment', 'function'];

export const utilities: Utility[] = [
	{
		slug: 'finite-state-machine',
		href: resolve('/docs/finite-state-machine'),
		label: 'FiniteStateMachine',
		type: 'class',
		blurb: 'fully typed FSM with reactive context'
	},
	{
		slug: 'persisted-state',
		href: resolve('/docs/persisted-state'),
		label: 'PersistedState',
		type: 'class',
		blurb: 'a value synced to localStorage or sessionStorage'
	},
	{
		slug: 'countdown',
		href: resolve('/docs/countdown'),
		label: 'Countdown',
		type: 'class',
		blurb: 'milliseconds left until a deadline'
	},
	{
		slug: 'idle',
		href: resolve('/docs/idle'),
		label: 'Idle',
		type: 'class',
		blurb: 'whether the user has gone idle, across tabs'
	},
	{
		slug: 'document-visible',
		href: resolve('/docs/document-visible'),
		label: 'documentVisible',
		type: 'value',
		blurb: 'page visibility, a document singleton'
	},
	{
		slug: 'copy',
		href: resolve('/docs/copy'),
		label: 'copy',
		type: 'attachment',
		blurb: 'clipboard attachment'
	},
	{
		slug: 'scroll-edges',
		href: resolve('/docs/scroll-edges'),
		label: 'scrollEdges',
		type: 'attachment',
		blurb: 'which scroll edges an element has reached'
	},
	{
		slug: 'view-transition',
		href: resolve('/docs/view-transition'),
		label: 'viewTransition',
		type: 'function',
		blurb: 'view transitions, with a SvelteKit navigation tier'
	},
	{
		slug: 'view-transition-name',
		href: resolve('/docs/view-transition-name'),
		label: 'viewTransitionName',
		type: 'attachment',
		blurb: 'name an element for the transition it takes part in'
	},
	{
		slug: 'debounce',
		href: resolve('/docs/debounce'),
		label: 'debounce',
		type: 'function',
		blurb: 'debounce any function, with a shared promise'
	},
	{
		slug: 'throttle',
		href: resolve('/docs/throttle'),
		label: 'throttle',
		type: 'function',
		blurb: 'throttle any function, leading and trailing'
	}
];

export function bySlug(slug: string): Utility | undefined {
	return utilities.find((u) => u.slug === slug);
}
