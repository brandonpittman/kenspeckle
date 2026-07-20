import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';

export type UtilityType = 'class' | 'value' | 'attachment';

// superset of UtilityType — the roadmap also tags wiring/wrapper functions
export type TagType = UtilityType | 'function';

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

export const utilityTypes: UtilityType[] = ['class', 'value', 'attachment'];

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
	}
];

export function bySlug(slug: string): Utility | undefined {
	return utilities.find((u) => u.slug === slug);
}
