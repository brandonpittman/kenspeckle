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
		slug: 'copy',
		href: resolve('/docs/copy'),
		label: 'copy',
		type: 'attachment',
		blurb: 'clipboard attachment + imperative helper'
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
	}
];

export function bySlug(slug: string): Utility | undefined {
	return utilities.find((u) => u.slug === slug);
}
