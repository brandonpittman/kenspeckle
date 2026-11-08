<script>
	import PageHeading from '../PageHeading.svelte';
</script>

<PageHeading slug="scroll-edges" />

Report which scroll edges an element has reached. `scrollEdges(callback)` returns an **attachment**. The edges go to your callback, so the value lives in your own state.

```ts
import { scrollEdges, type ScrollEdges } from 'kenspeckle';
```

## As an attachment

With `let atBottom = $state(false)` in your component script:

```svelte
<div class="feed" {@attach scrollEdges((edges) => (atBottom = edges.blockEnd))}>...</div>
```

The callback fires once on attach, then only when one of the four edges changes. Scrolling through the middle calls nothing. The attachment only runs in the browser, so it is SSR-safe by construction.

## Outside a template

An attachment is a function of the element, so call it on one. It returns a cleanup function:

```ts
const cleanup = scrollEdges((edges) => {
  shadowTop = !edges.blockStart;
  shadowBottom = !edges.blockEnd;
})(node);

// later
cleanup();
```

## The edges

```ts
interface ScrollEdges {
  blockStart: boolean;
  blockEnd: boolean;
  inlineStart: boolean;
  inlineEnd: boolean;
}
```

Block is the vertical axis, inline the horizontal one. An element with no overflow reports all four edges as reached.

The inline edges follow the element's `direction`, read from its computed style each time. In a right-to-left element, `inlineStart` is the right edge, where browsers put `scrollLeft` at 0, and `inlineEnd` is the left edge, where `scrollLeft` is at its most negative. A sidebar that fades its trailing edge works in both directions without a second code path.

A flex container with `flex-direction: column-reverse` or `row-reverse` (or `flex-wrap: wrap-reverse` on its cross axis) starts scrolled to that axis's end, and the edges follow it. A `column-reverse` chat log reports `blockEnd` on attach, where the reader sits, and `blockStart` once scrolled up to the oldest message.

The edges are recomputed on `scroll`, and also when the content changes size without a scroll: a child appended, removed or resized, text inside the element rewritten, or a `class` or `style` change anywhere inside it, such as a margin added to the last child. A change no attribute or node shows, like a `:hover` rule or a media query, isn't seen until the next scroll or resize. A chat log scrolled to the bottom reports `blockEnd: false` the moment a new message lands below, which no scroll event would tell you.

An edge counts as reached within 1px, so a fractional box height, common on high-DPR screens, still reaches `blockEnd` at the bottom.

## offset for infinite scroll

`offset` widens every edge by that many pixels, so the next page starts loading before the reader hits the bottom:

```svelte
<ul
  {@attach scrollEdges(
    (edges) => {
      if (edges.blockEnd) loadMore();
    },
    { offset: 200 }
  )}
>
  ...
</ul>
```

Because the callback fires only on a change, `loadMore` runs once per arrival, not on every scroll event inside the last 200px. Once the new items push the end away, `blockEnd` goes false, and the next arrival fires again.

That assumes each page pushes the end more than `offset` away. A page shorter than that, or a short list that doesn't overflow at all, leaves `blockEnd` true, so nothing changes, the callback stays quiet and loading stops. Size `offset` below the height of one page, or have `loadMore` keep fetching until the list is long enough to fill it.

## Position and direction

`scrollEdges` reports edges only. For the position itself, read it in `onscroll`:

```svelte
<div onscroll={(event) => (top = event.currentTarget.scrollTop)}>...</div>
```

Direction is a comparison with the last position, kept where the scroll is handled. With `let top = 0` and `let down = $state(false)` in your component script:

```ts
function onscroll(event: Event & { currentTarget: HTMLElement }) {
  const next = event.currentTarget.scrollTop;
  down = next > top;
  top = next;
}
```

For the window, `<svelte:window bind:scrollY />` covers both. For the page's own edges, call the attachment on `document.documentElement`, as in `scrollEdges(callback)(document.documentElement)`. It listens for the viewport's scroll on the document and for the window's `resize`, so a window that grows to fit the whole page reports `blockEnd` without a scroll.

## Vertical writing modes

Vertical writing modes are not supported. In `writing-mode: vertical-rl` or `vertical-lr`, the reported edges do not match that element's logical block and inline edges.

## Hidden elements

A hidden or detached element reports nothing, since it has no size to scroll. The first report comes once it renders.
