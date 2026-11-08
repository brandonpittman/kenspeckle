import { flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrollEdges, type ScrollEdges } from './scroll-edges.js';

const cleanups: (() => void)[] = [];

afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	document.body.replaceChildren();
});

function box(content = { height: 300, width: 300 }): HTMLDivElement {
	const el = document.createElement('div');
	el.style.cssText = 'height: 100px; width: 100px; overflow: auto';
	const child = document.createElement('div');
	child.style.cssText = `height: ${content.height}px; width: ${content.width}px`;
	el.appendChild(child);
	document.body.appendChild(el);
	return el;
}

function attach(el: HTMLElement, options?: { offset?: number }) {
	const callback = vi.fn<(edges: ScrollEdges) => void>();
	const cleanup = scrollEdges(callback, options)(el);
	cleanups.push(cleanup);
	return { callback, cleanup };
}

/** Resolves after the element's own scroll listeners have run, so a missing call is a real absence. */
function scrollTo(el: HTMLElement, position: { top?: number; left?: number }): Promise<void> {
	const scrolled = new Promise<void>((resolve) =>
		el.addEventListener('scroll', () => resolve(), { once: true })
	);
	if (position.top !== undefined) el.scrollTop = position.top;
	if (position.left !== undefined) el.scrollLeft = position.left;
	return scrolled;
}

