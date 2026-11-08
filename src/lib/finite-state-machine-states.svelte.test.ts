import { describe, expect, it } from 'vitest';
import { FiniteStateMachine } from './finite-state-machine.svelte.js';

describe('FiniteStateMachine private states', () => {
	function create() {
		return new FiniteStateMachine<'on' | 'off', { toggle: [] }>('off', {
			off: { toggle: 'on' },
			on: { toggle: 'off' }
		});
	}

	it('should move from off to on when toggle is sent, asserted through current', () => {
		const f = create();

		f.send('toggle');

		expect(f.current).toBe('on');
	});

	it('should not expose states on the instance', () => {
		expect(create()).not.toHaveProperty('states');
	});
});
