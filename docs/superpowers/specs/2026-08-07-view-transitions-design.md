# View transitions

Status: approved design, unimplemented.

Ship the CSS View Transitions API as a kenspeckle utility, with a SvelteKit tier for the parts that
need a router. Two apps migrate onto it: `cq-test-web` (which has a working hand-rolled version
this is extracted from) and `brain-life-platform` (which has a divergent partial copy).

## Why

Two implementations already exist and drift. A commit in cq-test-web was a hand-sync — "adopt blp's
deadline handling" — copying a fix across by hand. That recurring cost is the motivation; there is
no user-facing bug.

blp is missing the JS reduced-motion bail (its CSS-only approach still pays the rendering freeze),
directional transitions, and the same-route stepper. cq is missing nothing blp has.

Neither has an element-naming API. That is the gap this design closes: the canonical view-transition
use case is a shared-element morph, and both apps handle naming with static CSS, which cannot
express dynamic names, cannot gate a list to one claimant, and cannot name an element that mounts
during the transition.

## Package shape

Two entry points, one package.

**`kenspeckle`** — Svelte only, peers unchanged. The transition primitive: the
`startViewTransition` wrapper, the `skipTransition` deadline, the reduced-motion bail, the
three-promise rejection handling.

**`kenspeckle/kit`** — adds `@sveltejs/kit` as an optional peer. Everything needing a router: the
`onNavigate` registration, the `resolve()`-before-`await` ordering, the direction predicate, the
root attribute, the naming attachment.

`$app/navigation` is a Kit virtual module resolved by the consumer's Vite plugin — `svelte-package`
leaves it in `dist`, which is how every Kit library ships (verified against `sveltekit-view-transition`'s
published dist, which opens with `import { onNavigate } from '$app/navigation'`). The only genuine
npm import is `normalizeUrl` in `samePath`.

```json
"exports": {
  ".":     { "types": "./dist/index.d.ts",     "svelte": "./dist/index.js" },
  "./kit": { "types": "./dist/kit/index.d.ts", "svelte": "./dist/kit/index.js" }
},
"peerDependencies": { "svelte": "^5.40.0", "@sveltejs/kit": "^2.0.0" },
"peerDependenciesMeta": { "@sveltejs/kit": { "optional": true } }
```

## Exports

```ts
// kenspeckle
viewTransition(update: () => void | Promise<void>, options?): ViewTransition | undefined

// kenspeckle/kit
viewTransition(options?)                      // registers onNavigate
viewTransition(update, options?)              // delegates to the primitive
viewTransitionName(name, options?)            // → attachment
viewTransitionName(element, name, options?)   // → imperative, returns cleanup
retreat(predicate)
samePath(a, b)
```

`/kit`'s `viewTransition` is a superset discriminated on `typeof first === 'function'`, so a Kit app
imports one name from one path and a Svelte-only app never sees the registering form.

`viewTransition` is the specced name and is used for both — no invented `pageTransition`. The
no-argument registering call carries a global side effect implicitly; `setupViewTransition` was
considered and rejected, since the registration lives in exactly one file per app where a reader has
context, and the alternative costs a permanent exception to the naming convention.

### Primitive options

| option | default | why |
| --- | --- | --- |
| `deadline` | `600` | past this a crossfade reads as a hang — rendering is suspended for the whole update |
| `onStart` | — | runs synchronously before the old snapshot is captured |
| `onSettle` | — | runs once `finished` settles, resolved OR rejected |
| `reducedMotion` | `() => prefersReducedMotion.current` | returns without transitioning — no animation AND no freeze |
| `start` | lazy `document.startViewTransition` | injected for tests; keeps `bind` internal and init SSR-safe |

## The attachment

```ts
/** Structural, not imported — any router handing over a completion promise fits. */
type Navigation = {
  complete: Promise<void>;
  type?: string;
  from?: { url: URL } | null;
  to?: { url: URL } | null;
};

type Options = {
  /** Only claim the name for navigations this returns true for. */
  when?: (navigation: Navigation) => boolean;
  /** Claim it inside the update callback, for elements that mount during the transition. */
  onArrival?: boolean;
};
```

Applies `view-transition-name` just before the old snapshot, clears it when `finished` settles.
Nothing is named while idle — Archibald's advice, and what cq's `.navigating` class hand-rolled.

