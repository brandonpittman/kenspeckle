import { describe, expect, it } from 'vitest';
import { Idle } from './idle.svelte.js';

describe('Idle', () => {
	it('should be undefined on the server', () => {
		const idle = new Idle(1000);

		expect(idle.current).toBeUndefined();
	});
});
