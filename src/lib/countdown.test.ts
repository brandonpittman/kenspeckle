import { describe, expect, it } from 'vitest';
import { Countdown } from './countdown.svelte.js';

describe('Countdown', () => {
	it('should be undefined on the server', () => {
		const countdown = new Countdown(() => Date.now() + 1000);

		expect(countdown.current).toBeUndefined();
	});
});