**`when`** is not a nicety. Only one element may carry a name per transition; a list of twenty
thumbnails all claiming `photo-*` aborts the transition outright, so the canonical morph is broken
without it.

**`onArrival`** covers the one case static CSS structurally cannot. The default moment is before the
old snapshot, which only reaches elements already on the outgoing page. An element that mounts
*during* the transition — the destination half of a morph — needs naming inside the update callback,
after the DOM commits and before the new snapshot. That is the only window it can join.

Cut during design: `name` as a function (each item's attachment closes over its own id, so the gate
needs the navigation but the name does not) and a `during: 'step' | 'navigate'` scope option (it
solved a problem cq does not have — `question-view` is already always-named there and a navigation
off those screens already animates it with the UA default).

## The attribute contract

One published surface. States, not booleans — CUBE exception style.

```
data-view-transition="forward" | "retreat" | "step-forward" | "step-retreat"
```

Absent when idle, present for the transition's life. The app authors keyframes against it:

```css
[data-view-transition='retreat']::view-transition-old(profile-content) { … }
```

Compound values keep same-route steps distinguishable from navigations — their durations and
keyframes differ — without an API knob. The vendor name is deliberately absent: the attribute
describes the state, not the library, and survives a rename.

Naming needs no published class, because the attachment owns it. That deletes cq's
`NAVIGATING_CLASS` export, its `.navigating .back-button` rule, the comment warning that renaming
either half kills the morph silently, and the test whose only job was pinning the two together.

## Testing

Follows `copy`'s precedent: attachments are called as functions, since an attachment IS
`(element) => cleanup`. No component render. `expect.requireAssertions` is already on.

```ts
const el = () => document.body.appendChild(document.createElement('div'));

// drive a transition without a component to host onNavigate
const drive = (nav = { complete: Promise.resolve(), to: { url: new URL('https://x.test/a') } }) =>
  viewTransition({ start: fakeStart })(nav);
```

Both forms run the same six assertions from a shared table, differing only in constructor:

| behaviour | attachment | imperative |
| --- | --- | --- |
| unnamed while idle | `viewTransitionName('hero')(el)` | `viewTransitionName(el, 'hero')` |
| named during a transition | drive, assert `'hero'` | same |
| cleared when `finished` settles | resolve `finished`, assert `''` | same |
| `when` false → never named | drive, assert `''` | same |
| `onArrival` → named in the update callback, not before | assert inside the callback | same |
| cleanup detaches | cleanup, drive again, assert `''` | same |

Shipping both forms is defensible only with both tested — that is the condition on including the
imperative form, which has no consumer in either app.

The primitive and the registration get their own suites. cq's existing 31 tests port over nearly
unchanged, since its core is already injectable via `start`.

Client project (`*.svelte.test.ts`, real chromium) for anything touching the DOM or a transition;
node project (plain `*.test.ts`) for `samePath`.

## Docs

Per kenspeckle's CLAUDE.md, every user-facing feature ships a `.svx` page, a `utilities.ts` registry
entry, and a roadmap entry in the same change. Nothing transition-shaped is on the roadmap today, so
these are new `shipped` items, not moves from `planned`.

Two pages: `viewTransition` (both call shapes, `retreat`, `samePath`, and the root-snapshot section
below), and `viewTransitionName` (both forms, `when`, `onArrival`). `retreat` and `samePath` are
sections on the first page rather than pages of their own — they are meaningless without it — so
they get roadmap entries but no separate registry rows.

**Blocked on a registry change.** `Utility.type` is `UtilityType = 'class' | 'value' | 'attachment'`;
`'function'` exists only in `TagType`, which the roadmap uses. Its own comment concedes the gap:
"superset of UtilityType — the roadmap also tags wiring/wrapper functions." So `viewTransition` has
no valid registry tag. Widen `UtilityType` to include `'function'` and collapse `TagType` to an
alias — the registry has to describe what ships, and the roadmap already promises `debounce` and
`throttle`, which will hit this the moment they land. `viewTransitionName` tags `attachment` and is
unaffected.

The `viewTransition` page must cover the three ways to control the root snapshot, because a consumer
hitting the duration problem otherwise has no idea what governs their timing:

1. leave it alone — UA crossfade, the default, tier 0
2. `::view-transition-group(root) { animation-duration: 0s }` — captured, not animated
3. `:root { view-transition-name: none }` — not captured at all

