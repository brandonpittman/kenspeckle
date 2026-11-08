import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { documentVisible } from './document-visible.js';

function setVisibility(state: DocumentVisibilityState) {
	Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
	document.dispatchEvent(new Event('visibilitychange'));
}

function visibilityHandlers(spy: { mock: { calls: unknown[][] } }) {
	return spy.mock.calls
		.filter(([type]) => type === 'visibilitychange')
		.map(([, handler]) => handler);
}

beforeEach(() => {
	setVisibility('visible');
});

afterEach(() => {
	Reflect.deleteProperty(document, 'visibilityState');
	vi.restoreAllMocks();
});

describe('documentVisible', () => {
	it('should return the live visibility when read outside any effect', () => {
		setVisibility('hidden');
		expect(documentVisible.current).toBe(false);

		setVisibility('visible');
		expect(documentVisible.current).toBe(true);
	});

	it('should update a $derived inside $effect.root when visibility changes', () => {
		const seen: (boolean | undefined)[] = [];
		const cleanup = $effect.root(() => {
			const visible = $derived(documentVisible.current);
			$effect(() => {
				seen.push(visible);
			});
		});
		flushSync();

		setVisibility('hidden');
		flushSync();
		cleanup();

		expect(seen).toEqual([true, false]);
	});

	it('should remove its visibilitychange listener after the effect root is cleaned up', async () => {
		const add = vi.spyOn(document, 'addEventListener');
		const remove = vi.spyOn(document, 'removeEventListener');
		const cleanup = $effect.root(() => {
			$effect(() => {
				void documentVisible.current;
			});
		});
		flushSync();
		expect(visibilityHandlers(remove)).toEqual([]);

		cleanup();

		await vi.waitFor(() => {
			expect(visibilityHandlers(remove)).toEqual(visibilityHandlers(add));
			expect(visibilityHandlers(remove)).toHaveLength(1);
		});
	});
});
