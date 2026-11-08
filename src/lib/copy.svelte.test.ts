import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copy, copyText } from './copy.js';

let writeText: ReturnType<typeof vi.fn>;
let original: PropertyDescriptor | undefined;

beforeEach(() => {
	writeText = vi.fn(() => Promise.resolve());
	original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
	Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => {
	if (original) Object.defineProperty(navigator, 'clipboard', original);
});

function button(text = 'source text'): HTMLButtonElement {
	const el = document.createElement('button');
	el.textContent = text;
	document.body.appendChild(el);
	return el;
}

describe('copyText', () => {
	it('writes to the clipboard', async () => {
		await copyText('hello');
		expect(writeText).toHaveBeenCalledWith('hello');
	});

	it('falls back to execCommand when writeText throws', async () => {
		writeText.mockRejectedValueOnce(new Error('denied'));
		const exec = vi.spyOn(document, 'execCommand').mockReturnValue(true);
		await copyText('fallback');
		expect(exec).toHaveBeenCalledWith('copy');
		exec.mockRestore();
	});
});

describe('copy', () => {
	it('returns an attachment that copies fixed text on click and returns a working cleanup', async () => {
		const el = button();
		const onCopy = vi.fn();
		const cleanup = copy({ text: 'copied!', onCopy })(el);
		el.click();
		await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('copied!'));
		expect(onCopy).toHaveBeenCalledWith('copied!');
		cleanup();
		writeText.mockClear();
		el.click();
		await new Promise((r) => setTimeout(r));
		expect(writeText).not.toHaveBeenCalled();
	});
});

describe('copy — text resolution', () => {
	it('resolves a text function with the node', async () => {
		const el = button('node text');
		copy({ text: (node) => node.textContent!.toUpperCase() })(el);
		el.click();
		await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('NODE TEXT'));
	});

	it("defaults to the node's textContent", async () => {
		const el = button('default source');
		copy({})(el);
		el.click();
		await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('default source'));
	});
});

describe('copy — options', () => {
	it('listens on a custom event', async () => {
		const el = button();
		copy({ text: 'x', event: 'dblclick' })(el);
		el.click();
		await new Promise((r) => setTimeout(r));
		expect(writeText).not.toHaveBeenCalled();
		el.dispatchEvent(new MouseEvent('dblclick'));
		await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('x'));
	});

	it('does nothing when disabled', async () => {
		const el = button();
		copy({ text: 'x', enabled: false })(el);
		el.click();
		await new Promise((r) => setTimeout(r));
		expect(writeText).not.toHaveBeenCalled();
	});
});
