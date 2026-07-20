import type { Attachment } from 'svelte/attachments';
import { on } from 'svelte/events';

export type CopyText = string | ((node: HTMLElement) => string | Promise<string>);

export interface CopyOptions<K extends keyof HTMLElementEventMap = 'click'> {
	text?: CopyText;
	event?: K | K[];
	enabled?: boolean;
	onCopy?: (text: string) => void;
}

export async function copyText(text: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);
	} catch {
		const el = document.createElement('textarea');
		el.value = text;
		el.setAttribute('readonly', '');
		el.style.position = 'absolute';
		el.style.left = '-9999px';
		document.body.appendChild(el);
		el.select();
		document.execCommand('copy');
		document.body.removeChild(el);
	}
}

export function copy<K extends keyof HTMLElementEventMap = 'click'>(
	options?: CopyOptions<K>
): Attachment<HTMLElement>;
export function copy<K extends keyof HTMLElementEventMap = 'click'>(
	node: HTMLElement,
	options?: CopyOptions<K>
): () => void;
export function copy<K extends keyof HTMLElementEventMap = 'click'>(
	nodeOrOptions?: HTMLElement | CopyOptions<K>,
	maybeOptions?: CopyOptions<K>
): Attachment<HTMLElement> | (() => void) {
	if (typeof Element !== 'undefined' && nodeOrOptions instanceof Element) {
		return wire(nodeOrOptions, maybeOptions);
	}
	const options = nodeOrOptions as CopyOptions<K> | undefined;
	return (node) => wire(node, options);
}

function wire<K extends keyof HTMLElementEventMap>(
	node: HTMLElement,
	options: CopyOptions<K> = {}
): () => void {
	const { text, event, enabled = true, onCopy } = options;
	if (!enabled) return () => {};
	const events = (event === undefined ? ['click'] : Array.isArray(event) ? event : [event]) as K[];
	async function handler() {
		const resolved =
			typeof text === 'function' ? await text(node) : (text ?? node.textContent ?? '');
		await copyText(resolved);
		onCopy?.(resolved);
	}
	const offs = events.map((e) => on(node, e, handler));
	return () => {
		for (const off of offs) off();
	};
}
