import { afterEach, describe, expect, it } from 'vitest';
import { isRetreat, retreat } from './view-transition.js';
import type { Navigation } from './types.js';

const nav = (overrides: Partial<Navigation> = {}): Navigation => ({
	complete: Promise.resolve(),
	from: { url: new URL('https://x.test/a') },
	to: { url: new URL('https://x.test/b') },
	...overrides
});

afterEach(() => {
	retreat(() => false);
});

describe('retreat', () => {
	it('defaults to forward', () => {
		expect(isRetreat(nav())).toBe(false);
	});

	it('consults the registered predicate', () => {
		retreat((n) => n.to?.url.pathname === '/b');
		expect(isRetreat(nav())).toBe(true);
	});

	it('treats a popstate as a retreat whatever the predicate says', () => {
		retreat(() => false);
		expect(isRetreat(nav({ type: 'popstate' }))).toBe(true);
	});

	it('replaces the predicate rather than stacking them', () => {
		retreat(() => true);
		retreat(() => false);
		expect(isRetreat(nav())).toBe(false);
	});
});
