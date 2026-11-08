import { describe, expect, it } from 'vitest';
import * as kenspeckle from './index.js';

describe('documentVisible removal', () => {
	it('should not export documentVisible from kenspeckle', () => {
		expect(kenspeckle).not.toHaveProperty('documentVisible');
	});
});