/** A ResizeObserver's first notification arrives a frame after `observe()`; letting it pass keeps it from standing in for the change under test. */
function settle(): Promise<void> {
	return new Promise((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
	);
}

const topLeft: ScrollEdges = {
	blockStart: true,
	blockEnd: false,
	inlineStart: true,
	inlineEnd: false
};

describe('scrollEdges', () => {
	describe('Initial report', () => {
		it('should report blockStart and inlineStart reached at the top-left corner on attach', async () => {
			const { callback } = attach(box());

			await vi.waitFor(() => expect(callback).toHaveBeenCalledWith(topLeft));
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should report all four edges reached when the element has no overflow', async () => {
			const { callback } = attach(box({ height: 50, width: 50 }));

			await vi.waitFor(() =>
				expect(callback).toHaveBeenCalledWith({
					blockStart: true,
					blockEnd: true,
					inlineStart: true,
					inlineEnd: true
				})
			);
		});
	});

	describe('Scrolling', () => {
		it('should report blockEnd when scrolled to the bottom', async () => {
			const el = box();
			const { callback } = attach(el);

			await scrollTo(el, { top: el.scrollHeight });

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith({ ...topLeft, blockStart: false, blockEnd: true })
			);
		});

		it('should not call the callback again when scrolling within the middle', async () => {
			const el = box();
			const { callback } = attach(el);
			await scrollTo(el, { top: 80 });
			await vi.waitFor(() => expect(callback).toHaveBeenCalledTimes(2));

			await scrollTo(el, { top: 120 });

			expect(callback).toHaveBeenCalledTimes(2);
		});

		it('should report blockEnd at maximum scrollTop with a fractional container height', async () => {
			const el = box();
			/** Zoom stands in for a high-DPR screen: it leaves a sub-pixel gap (about 0.8px) between maximum scrollTop and the bottom, which a 100.5px box at 1x does not. */
			el.style.height = '100.4px';
			el.style.zoom = '1.25';
			const { callback } = attach(el);

			await scrollTo(el, { top: el.scrollHeight });

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ blockEnd: true }))
			);
		});
	});

	describe('Content changes without a scroll', () => {
		it('should flip blockEnd to false when a child is appended while at the bottom', async () => {
			const el = box();
			const { callback } = attach(el);
			await scrollTo(el, { top: el.scrollHeight });
			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ blockEnd: true }))
			);

			await settle();

			const more = document.createElement('div');
			more.style.height = '100px';
			el.appendChild(more);

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ blockEnd: false }))
			);
		});

		it('should report again when a child is resized', async () => {
			const el = box();
			const { callback } = attach(el);
			await scrollTo(el, { top: el.scrollHeight });
			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ blockEnd: true }))
			);

			await settle();

			(el.firstElementChild as HTMLElement).style.height = '400px';

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ blockEnd: false }))
			);
		});
		it('should flip blockEnd to false when a child appended after attach grows', async () => {
			const el = box();
			const { callback } = attach(el);
			const more = document.createElement('div');
			more.style.height = '10px';
			el.appendChild(more);
			await settle();
			await scrollTo(el, { top: el.scrollHeight });
			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ blockEnd: true }))
			);

			await settle();

			more.style.height = '200px';

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ blockEnd: false }))
			);
		});

		it('should report blockEnd when a child is removed while away from the bottom', async () => {
			const el = box();
			const more = document.createElement('div');
			more.style.height = '300px';
			el.appendChild(more);
			const { callback } = attach(el);
			await scrollTo(el, { top: 200 });
			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(
					expect.objectContaining({ blockStart: false, blockEnd: false })
				)
			);

			await settle();

			more.remove();

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ blockEnd: true }))
			);
		});

		it('should flip blockEnd to false when a direct text node grows while at the bottom', async () => {
			const el = document.createElement('pre');
			el.style.cssText = 'height: 100px; width: 100px; overflow: auto; margin: 0';
			const text = document.createTextNode('line\n'.repeat(20));
			el.appendChild(text);
			document.body.appendChild(el);
			const { callback } = attach(el);
			await scrollTo(el, { top: el.scrollHeight });
			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ blockEnd: true }))
			);

			await settle();

			text.nodeValue += 'line\n'.repeat(20);

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ blockEnd: false }))
			);
		});

		it('should flip blockEnd to false when the text of an inline child grows while at the bottom', async () => {
			const el = document.createElement('pre');
			el.style.cssText = 'height: 100px; width: 100px; overflow: auto; margin: 0';
			const span = document.createElement('span');
			span.textContent = 'line\n'.repeat(20);
			el.appendChild(span);
			document.body.appendChild(el);
			const { callback } = attach(el);
			await scrollTo(el, { top: el.scrollHeight });
			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ blockEnd: true }))
			);

			await settle();

			(span.firstChild as Text).nodeValue += 'line\n'.repeat(20);

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ blockEnd: false }))
			);
		});
	});

	describe('Horizontal scrolling', () => {
		it('should report inlineEnd at maximum scrollLeft in a left-to-right element with non-square content', async () => {
			const el = box({ height: 600, width: 300 });
			const { callback } = attach(el);

			await scrollTo(el, { left: el.scrollWidth });

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith({
					...topLeft,
					inlineStart: false,
					inlineEnd: true
				})
			);
		});
	});

	describe('Reversed flex', () => {
		function reversed(direction: 'column-reverse' | 'row-reverse'): HTMLDivElement {
			const el = document.createElement('div');
			el.style.cssText = `display: flex; flex-direction: ${direction}; height: 100px; width: 100px; overflow: auto`;
			for (let i = 0; i < 6; i++) {
				const child = document.createElement('div');
				child.style.cssText = 'flex: none; height: 50px; width: 50px';
				el.appendChild(child);
			}
			document.body.appendChild(el);
			return el;
		}

		it('should report blockEnd on attach and blockStart at the top of a column-reverse scroller', async () => {
			const el = reversed('column-reverse');
			const { callback } = attach(el);
			await vi.waitFor(() =>
				expect(callback).toHaveBeenCalledWith({
					blockStart: false,
					blockEnd: true,
					inlineStart: true,
					inlineEnd: true
				})
			);

			await scrollTo(el, { top: -el.scrollHeight });

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith({
					blockStart: true,
					blockEnd: false,
					inlineStart: true,
					inlineEnd: true
				})
			);
		});

		it('should report inlineEnd on attach and inlineStart at the far left of a row-reverse scroller', async () => {
			const el = reversed('row-reverse');
			const { callback } = attach(el);
			await vi.waitFor(() =>
				expect(callback).toHaveBeenCalledWith({
					blockStart: true,
					blockEnd: true,
					inlineStart: false,
					inlineEnd: true
				})
			);

			await scrollTo(el, { left: -el.scrollWidth });

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith({
					blockStart: true,
					blockEnd: true,
					inlineStart: true,
					inlineEnd: false
				})
			);
		});
	});

	describe('RTL', () => {
		it('should report inlineStart reached on attach', async () => {
			const el = box();
			el.dir = 'rtl';
			const { callback } = attach(el);

			await vi.waitFor(() => expect(callback).toHaveBeenCalledWith(topLeft));
		});

		it('should report inlineEnd when scrolled to the minimum scrollLeft', async () => {
			const el = box();
			el.dir = 'rtl';
			const { callback } = attach(el);

			await scrollTo(el, { left: -el.scrollWidth });

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith({
					...topLeft,
					inlineStart: false,
					inlineEnd: true
				})
			);
		});
	});

	describe('offset', () => {
		it('should count blockEnd as reached 40px from the bottom with offset 50', async () => {
			const el = box();
			const { callback } = attach(el, { offset: 50 });

			await scrollTo(el, { top: el.scrollHeight - el.clientHeight - 40 });

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(
					expect.objectContaining({ blockStart: false, blockEnd: true })
				)
			);
		});

		it('should not count blockEnd as reached 60px from the bottom with offset 50', async () => {
			const el = box();
			const { callback } = attach(el, { offset: 50 });

			await scrollTo(el, { top: el.scrollHeight - el.clientHeight - 60 });

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(
					expect.objectContaining({ blockStart: false, blockEnd: false })
				)
			);
		});
	});

	describe('Wrap-reverse flex', () => {
		function wrapped(direction: 'row' | 'column'): HTMLDivElement {
			const el = document.createElement('div');
			el.style.cssText = `display: flex; flex-direction: ${direction}; flex-wrap: wrap-reverse; height: 100px; width: 100px; overflow: auto`;
			for (let i = 0; i < 6; i++) {
				const child = document.createElement('div');
				child.style.cssText = 'flex: none; height: 50px; width: 50px';
				el.appendChild(child);
			}
			document.body.appendChild(el);
			return el;
		}

		it('should report blockEnd on attach and blockStart at the top of a row wrap-reverse scroller', async () => {
			const el = wrapped('row');
			const { callback } = attach(el);
			await vi.waitFor(() =>
				expect(callback).toHaveBeenCalledWith({
					blockStart: false,
					blockEnd: true,
					inlineStart: true,
					inlineEnd: true
				})
			);

			await scrollTo(el, { top: -el.scrollHeight });

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith({
					blockStart: true,
					blockEnd: false,
					inlineStart: true,
					inlineEnd: true
				})
			);
		});

		it('should report inlineEnd on attach and inlineStart at the far left of a column wrap-reverse scroller', async () => {
			const el = wrapped('column');
			const { callback } = attach(el);
			await vi.waitFor(() =>
				expect(callback).toHaveBeenCalledWith({
					blockStart: true,
					blockEnd: true,
					inlineStart: false,
					inlineEnd: true
				})
			);

			await scrollTo(el, { left: -el.scrollWidth });

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith({
					blockStart: true,
					blockEnd: true,
					inlineStart: true,
					inlineEnd: false
				})
			);
		});
	});

	describe('Elastic overscroll', () => {
		/** Chromium never overscrolls an element, so the position a rubber-banding browser reports is stubbed onto the instance. */
		function overscroll(el: HTMLElement, property: 'scrollTop' | 'scrollLeft', value: number) {
			Object.defineProperty(el, property, { configurable: true, get: () => value });
			el.dispatchEvent(new Event('scroll'));
		}

		it('should report blockStart reached when overscrolled above the top', async () => {
			const el = box();
			const { callback } = attach(el);
			await scrollTo(el, { top: 100 });
			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ blockStart: false }))
			);

			overscroll(el, 'scrollTop', -30);

			expect(callback).toHaveBeenLastCalledWith(topLeft);
		});

		it('should report inlineStart reached when an RTL element is overscrolled past its right edge', async () => {
			const el = box();
			el.dir = 'rtl';
			const { callback } = attach(el);
			await scrollTo(el, { left: -100 });
			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ inlineStart: false }))
			);

			overscroll(el, 'scrollLeft', 30);

			expect(callback).toHaveBeenLastCalledWith(topLeft);
		});
	});

	describe('Changes no scroll or child resize shows', () => {
		it('should keep watching a child that replaceChildren keeps', async () => {
			document.body.style.setProperty('--kept-height', '300px');
			cleanups.push(() => document.body.style.removeProperty('--kept-height'));
			const el = box();
			(el.firstElementChild as HTMLElement).style.height = 'var(--kept-height)';
			el.appendChild(document.createElement('div'));
			const { callback } = attach(el);
			await settle();

			el.replaceChildren(el.firstElementChild as HTMLElement);
			await scrollTo(el, { top: el.scrollHeight });
			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ blockEnd: true }))
			);
			await settle();
			document.body.style.setProperty('--kept-height', '400px');

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ blockEnd: false }))
			);
		});

		it('should report blockEnd false when a margin grows the last child at the bottom', async () => {
			const el = box();
			const { callback } = attach(el);
			await scrollTo(el, { top: el.scrollHeight });
			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ blockEnd: true }))
			);
			await settle();

			(el.lastElementChild as HTMLElement).style.marginBottom = '200px';

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ blockEnd: false }))
			);
		});
	});

	describe('Page scroller', () => {
		it('should report blockEnd when the viewport scrolls to the bottom', async () => {
			const tall = document.createElement('div');
			tall.style.height = '5000px';
			document.body.appendChild(tall);
			const callback = vi.fn<(edges: ScrollEdges) => void>();
			cleanups.push(scrollEdges(callback)(document.documentElement), () => window.scrollTo(0, 0));
			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(
					expect.objectContaining({ blockStart: true, blockEnd: false })
				)
			);
			await settle();

			window.scrollTo(0, document.documentElement.scrollHeight);

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(
					expect.objectContaining({ blockStart: false, blockEnd: true })
				)
			);
		});
	});

	describe('Overscroll with offset', () => {
		it('should keep blockEnd reached when overscrolling above a scroller shorter than the offset', async () => {
			const el = box({ height: 110, width: 300 });
			const { callback } = attach(el, { offset: 50 });
			await vi.waitFor(() =>
				expect(callback).toHaveBeenCalledWith(
					expect.objectContaining({ blockStart: true, blockEnd: true })
				)
			);

			Object.defineProperty(el, 'scrollTop', { configurable: true, get: () => -50 });
			el.dispatchEvent(new Event('scroll'));

			expect(callback).toHaveBeenLastCalledWith(
				expect.objectContaining({ blockStart: true, blockEnd: true })
			);
		});
	});

	describe('Hidden scroller', () => {
		it('should not report while hidden, then report once it renders', async () => {
			const el = box();
			el.style.display = 'none';
			const { callback } = attach(el);
			await settle();

			expect(callback).not.toHaveBeenCalled();

			el.style.display = '';

			await vi.waitFor(() => expect(callback).toHaveBeenCalledWith(topLeft));
		});

		it('should not report while detached from the document', async () => {
			const el = box();
			el.remove();
			const { callback } = attach(el);
			await settle();

			expect(callback).not.toHaveBeenCalled();
		});
	});

	describe('Cleanup', () => {
		it('should not call the callback when scrolling after cleanup', async () => {
			const el = box();
			const { callback, cleanup } = attach(el);
			await vi.waitFor(() => expect(callback).toHaveBeenCalledOnce());

			cleanup?.();
			await scrollTo(el, { top: el.scrollHeight });

			expect(callback).toHaveBeenCalledOnce();
		});

		it('should not call the callback when a child is appended or resized after cleanup', async () => {
			const el = box();
			const { callback, cleanup } = attach(el);
			await vi.waitFor(() => expect(callback).toHaveBeenCalledOnce());
			await settle();

			cleanup?.();
			(el.firstElementChild as HTMLElement).style.height = '50px';
			el.appendChild(document.createElement('div'));
			await settle();

			expect(callback).toHaveBeenCalledOnce();
		});
	});

	describe('Inside an effect', () => {
		it('should not re-attach when the callback reads and writes state', async () => {
			const el = box({ height: 50, width: 50 });
			let loading = $state(false);
			const loadMore = vi.fn(() => {
				if (loading) return;
				loading = true;
			});
			const cleanup = $effect.root(() => {
				$effect(() =>
					scrollEdges((edges) => {
						if (edges.blockEnd) loadMore();
					})(el)
				);
			});
			cleanups.push(cleanup);
			flushSync();

			loading = false;
			flushSync();
			await settle();

			expect(loadMore).toHaveBeenCalledOnce();
		});
	});

	describe('Resizes from outside the scroller', () => {
		function bodyProperty(name: string, value: string) {
			document.body.style.setProperty(name, value);
			cleanups.push(() => document.body.style.removeProperty(name));
		}

		it('should report again when a child present at attach is resized without a mutation inside the scroller', async () => {
			bodyProperty('--child-height', '300px');
			const el = box();
			(el.firstElementChild as HTMLElement).style.height = 'var(--child-height)';
			const { callback } = attach(el);
			await scrollTo(el, { top: el.scrollHeight });
			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ blockEnd: true }))
			);
			await settle();

			bodyProperty('--child-height', '400px');

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ blockEnd: false }))
			);
		});

		it('should report again when a child appended after attach is resized without a mutation inside the scroller', async () => {
			bodyProperty('--more-height', '10px');
			const el = box();
			const { callback } = attach(el);
			const more = document.createElement('div');
			more.style.height = 'var(--more-height)';
			el.appendChild(more);
			await settle();
			await scrollTo(el, { top: el.scrollHeight });
			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ blockEnd: true }))
			);
			await settle();

			bodyProperty('--more-height', '200px');

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ blockEnd: false }))
			);
		});

		it('should report blockEnd when the scroller grows to fit its content', async () => {
			bodyProperty('--scroller-height', '100px');
			const el = box();
			el.style.height = 'var(--scroller-height)';
			const { callback } = attach(el);
			await vi.waitFor(() => expect(callback).toHaveBeenCalledWith(topLeft));
			await settle();

			bodyProperty('--scroller-height', '400px');

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith({ ...topLeft, blockEnd: true })
			);
		});

		it('should report once an ancestor stops hiding a scroller with no element children', async () => {
			const wrapper = document.createElement('div');
			wrapper.style.display = 'none';
			const el = document.createElement('pre');
			el.style.cssText = 'height: 100px; width: 100px; overflow: auto; margin: 0';
			el.textContent = 'line\n'.repeat(20);
			wrapper.appendChild(el);
			document.body.appendChild(wrapper);
			const { callback } = attach(el);
			await settle();
			expect(callback).not.toHaveBeenCalled();

			wrapper.style.display = '';

			await vi.waitFor(() =>
				expect(callback).toHaveBeenCalledWith(
					expect.objectContaining({ blockStart: true, blockEnd: false })
				)
			);
		});

		it('should report blockEnd on the page scroller when the viewport grows to fit the page without a scroll', async () => {
			const tall = document.createElement('div');
			tall.style.height = '5000px';
			document.body.appendChild(tall);
			const root = document.documentElement;
			const callback = vi.fn<(edges: ScrollEdges) => void>();
			cleanups.push(scrollEdges(callback)(root));
			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith(
					expect.objectContaining({ blockStart: true, blockEnd: false })
				)
			);
			await settle();

			/** A test cannot resize the browser window, so the taller viewport is stubbed onto the root element. */
			Object.defineProperty(root, 'clientHeight', {
				configurable: true,
				get: () => root.scrollHeight
			});
			cleanups.push(() => delete (root as { clientHeight?: number }).clientHeight);
			window.dispatchEvent(new Event('resize'));

			expect(callback).toHaveBeenLastCalledWith(
				expect.objectContaining({ blockStart: true, blockEnd: true })
			);
		});
	});

	describe('RTL reversed flex', () => {
		it('should report inlineEnd on attach and inlineStart at the far right of an RTL row-reverse scroller', async () => {
			const el = document.createElement('div');
			el.dir = 'rtl';
			el.style.cssText =
				'display: flex; flex-direction: row-reverse; height: 100px; width: 100px; overflow: auto';
			for (let i = 0; i < 6; i++) {
				const child = document.createElement('div');
				child.style.cssText = 'flex: none; height: 50px; width: 50px';
				el.appendChild(child);
			}
			document.body.appendChild(el);
			const { callback } = attach(el);
			await vi.waitFor(() =>
				expect(callback).toHaveBeenCalledWith({
					blockStart: true,
					blockEnd: true,
					inlineStart: false,
					inlineEnd: true
				})
			);

			await scrollTo(el, { left: el.scrollWidth });

			await vi.waitFor(() =>
				expect(callback).toHaveBeenLastCalledWith({
					blockStart: true,
					blockEnd: true,
					inlineStart: true,
					inlineEnd: false
				})
			);
		});
	});
});
