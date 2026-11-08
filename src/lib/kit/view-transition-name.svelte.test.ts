import { afterEach, describe, expect, it } from 'vitest';
import {
	beginPhase,
	endTransition,
	viewTransitionName,
	type ViewTransitionNameOptions
} from './view-transition-name.js';
import type { NavigationTarget, OnNavigate } from '@sveltejs/kit';

type RouteId = NonNullable<NavigationTarget['route']['id']>;

const target = (id: RouteId): NavigationTarget => ({
	params: {},
	route: { id },
	url: new URL(id, 'https://x.test'),
	scroll: null
});

const nav = (to: RouteId = '/demo/transition/b'): OnNavigate => ({
	type: 'link',
	event: new PointerEvent('click'),
	willUnload: false,
	complete: Promise.resolve(),
	from: target('/demo/transition/a'),
	to: target(to)
});

const cleanups: Array<() => void> = [];

function el(): HTMLElement {
	const node = document.createElement('div');
	document.body.appendChild(node);
	return node;
}

const named = (node: HTMLElement) => node.style.viewTransitionName;

/** Claims outlive their elements — the registry is module scope, so every test unregisters. */
function attach(node: HTMLElement, name: string, options?: ViewTransitionNameOptions) {
	const cleanup = viewTransitionName(name, options)(node);
	cleanups.push(cleanup);
	return cleanup;
}

afterEach(() => {
	endTransition();
	while (cleanups.length) cleanups.pop()!();
	document.body.replaceChildren();
});

describe('viewTransitionName', () => {
	it('leaves the element unnamed while idle', () => {
		const node = el();
		attach(node, 'hero');
		expect(named(node)).toBe('');
	});

	it('names the element for the duration of a transition', () => {
		const node = el();
		attach(node, 'hero');
		beginPhase(nav(), 'capture');
		expect(named(node)).toBe('hero');
	});

	it('clears the name when the transition ends', () => {
		const node = el();
		attach(node, 'hero');
		beginPhase(nav(), 'capture');
		endTransition();
		expect(named(node)).toBe('');
	});

	it('never names the element when `when` returns false', () => {
		const node = el();
		attach(node, 'hero', { when: () => false });
		beginPhase(nav(), 'capture');
		expect(named(node)).toBe('');
	});

	it('gates on the navigation `when` receives', () => {
		const node = el();
		attach(node, 'hero', { when: (n) => n.to?.url.pathname === '/demo/transition/b' });
		beginPhase(nav('/demo/transition/b'), 'capture');
		expect(named(node)).toBe('hero');
	});

	it('should claim the name when `when` matches the destination route id', () => {
		const node = el();
		attach(node, 'hero', {
			when: (n) => n.to?.route.id === '/demo/transition/b'
		});
		beginPhase(nav('/demo/transition/a'), 'capture');
		expect(named(node)).toBe('');
		endTransition();
		beginPhase(nav('/demo/transition/b'), 'capture');
		expect(named(node)).toBe('hero');
	});

	it('claims at arrival, not capture, when onArrival is set', () => {
		const node = el();
		attach(node, 'hero', { onArrival: true });
		beginPhase(nav(), 'capture');
		expect(named(node)).toBe('');
		beginPhase(nav(), 'arrival');
		expect(named(node)).toBe('hero');
	});

	it('stops naming after cleanup', () => {
		const node = el();
		attach(node, 'hero')();
		beginPhase(nav(), 'capture');
		expect(named(node)).toBe('');
	});
});

describe('viewTransitionName — mounting mid-transition', () => {
	it('claims immediately when an onArrival element registers after the arrival sweep', () => {
		beginPhase(nav(), 'arrival');
		const node = el();
		cleanups.push(viewTransitionName('hero', { onArrival: true })(node));
		expect(named(node)).toBe('hero');
	});

	it('does not claim a capture-phase element that registers during arrival', () => {
		beginPhase(nav(), 'arrival');
		const node = el();
		cleanups.push(viewTransitionName('hero')(node));
		expect(named(node)).toBe('');
	});

	it('clears a mid-transition claim when the transition ends', () => {
		beginPhase(nav(), 'arrival');
		const node = el();
		cleanups.push(viewTransitionName('hero', { onArrival: true })(node));
		endTransition();
		expect(named(node)).toBe('');
	});
});
