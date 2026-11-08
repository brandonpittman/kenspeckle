import type { TagType } from './utilities.js';

export type RoadmapStatus = 'shipped' | 'planned' | 'exploring';

export interface RoadmapItem {
	name: string;
	type: TagType;
	blurb: string;
}

export interface RoadmapGroup {
	status: RoadmapStatus;
	title: string;
	note: string;
	items: RoadmapItem[];
}

export const roadmap: RoadmapGroup[] = [
	{
		status: 'shipped',
		title: 'Shipped',
		note: 'Available now.',
		items: [
			{ name: 'FiniteStateMachine', type: 'class', blurb: 'typed FSM with reactive context' },
			{ name: 'documentVisible', type: 'value', blurb: 'page visibility, a document singleton' },
			{ name: 'copy', type: 'attachment', blurb: 'clipboard attachment + imperative helper' },
			{
				name: 'viewTransition',
				type: 'function',
				blurb: 'view transitions, with a SvelteKit navigation tier'
			},
			{
				name: 'viewTransitionName',
				type: 'attachment',
				blurb: 'name an element for the transition it takes part in'
			},
			{ name: 'retreat', type: 'function', blurb: 'which navigations animate in reverse' },
			{ name: 'debounce', type: 'function', blurb: 'debounce any function, with a shared promise' },
			{ name: 'throttle', type: 'function', blurb: 'throttle any function, leading and trailing' }
		]
	},
	{
		status: 'planned',
		title: 'Planned',
		note: "Shaped like Svelte's own APIs: singletons for global browser state, classes with current for configured or following values, attachments for element behavior.",
		items: [
			{ name: 'StateHistory', type: 'class', blurb: 'undo/redo over a getter and setter' },
			{ name: 'Idle', type: 'class', blurb: 'has the user gone idle, after a set time' },
			{ name: 'PersistedState', type: 'class', blurb: 'a value synced to storage' },
			{ name: 'CurrentPosition', type: 'class', blurb: 'reactive geolocation' },
			{ name: 'Previous', type: 'class', blurb: 'the previous value of a getter, via Previous.of' },
			{ name: 'pressedKeys', type: 'value', blurb: 'currently held keys, read like a set' },
			{ name: 'clickOutside', type: 'attachment', blurb: 'fire when a pointer lands outside' },
			{
				name: 'scrollEdges',
				type: 'attachment',
				blurb: 'which scroll edges an element has reached'
			},
			{ name: 'shortcut', type: 'attachment', blurb: 'keyboard shortcuts on an element' },
			{ name: 'lockScroll', type: 'attachment', blurb: 'lock scroll, stacked releases' },
			{ name: 'dragScroll', type: 'attachment', blurb: 'drag to scroll' }
		]
	},
	{
		status: 'exploring',
		title: 'Exploring',
		note: 'On the backlog — ported on demand, or waiting on a clearer fit.',
		items: [
			{ name: 'movable', type: 'attachment', blurb: 'drag to reposition an element' },
			{ name: 'swipeable', type: 'attachment', blurb: 'swipe gestures' },
			{ name: 'inlineSvg', type: 'attachment', blurb: 'inline an external SVG' },
			{ name: 'toc', type: 'attachment', blurb: 'table-of-contents extraction' },
			{ name: 'qr', type: 'function', blurb: 'QR code generation' },
			{
				name: 'searchParams',
				type: 'value',
				blurb: "typed search params — Kit's page.url and goto cover it for now"
			},
			{
				name: 'resource',
				type: 'value',
				blurb: 'server data — likely covered by Kit remote functions'
			}
		]
	}
];