They are visually equivalent when the unnamed remainder is identical across screens. The reasons to
prefer 3 are cost (a full-viewport snapshot pair per navigation) and duration: the UA default is
`0.25s`, so with root animating it governs the transition's length, and `finished` — hence the
attribute removal and `onSettle` — fires later than the visible motion ends.

## Sequencing

1. **Build it in kenspeckle** — exports, attachment, attribute, tests, docs. Ships alone.
2. **Link into cq locally** — `"kenspeckle": "file:../../kenspeckle"`, migrate call sites, run gates.
3. **Manual pass including the imperative form** — the one shape with no consumer, exercised by hand.
4. **Publish `0.1.0`.**
5. **Switch cq to `^0.1.0`** and commit that.
6. **Migrate blp** against the published version.

Steps 2 and 3 de-risk the API against a real consumer before semver starts.

**Do not deploy cq while linked.** `file:../../kenspeckle` resolves on one machine; Workers Builds
has no sibling directory, so any deploy from a commit carrying that dep fails at `npm ci`. Keep 2–3
uncommitted or off a deploying branch. Step 5 makes cq releasable again.

**Re-emit the lockfile with npm before committing.** `nub add`/`nub remove` is known to corrupt
`package-lock.json` on the round trip, and Workers Builds runs `npm ci`.

## Migrations

**cq** — delete `src/lib/view-transition/`; `initViewTransition()` → `viewTransition()`;
`setRetreat` → `retreat`; `.retreat` / `.navigating` CSS → the attribute; BackButton's CSS rule and
its contract test → the attachment; `transitionSameRoute` → `viewTransition(fn, …)`.

**blp** — replace `view-transition-deadline.ts`; keep the Cloak `onStart`/`onSettle` wiring
verbatim; gains the JS reduced-motion bail it lacks.

Both are mechanical once step 1 fixes the API. They are independent of each other.

## Facts worth not re-deriving

- **`resolve()` before `await`** breaks a mutual wait: Kit holds the navigation until the returned
  promise settles; the browser holds the snapshot until the update callback settles. Source is Geoff
  Rich, *Unlocking view transitions in SvelteKit 1.24* (svelte.dev blog, 2023-08-31) — NOT the API
  reference, which mentions `startViewTransition` but ships no snippet.
- **Clear the deadline on `updateCallbackDone`, never `finished`.** Suspension lifts with the update
  callback; left on `finished` the timer stays armed through the animation and snaps a running morph
  to its end state on an ordinary slow-ish navigation.
- **Direction must be a predicate, never a flag.** Kit skips `beforeNavigate` for a navigation begun
  while another is in flight (`client.js:1683`, true from `:1755` to `:2033`), so any flag set at
  click time and spent at transition time can be stranded by a superseded navigation and reverse a
  later one. No boolean closes this.
- **`goto` pushes or replaces, never pops.** Kit exposes no `back()`. `NavigationTarget` is
  `{ params, route, url }`, so `goto`'s `state` option cannot carry a direction hint readable at
  `onNavigate`. `history.back()` is the only pop and it surrenders the destination.
- **`navigation.complete` rejects on abort and cancel.** Hence `.finally`, not `.then`, for cleanup.
  `sveltekit-view-transition`'s `is_transition_happening` latch bug is exactly this mistake.
- **`ready` is what a skip rejects.** `finished` mirrors `updateCallbackDone` and fulfils. Attach a
  handler to `ready` or Chrome logs AbortError on precisely the slow navigations the deadline rescues.
- **The supersede race on class/attribute cleanup is unreachable.** The `::view-transition` pseudo
  layer covers the viewport and intercepts pointer events, so no user can start a second navigation
  mid-animation. Verified in Chromium and with a Playwright click that failed "`<html>` intercepts
  pointer events". Do not add a transition-ownership token.
- **`sveltekit-view-transition` is not an alternative**: no reduced-motion check, never calls
  `skipTransition`, `.catch(console.error)` on all three promises, and a permanent latch when
  `finished` rejects.

## Unresolved

- Whether `samePath` ships at all. It is correct for any app comparing configured paths against
  navigation targets, but its only known consumer is cq, and cq's flow model should arguably
  normalize its own pathnames — which would delete the reason it exists. Decide before 0.1.0;
  omitting it is easier than removing it later.
