import { describe, expect, it } from 'vitest';
import { scrollEdges } from './scroll-edges.js';

describe('scrollEdges on the server', () => {
	it('should import and create an attachment without throwing', () => {
		expect(() => scrollEdges(() => {})).not.toThrow();
	});
});
