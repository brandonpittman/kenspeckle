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
