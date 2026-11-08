# Recipes

Things kenspeckle deliberately doesn't ship, because Svelte or the platform already does them in a few lines. Each recipe is the whole replacement.

## Grow a textarea to its content

CSS does this without JavaScript. `field-sizing: content` has been Baseline since June 2026:

```css
textarea {
  field-sizing: content;
  min-block-size: 3lh;
  max-block-size: 20lh;
}
```

The textarea grows in height as you type and scrolls once it reaches `max-block-size`. Its `rows` and `cols` attributes stop having any effect, so the minimum height goes in `min-block-size` instead. Older browsers keep the fixed size, which still works.

## Lock page scroll behind an overlay

CSS does this without JavaScript, through `:has()`, Baseline since December 2023:

```css
html:has([data-scroll-lock]) {
  overflow: hidden;
  scrollbar-gutter: stable;
}
```

Put `data-scroll-lock` on whatever covers the page while it is open:

```svelte
{#if open}
  <aside class="drawer" data-scroll-lock>…</aside>
{/if}

<dialog bind:this={dialog} data-scroll-lock={open || undefined}>…</dialog>
```

A closed `<dialog>` stays in the DOM, so it needs the condition; an overlay inside `{#if}` doesn't. For a modal dialog opened with `showModal()`, `html:has(dialog:modal)` needs no attribute at all.

The page stays locked while any overlay matches and unlocks when the last one goes, so nested overlays need no counting. The lock is in the server-rendered HTML too, so the page can't scroll before hydration.

Write the rule on `html`, not `body`. The browser applies the root element's `overflow` and `scrollbar-gutter` to the viewport, but `scrollbar-gutter` set on `body` never reaches it.

`scrollbar-gutter: stable` keeps the space a classic scrollbar took after `overflow: hidden` removes it, so the page doesn't shift sideways. It has been Baseline only since December 2024; older browsers lock the page but let it shift. Overlay scrollbars, the macOS and mobile default, take no space, so nothing shifts there anyway. On a page too short to scroll, with classic scrollbars, the lock adds a gutter that wasn't there, and the content under the overlay moves by one scrollbar's width. If that shows in your layout, set `scrollbar-gutter: stable` on `html` for the whole site instead, which reserves the space even when nothing scrolls.

## Know when an element is on screen

An inline attachment creates the observer and returns its cleanup:

```svelte
<div
  {@attach (node) => {
    const observer = new IntersectionObserver(([entry]) => {
      seen = entry.isIntersecting;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }}
>
  …
</div>
```

`seen` is a `$state` in the component script. An attachment re-runs when state it reads during setup changes. This one only writes `seen` from the observer's callback, so the observer is created once. If you read state for its options, such as a `threshold`, a change to that state disconnects the old observer and creates a new one, which is what you want.

## React to changes inside an element

The same shape, around a `MutationObserver`:

```svelte
<ul
  {@attach (node) => {
    count = node.children.length;
    const observer = new MutationObserver(() => {
      count = node.children.length;
    });
    observer.observe(node, { childList: true });
    return () => observer.disconnect();
  }}
>
  …
</ul>
```

A `MutationObserver` reports only changes made after `observe`, which is why the attachment reads the count once itself first.

## Know whether focus is inside an element

For styling, use CSS:

```css
.field:focus-within {
  outline: 2px solid;
}
```

For a value, listen for focus moving in and out. `focusout` fires before focus lands on the next element, and `relatedTarget` is that element, so focus moving between two children of the same element stays inside:

```svelte
<div
  onfocusin={() => (inside = true)}
  onfocusout={(event) => {
    inside = event.currentTarget.contains(event.relatedTarget);
  }}
>
  …
</div>
```

When focus leaves the window or moves into an iframe, `relatedTarget` is `null`, so `inside` becomes `false`.

## Keep the previous value

Where you write the value, save the old one first:

```ts
previous = count;
count = next;
```

For a value you don't write, such as a prop, an `$effect.pre` in the component script saves it before the new one renders:

```ts
let { value } = $props();
let previous = $state();
let last;

$effect.pre(() => {
  previous = last;
  last = value;
});
```

`last` is a plain variable, not state, so the effect re-runs only when `value` changes. `previous` is `undefined` until the first change.
