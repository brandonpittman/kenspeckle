import { describe, expect, it } from 'vitest';
import { documentVisible } from './document-visible.js';

describe('documentVisible', () => {
	it('should be undefined on the server', () => {
		expect(documentVisible.current).toBeUndefined();
	});
});
