import { untrack } from 'svelte';
import { on } from 'svelte/events';

export interface ScrollEdges {
	blockStart: boolean;
	blockEnd: boolean;
	inlineStart: boolean;
	inlineEnd: boolean;
}

export interface ScrollEdgesOptions {
	offset?: number;
}

export function scrollEdges(
	callback: (edges: ScrollEdges) => void,
	options: ScrollEdgesOptions = {}
): (node: HTMLElement) => () => void {
	return (node) => {
		/** The extra pixel absorbs the sub-pixel gap a fractional box height leaves at maximum scrollTop. */
		const reach = (options.offset ?? 0) + 1;
		let last: ScrollEdges | undefined;

		function compute() {
			/** A hidden or detached scroller measures 0 by 0, which would read as every edge reached; its own ResizeObserver recomputes once it renders. */
			if (node.clientWidth === 0 && node.clientHeight === 0) return;
			const style = getComputedStyle(node);
			const flex = style.display.includes('flex');
			const column = style.flexDirection.startsWith('column');
			const wrapReverse = style.flexWrap === 'wrap-reverse';
			/** A reversed flex axis moves the scroll origin to that axis's end edge. */
			const blockFromEnd =
				flex && (column ? style.flexDirection === 'column-reverse' : wrapReverse);
			const inlineFromEnd = flex && (column ? wrapReverse : style.flexDirection === 'row-reverse');
			/** scrollTop and scrollLeft run negative from 0 when the origin sits on the bottom or right edge. */
			const inlineOriginRight = (style.direction === 'rtl') !== inlineFromEnd;
			const blockMax = node.scrollHeight - node.clientHeight;
			const inlineMax = node.scrollWidth - node.clientWidth;
			/** Elastic overscroll pushes the position past either end, which must not count as distance. */
			const blockScrolled = clamp(blockFromEnd ? -node.scrollTop : node.scrollTop, blockMax);
			const inlineScrolled = clamp(
				inlineOriginRight ? -node.scrollLeft : node.scrollLeft,
				inlineMax
			);
			const fromBlockStart = blockFromEnd ? blockMax - blockScrolled : blockScrolled;
			const fromInlineStart = inlineFromEnd ? inlineMax - inlineScrolled : inlineScrolled;
			const edges: ScrollEdges = {
				blockStart: fromBlockStart < reach,
				blockEnd: blockMax - fromBlockStart < reach,
				inlineStart: fromInlineStart < reach,
				inlineEnd: inlineMax - fromInlineStart < reach
			};
			if (
				last?.blockStart === edges.blockStart &&
				last.blockEnd === edges.blockEnd &&
				last.inlineStart === edges.inlineStart &&
				last.inlineEnd === edges.inlineEnd
			) {
				return;
			}
			last = edges;
			callback(edges);
		}

		const resize = new ResizeObserver(compute);
		resize.observe(node);
		for (const child of node.children) resize.observe(child);

		const mutation = new MutationObserver((records) => {
			for (const record of records) {
				if (record.target !== node) continue;
				/** replaceChildren can list a kept child as both removed and added, so it must be observed last. */
				for (const removed of record.removedNodes) {
					if (removed instanceof Element) resize.unobserve(removed);
				}
				for (const added of record.addedNodes) {
					if (added instanceof Element) resize.observe(added);
				}
			}
			compute();
		});
		/** Rewritten text, a margin, a position or a grandchild overflowing a fixed-size child changes the scroll extent without resizing any observed box. */
		mutation.observe(node, {
			childList: true,
			characterData: true,
			attributes: true,
			subtree: true
		});

		const page = node === node.ownerDocument.scrollingElement;
		/** The browser fires a viewport scroll at the document, never at the root element that scrolls. */
		const off = on(page ? node.ownerDocument : node, 'scroll', compute);
		const view = node.ownerDocument.defaultView;
		/** The root element's box follows its content, not the viewport, so a window that grows or shrinks without moving the scroll position resizes nothing observed. */
		const offResize = page && view ? on(view, 'resize', compute) : undefined;
		/** The first compute runs inside the attachment's effect, so state the callback reads would otherwise re-create the attachment on every write. */
		untrack(compute);

		return () => {
			off();
			offResize?.();
			resize.disconnect();
			mutation.disconnect();
		};
	};
}

function clamp(value: number, max: number): number {
	return Math.min(Math.max(value, 0), max);
}
