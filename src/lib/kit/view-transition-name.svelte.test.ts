import { afterEach, describe, expect, it } from 'vitest';
import {
	beginPhase,
	endTransition,
	viewTransitionName,
	type ViewTransitionNameOptions
} from './view-transition-name.js';
import type { Navigation } from './types.js';

const nav = (to = 'https://x.test/b'): Navigation => ({
	complete: Promise.resolve(),
	from: { url: new URL('https://x.test/a') },
	to: { url: new URL(to) }
});

const cleanups: Array<() => void> = [];

function el(): HTMLElement {
	const node = document.createElement('div');
	document.body.appendChild(node);
	return node;
}

const named = (node: HTMLElement) => node.style.viewTransitionName;

/** The two published shapes reduced to one signature, so the table below runs against both. */
const forms = [
	{
		label: 'attachment',
		wire: (node: HTMLElement, name: string, options?: ViewTransitionNameOptions) =>
			viewTransitionName(name, options)(node) as () => void
	},
	{
		label: 'imperative',
		wire: (node: HTMLElement, name: string, options?: ViewTransitionNameOptions) =>
			viewTransitionName(node, name, options)
	}
];

/** Claims outlive their elements — the registry is module scope, so every test unregisters. */
function attach(
	node: HTMLElement,
	wire: (typeof forms)[number]['wire'],
	name: string,
	options?: ViewTransitionNameOptions
) {
	const cleanup = wire(node, name, options);
	cleanups.push(cleanup);
	return cleanup;
}

afterEach(() => {
	endTransition();
	while (cleanups.length) cleanups.pop()!();
	document.body.replaceChildren();
});

for (const { label, wire } of forms) {
	describe(`viewTransitionName — ${label} form`, () => {
		it('leaves the element unnamed while idle', () => {
			const node = el();
			attach(node, wire, 'hero');
			expect(named(node)).toBe('');
		});

		it('names the element for the duration of a transition', () => {
			const node = el();
			attach(node, wire, 'hero');
			beginPhase(nav(), 'capture');
			expect(named(node)).toBe('hero');
		});

		it('clears the name when the transition ends', () => {
			const node = el();
			attach(node, wire, 'hero');
			beginPhase(nav(), 'capture');
			endTransition();
			expect(named(node)).toBe('');
		});

		it('never names the element when `when` returns false', () => {
			const node = el();
			attach(node, wire, 'hero', { when: () => false });
			beginPhase(nav(), 'capture');
			expect(named(node)).toBe('');
		});

		it('gates on the navigation `when` receives', () => {
			const node = el();
			attach(node, wire, 'hero', { when: (n: Navigation) => n.to?.url.pathname === '/wanted' });
			beginPhase(nav('https://x.test/wanted'), 'capture');
			expect(named(node)).toBe('hero');
		});

		it('claims at arrival, not capture, when onArrival is set', () => {
			const node = el();
			attach(node, wire, 'hero', { onArrival: true });
			beginPhase(nav(), 'capture');
			expect(named(node)).toBe('');
			beginPhase(nav(), 'arrival');
			expect(named(node)).toBe('hero');
		});

		it('stops naming after cleanup', () => {
			const node = el();
			attach(node, wire, 'hero')();
			beginPhase(nav(), 'capture');
			expect(named(node)).toBe('');
		});
	});
}

describe('viewTransitionName — mounting mid-transition', () => {
	it('claims immediately when an onArrival element registers after the arrival sweep', () => {
		beginPhase(nav(), 'arrival');
		const node = el();
		cleanups.push(viewTransitionName(node, 'hero', { onArrival: true }));
		expect(named(node)).toBe('hero');
	});

	it('does not claim a capture-phase element that registers during arrival', () => {
		beginPhase(nav(), 'arrival');
		const node = el();
		cleanups.push(viewTransitionName(node, 'hero'));
		expect(named(node)).toBe('');
	});

	it('clears a mid-transition claim when the transition ends', () => {
		beginPhase(nav(), 'arrival');
		const node = el();
		cleanups.push(viewTransitionName(node, 'hero', { onArrival: true }));
		endTransition();
		expect(named(node)).toBe('');
	});
});
