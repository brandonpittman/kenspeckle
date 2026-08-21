# Migrating off `sveltekit-view-transition`

The `sveltekit-view-transition` package predates Svelte 5 and still imports
SvelteKit APIs that SvelteKit 3 is going to change, so a repo on it carries a
migration blocker it does not control. This is the ordered, verifiable swap onto
kenspeckle.

## 1. Audit the footprint before touching anything

```sh
grep -rn "sveltekit-view-transition" src/
grep -rn "use:transition" src/
grep -rn "view-transition-name\|::view-transition" src/
```

The hoped-for result is one `setupViewTransition()` in the root layout and
**zero** `use:transition` uses. Do not count on it. One real app had six
`setupViewTransition()` call sites — the root layout plus five pages that called
it only to destructure the `transition` action — and nine `use:transition` sites.
Another had twenty test files mocking the package.

The `view-transition-name` / `::view-transition-*` hits are browser-native and
need **no changes at all**; leave them alone.

The audit *is* most of the job: it tells you whether this is a two-line swap or a
real migration.

## 2. Swap the registration

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import { viewTransition } from 'kenspeckle/kit';

	viewTransition();
</script>
```

Root layout only — `onNavigate` must be registered once. Per-page
`setupViewTransition()` calls that existed only to obtain the `transition` action
are **deleted outright**, not replaced: `viewTransitionName` is imported
directly, so nothing has to be handed down from a setup call.

## 3. Convert each `use:transition`

- `use:transition={'header'}` → `{@attach viewTransitionName('header')}`.
- A per-item `name` callback → `` {@attach viewTransitionName(`thing-${item.id}`)} ``.
- `shouldApply` → the `when` predicate. Gating that exists only to keep one
  shared name unique disappears once names are per-item: unique by construction.
- `applyImmediately: true` → a static `view-transition-name` in the stylesheet.

**`applyImmediately` is what decides whether a CSS swap is 1:1.** Omitted (the
default) means the package applied the name only once a transition was
starting — navigation-only. That is exactly what `viewTransitionName` does, so
the attachment is the 1:1 swap and static CSS is not: a static declaration is
live *always*, so the element newly participates in same-route transitions it was
previously invisible to. Sites that passed `applyImmediately: true` already meant
always-live, so those are the ones that become plain CSS.

## 4. Delete the lifecycle wiring

- `classes` and the `on('before-start-view-transition', …)` /
  `on('transition-finished', …)` pairs go. Direction is `retreat()` plus the
  `data-view-transition` attribute; anything else hung off those events goes in
  `onStart` / `onSettle`.
- Any hold flag or safety timeout those events guarded goes too — a loading
  overlay held across the transition with a 5s fallback, for instance. The
  library's own deadline is the net now.
- If the `classes` callback derived direction by comparing `navigation.to`
  against component state, look for the single call site that actually triggers
  the backward move (a `goBack()` that calls `goto`) and express it as the
  `retreat()` predicate. The navigation introspection usually disappears.
- Watch for a class the package used to own having **two writers** afterwards. A
  `beforeNavigate` that also toggles it runs *before* `onNavigate`, so it sets the
  value and the transition layer overwrites it immediately. Pick one owner.

## 5. Rekey the direction CSS

Every selector that keyed off a class the package wrote moves onto the
`data-view-transition` contract — `forward`, `retreat`, `step-forward`,
`step-retreat` on `<html>`. This is the step that is easy to skip and shows up as
"the animation runs, but always in the same direction".

## 6. Swap the dependency, with the package manager

```sh
npm remove sveltekit-view-transition
npm i kenspeckle
```

Never hand-edit `package.json`. Then run the type check and the unit suite.

Test files that mocked the package now mock nothing — delete those mocks rather
than repointing them at kenspeckle. Anything that needs to control a transition
in a test injects the `start` / `reducedMotion` options at the call site instead.

## 7. Confirm nothing regressed visually

Once the direction CSS is rekeyed, the default crossfade and every named morph
should look **identical**: both are browser features the package was only
configuring. If something changed, it is step 2, 3 or 5 — not the browser.
