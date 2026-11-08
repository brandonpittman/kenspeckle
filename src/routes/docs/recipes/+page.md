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

## Close something when the user clicks outside it

For a menu, dropdown or popup, the `popover` attribute does it without JavaScript. It has been Baseline since April 2024:

```svelte
<button popovertarget={id}>Options</button>

<div {id} popover ontoggle={(event) => (open = event.newState === 'open')}>…</div>
```

A `popover` (its `auto` state) closes when the user clicks outside it or presses Escape, and opening one closes any other open one unless it's nested inside. The button toggles it. Take `id` from `$props.id()` in the component script so two instances never share one. `ontoggle` keeps `open` in step with the element for anything else that reads it; leave it off if nothing does.

A modal `<dialog>` opened with `showModal()` closes on Escape but not on a click outside. `closedby="any"` adds that, but it isn't Baseline yet. Until it is, close the dialog when a click lands on the dialog element itself. A click on the backdrop has the dialog as its target, and so does a click on the dialog's own padding, so move the padding to an inner element:

```svelte
<dialog
  onclick={(event) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  }}
>
  <div class="content">…</div>
</dialog>
```

For anything that isn't an overlay, listen on the window from an inline attachment. `on` comes from `svelte/events`:

```svelte
<div
  {@attach (node) =>
    on(window, 'click', (event) => {
      if (!event.composedPath().includes(node)) open = false;
    })}
>
  …
</div>
```

`composedPath()` is the path the click took when it was dispatched, so it still includes the element when an earlier handler removed the clicked node, and when the element sits inside a shadow root that retargets `event.target` away from it. `node.contains(event.target)` reads outside in both cases. `on` returns the listener's removal, so the attachment cleans up after itself.

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
