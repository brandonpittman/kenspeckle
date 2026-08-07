import { describe, expect, it } from 'vitest';
import { samePath } from './same-path.js';

describe('samePath', () => {
	it('matches across a trailing-slash difference', () => {
		expect(samePath({ url: new URL('https://x.test/profile/gender') }, '/profile/gender/')).toBe(
			true
		);
	});

	it('matches when neither side has a trailing slash', () => {
		expect(samePath({ url: new URL('https://x.test/profile/gender') }, '/profile/gender')).toBe(
			true
		);
	});

	it('does not match different paths', () => {
		expect(samePath({ url: new URL('https://x.test/profile/income') }, '/profile/gender/')).toBe(
			false
		);
	});

	it('is false when the target is null', () => {
		expect(samePath({ url: new URL('https://x.test/profile/gender') }, null)).toBe(false);
	});

	it('is false when the navigation target is null', () => {
		expect(samePath(null, '/profile/gender/')).toBe(false);
	});
});
