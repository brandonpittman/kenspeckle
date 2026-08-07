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
			{ name: 'samePath', type: 'function', blurb: 'trailing-slash-tolerant path comparison' }
		]
	},
	{
		status: 'planned',
		title: 'Planned',
		note: 'The curated v0 set — runed utilities reshaped under one convention, plus svelte-put actions reborn as attachments.',
		items: [
			{ name: 'StateHistory', type: 'class', blurb: 'undo/redo stack over reactive state' },
			{ name: 'mounted', type: 'value', blurb: 'has the component mounted yet' },
			{ name: 'idle', type: 'value', blurb: 'has the user gone idle' },
			{ name: 'documentVisible', type: 'value', blurb: 'page visibility state' },
			{ name: 'previous', type: 'value', blurb: 'the previous value of a source' },
			{ name: 'activeElement', type: 'value', blurb: "the document's focused element" },
			{ name: 'pressedKeys', type: 'value', blurb: 'currently held keys' },
			{ name: 'persisted', type: 'value', blurb: 'state synced to storage' },
			{ name: 'animationFrames', type: 'value', blurb: 'a per-frame callback loop' },
			{ name: 'debounced', type: 'value', blurb: 'a debounced view of a value' },
			{ name: 'throttled', type: 'value', blurb: 'a throttled view of a value' },
			{ name: 'geolocation', type: 'value', blurb: 'reactive geolocation' },
			{ name: 'searchParams', type: 'value', blurb: 'typed, reactive URL search params' },
			{ name: 'clickOutside', type: 'attachment', blurb: 'fire when a pointer lands outside' },
			{ name: 'inViewport', type: 'attachment', blurb: 'is the element on screen' },
			{ name: 'elementSize', type: 'attachment', blurb: 'reactive element size' },
			{ name: 'elementRect', type: 'attachment', blurb: 'reactive bounding rect' },
			{ name: 'scrollState', type: 'attachment', blurb: 'scroll position and direction' },
			{ name: 'focusWithin', type: 'attachment', blurb: 'does focus live inside' },
			{ name: 'autosize', type: 'attachment', blurb: 'grow a textarea to its content' },
			{ name: 'intersected', type: 'attachment', blurb: 'IntersectionObserver, curried' },
			{ name: 'resized', type: 'attachment', blurb: 'ResizeObserver, curried' },
			{ name: 'mutated', type: 'attachment', blurb: 'MutationObserver, curried' },
			{ name: 'shortcut', type: 'attachment', blurb: 'keyboard shortcuts on an element or window' },
			{ name: 'lockScroll', type: 'attachment', blurb: 'lock scroll, stacked releases' },
			{ name: 'dragScroll', type: 'attachment', blurb: 'drag to scroll' },
			{ name: 'debounce', type: 'function', blurb: 'debounce any function' },
			{ name: 'throttle', type: 'function', blurb: 'throttle any function' },
			{ name: 'listen', type: 'function', blurb: 'typed addEventListener with cleanup' },
			{ name: 'interval', type: 'function', blurb: 'setInterval tied to the lifecycle' },
			{ name: 'watch', type: 'function', blurb: 'run an effect when sources change' },
			{ name: 'extract', type: 'function', blurb: 'read a maybe-reactive value' },
			{ name: 'onCleanup', type: 'function', blurb: 'register teardown' },
			{ name: 'boolAttr', type: 'function', blurb: 'boolean attribute helper' }
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
				name: 'resource',
				type: 'value',
				blurb: 'server data — likely covered by Kit remote functions'
			}
		]
	}
];
