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
			{
				name: 'PersistedState',
				type: 'class',
				blurb: 'a value synced to localStorage or sessionStorage'
			},
			{ name: 'Countdown', type: 'class', blurb: 'milliseconds left until a deadline' },
			{
				name: 'scrollEdges',
				type: 'attachment',
				blurb: 'which scroll edges an element has reached'
			},
			{
				name: 'viewTransition',
				type: 'function',
				blurb: 'a view transition around an update; enableViewTransitions for navigation'
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
			{
				name: 'AsyncPersistedState',
				type: 'class',
				blurb: 'a value in IndexedDB, awaitable like a remote query'
			},
			{ name: 'CurrentPosition', type: 'class', blurb: 'reactive geolocation' },
			{ name: 'pressedKeys', type: 'value', blurb: 'currently held keys, read like a set' },
			{ name: 'shortcut', type: 'attachment', blurb: 'keyboard shortcuts on an element' },
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
