# View Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the CSS View Transitions API as a kenspeckle utility with a `kenspeckle/kit` tier, so `cq-test-web` and `brain-life-platform` stop maintaining divergent hand-rolled copies.

**Architecture:** A Svelte-only primitive (`viewTransition(update, options)`) owns the `startViewTransition` wrapper, the `skipTransition` deadline, the reduced-motion bail, and the three-promise rejection handling. A `kenspeckle/kit` tier adds everything needing a router: the `onNavigate` registration with the `resolve()`-before-`await` ordering, a direction predicate, the `data-view-transition` root attribute, and a `viewTransitionName` attachment backed by a module-level claim registry.

**Tech Stack:** Svelte 5 (runes, attachments), SvelteKit 2 (`$app/navigation`, optional peer), `svelte-package`, vitest (browser project for DOM, node project for pure functions), mdsvex for docs.

**Spec:** `docs/superpowers/specs/2026-08-07-view-transitions-design.md`

---

## Decisions this plan locks in

Two things the spec left open or under-specified. Both are settled here; nothing downstream is ambiguous.

**1. `samePath` ships.** The spec's Unresolved section asked whether it should. It does: `cq-test-web` migrates onto this package at sequencing step 2 and needs it that day; the flow-model normalization that would delete its reason to exist is a captured idea with no owner and no date. Six lines, five tests, one real npm import (`normalizeUrl`). If normalization ever lands, drop it in `0.2.0` — a minor bump on a `0.x` package is cheap, and shipping it now is what makes step 2 mechanical.

**2. The registry is driven by an internal phase API, not by the attachment observing globals.** `viewTransitionName` owns a module-level `Set` of claims plus a `current` phase pointer. The navigation registration calls `beginPhase(navigation, 'capture' | 'arrival')` and `endTransition()`. Two paths apply a name — the phase sweep (for elements already registered) and a self-check at attachment setup (for elements that mount after their phase swept). Both are needed and both are tested.

**Deviation from the spec's test snippet:** the spec showed `viewTransition({ start: fakeStart })(nav)`. That cannot work — the registering form calls `onNavigate`, which throws outside a component. Tests drive `navigationTransition(options)` instead, an internal builder exported from `src/lib/kit/view-transition.ts` but not from the `/kit` barrel. This mirrors cq's `withDirection`, whose comment says exactly this.

---

## File structure

| File                                              | Responsibility                                                                                                                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/view-transition.ts`                      | The primitive. `viewTransition(update, options)` + internal `runViewTransition` that takes the attribute vocabulary. No router, no DOM beyond `documentElement`.                  |
| `src/lib/view-transition.svelte.test.ts`          | Primitive behaviour: deadline, bail, attribute, promise handling.                                                                                                                 |
| `src/lib/kit/types.ts`                            | The structural `Navigation` type. Separate file so `view-transition.ts` and `view-transition-name.ts` can both import it without a cycle.                                         |
| `src/lib/kit/same-path.ts`                        | Trailing-slash-tolerant pathname comparison via Kit's `normalizeUrl`.                                                                                                             |
| `src/lib/kit/same-path.test.ts`                   | Node project — no DOM.                                                                                                                                                            |
| `src/lib/kit/view-transition-name.ts`             | The naming attachment + imperative form, and the claim registry that backs both.                                                                                                  |
| `src/lib/kit/view-transition-name.svelte.test.ts` | Both call shapes against the same six behaviours.                                                                                                                                 |
| `src/lib/kit/view-transition.ts`                  | `onNavigate` registration, the `resolve()`-before-`await` ordering, the `retreat` predicate, the `forward`/`retreat` attribute vocabulary, and the phase calls into the registry. |
| `src/lib/kit/view-transition.svelte.test.ts`      | Registration behaviour + naming integration.                                                                                                                                      |
| `src/lib/kit/index.ts`                            | The `kenspeckle/kit` barrel.                                                                                                                                                      |
| `src/lib/index.ts`                                | Modified — root barrel gains the primitive.                                                                                                                                       |
| `package.json`                                    | Modified — `exports` gains `./kit`, `@sveltejs/kit` becomes an optional peer.                                                                                                     |
| `src/routes/docs/utilities.ts`                    | Modified — `UtilityType` widens to include `'function'`, two registry rows added.                                                                                                 |
| `src/routes/docs/roadmap.ts`                      | Modified — four new `shipped` entries.                                                                                                                                            |
| `src/routes/docs/view-transition/+page.svx`       | Docs page: both call shapes, `retreat`, `samePath`, root-snapshot control.                                                                                                        |
| `src/routes/docs/view-transition-name/+page.svx`  | Docs page: both forms, `when`, `onArrival`.                                                                                                                                       |

**Note on the tier split:** `src/lib/kit/*` becomes `dist/kit/*` under `svelte-package`. `$app/navigation` is a Kit virtual module — `svelte-package` leaves the import string alone and the consumer's Vite plugin resolves it. That is how every Kit library ships. Do not try to bundle or shim it.

---

## Repository conventions you must follow

- **Version control is jj, not git.** Never run `git commit`, `git add`, `git checkout`, `git status`, or `git diff`. Use `jj commit -m "..."` (commits everything in the working copy), `jj st`, `jj diff`, `jj log`. There is no staging area — jj snapshots the working copy automatically.
- **Commit messages:** conventional-commit prefix, English, lowercase after the colon, no attribution or co-author trailers of any kind.
- **Comments:** one short line maximum, and only where a constraint is non-obvious. Never a multi-line explainer, never a narration of what the next line does. The comments written into this plan's code blocks are the intended density — do not add more.
- **Imports inside `src/lib` use the `.js` extension** even for `.ts` files (`./view-transition.js`). This is the existing convention — see `src/lib/index.ts`.
- **Formatting:** run `npm run format` before committing any task. Prettier uses tabs in this repo.

## Commands

| Command                                                             | What it does                                                                                               |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm run test:unit -- --run`                                        | Both vitest projects once. Without `--run` it watches and never exits.                                     |
| `npm run test:unit -- --run src/lib/view-transition.svelte.test.ts` | One file.                                                                                                  |
| `npm run check`                                                     | `svelte-check` — run after every task.                                                                     |
| `npm run lint`                                                      | Prettier check + eslint.                                                                                   |
| `npm run build`                                                     | `wrangler types --check && vite build && npm run prepack` — the last step is `svelte-package` + `publint`. |

Vitest routes `*.svelte.test.ts` to a real headless Chromium and everything else to node. A test touching `document` MUST be named `*.svelte.test.ts` or it will fail with `document is not defined`.

---

### Task 1: The primitive

**Files:**

- Create: `src/lib/view-transition.ts`
- Test: `src/lib/view-transition.svelte.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/view-transition.svelte.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { viewTransition } from './view-transition.js';

// prefersReducedMotion is a MediaQuery built at svelte/motion module scope and its constructor calls
// matchMedia eagerly, so stubbing window.matchMedia here would not reach it.
const motion = vi.hoisted(() => ({ reduced: false }));

vi.mock('svelte/motion', () => ({
	prefersReducedMotion: {
		get current() {
			return motion.reduced;
		}
	}
}));

const root = () => document.documentElement;
const state = () => root().dataset.viewTransition;

/** Hand-driven stand-in: `finished` stays pending until `finish()`, so cleanup is observable. */
function fakeStart(updateDone: Promise<void> = Promise.resolve(), ready?: Promise<void>) {
	const skipTransition = vi.fn();
	let finish!: () => void;
	const finished = new Promise<void>((resolve) => (finish = resolve));
	const start = vi.fn((update: () => void | Promise<void>) => {
		void Promise.resolve(update()).catch(() => {});
		return {
			ready: ready ?? updateDone,
			updateCallbackDone: updateDone,
			finished,
			skipTransition
		} as unknown as ViewTransition;
	});
	return { start, skipTransition, finish };
}

afterEach(() => {
	vi.useRealTimers();
	motion.reduced = false;
	delete root().dataset.viewTransition;
});

describe('viewTransition — the transition', () => {
	it('runs the update through the injected start', () => {
		const { start } = fakeStart();
		const update = vi.fn();
		viewTransition(update, { start });
		expect(start).toHaveBeenCalledTimes(1);
		expect(update).toHaveBeenCalledTimes(1);
	});

	it('returns the transition object', () => {
		const { start } = fakeStart();
		expect(viewTransition(() => {}, { start })).toBeDefined();
	});
});

describe('viewTransition — the attribute', () => {
	it('writes step-forward for the duration of the transition', () => {
		const { start } = fakeStart();
		viewTransition(() => {}, { start });
		expect(state()).toBe('step-forward');
	});

	it('writes step-retreat when retreat is set', () => {
		const { start } = fakeStart();
		viewTransition(() => {}, { start, retreat: true });
		expect(state()).toBe('step-retreat');
	});

	it('clears the attribute and calls onSettle once finished settles', async () => {
		const { start, finish } = fakeStart();
		const onSettle = vi.fn();
		viewTransition(() => {}, { start, onSettle });
		expect(state()).toBe('step-forward');
		finish();
		await vi.waitFor(() => expect(onSettle).toHaveBeenCalledTimes(1));
		expect(state()).toBeUndefined();
	});

	it('runs onStart before the snapshot is taken', () => {
		const seen: string[] = [];
		const start = (update: () => void | Promise<void>) => {
			seen.push('start');
			void Promise.resolve(update()).catch(() => {});
			return {
				ready: Promise.resolve(),
				updateCallbackDone: Promise.resolve(),
				finished: new Promise<void>(() => {}),
				skipTransition: () => {}
			} as unknown as ViewTransition;
		};
		viewTransition(() => {}, { start, onStart: () => seen.push('onStart') });
		expect(seen).toEqual(['onStart', 'start']);
	});
});

describe('viewTransition — bailing out', () => {
	it('runs the update without a transition under reduced motion', () => {
		const { start } = fakeStart();
		const update = vi.fn();
		motion.reduced = true;
		const result = viewTransition(update, { start });
		expect(update).toHaveBeenCalledTimes(1);
		expect(start).not.toHaveBeenCalled();
		expect(state()).toBeUndefined();
		expect(result).toBeUndefined();
	});

	it('honours an injected reducedMotion over the default', () => {
		const { start } = fakeStart();
		viewTransition(() => {}, { start, reducedMotion: () => true });
		expect(start).not.toHaveBeenCalled();
	});

	it('runs the update when the API is missing', () => {
		const update = vi.fn();
		const original = document.startViewTransition;
		// defineProperty rather than `delete`: the method is non-optional in lib.dom.
		Object.defineProperty(document, 'startViewTransition', {
			value: undefined,
			configurable: true
		});
		viewTransition(update);
		Object.defineProperty(document, 'startViewTransition', {
			value: original,
			configurable: true
		});
		expect(update).toHaveBeenCalledTimes(1);
	});
});

describe('viewTransition — the deadline', () => {
	it('skips the transition once the deadline passes', async () => {
		vi.useFakeTimers();
		const { start, skipTransition } = fakeStart(new Promise<void>(() => {}));
		viewTransition(() => {}, { start, deadline: 600 });
		await vi.advanceTimersByTimeAsync(600);
		expect(skipTransition).toHaveBeenCalledTimes(1);
	});

	it('disarms the deadline once the update callback settles', async () => {
		vi.useFakeTimers();
		const { start, skipTransition } = fakeStart(Promise.resolve());
		viewTransition(() => {}, { start, deadline: 600 });
		await vi.advanceTimersByTimeAsync(0);
		await vi.advanceTimersByTimeAsync(600);
		expect(skipTransition).not.toHaveBeenCalled();
	});
});

describe('viewTransition — promise rejections', () => {
	it('still clears and settles when the update callback throws', async () => {
		const { start, finish } = fakeStart(Promise.reject(new Error('boom')));
		const onSettle = vi.fn();
		viewTransition(() => {}, { start, onSettle });
		finish();
		await vi.waitFor(() => expect(onSettle).toHaveBeenCalledTimes(1));
		expect(state()).toBeUndefined();
	});

	it('leaves no unhandled rejection when ready rejects', async () => {
		const unhandled = vi.fn();
		window.addEventListener('unhandledrejection', unhandled);
		const { start } = fakeStart(Promise.resolve(), Promise.reject(new Error('skipped')));
		viewTransition(() => {}, { start });
		// Two macrotasks: the unhandled-rejection check runs after a microtask checkpoint plus a task.
		await new Promise((r) => setTimeout(r));
		await new Promise((r) => setTimeout(r));
		window.removeEventListener('unhandledrejection', unhandled);
		expect(unhandled).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- --run src/lib/view-transition.svelte.test.ts`

Expected: FAIL — `Failed to resolve import "./view-transition.js"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/view-transition.ts`:

```ts
import { prefersReducedMotion } from 'svelte/motion';

export type StartViewTransition = (update: () => void | Promise<void>) => ViewTransition;

export interface ViewTransitionOptions {
	/** Reverse direction — writes `step-retreat` instead of `step-forward`. */
	retreat?: boolean;
	/** Past this a crossfade reads as a hang: the update callback suspends rendering until it settles. */
	deadline?: number;
	onStart?: () => void;
	onSettle?: () => void;
	reducedMotion?: () => boolean;
	/** Injected in tests; keeps the `bind` internal and init SSR-safe. */
	start?: StartViewTransition;
}

/** @internal — `/kit` supplies its own attribute vocabulary. Not re-exported from the barrel. */
export interface RunOptions extends ViewTransitionOptions {
	state?: string;
}

const ignore = () => {};
const root = () => document.documentElement;

export function viewTransition(
	update: () => void | Promise<void>,
	options: ViewTransitionOptions = {}
): ViewTransition | undefined {
	return runViewTransition(update, {
		...options,
		state: options.retreat ? 'step-retreat' : 'step-forward'
	});
}

/** @internal */
export function runViewTransition(
	update: () => void | Promise<void>,
	{
		deadline = 600,
		onStart,
		onSettle,
		reducedMotion = () => prefersReducedMotion.current,
		start,
		state = 'step-forward'
	}: RunOptions = {}
): ViewTransition | undefined {
	// Resolved per call, never at module scope: SSR must not touch document.
	const startTransition =
		start ??
		(typeof document === 'undefined' ? undefined : document.startViewTransition?.bind(document));

	// No transition at all, not merely no animation — the update callback suspends rendering.
	if (!startTransition || reducedMotion()) {
		// A sync throw still propagates; an async rejection is swallowed as the transition path swallows `finished`.
		void Promise.resolve(update()).catch(ignore);
		return;
	}

	root().dataset.viewTransition = state;
	onStart?.();

	const transition = startTransition(update);

	const timer = setTimeout(() => transition.skipTransition(), deadline);

	// Disarmed on the update callback, not `finished`: armed through the animation it snaps a running morph.
	void transition.updateCallbackDone.catch(ignore).finally(() => clearTimeout(timer));

	// Swallowed so cleanup still runs when the update callback threw; a skip fulfils `finished`.
	void transition.finished.catch(ignore).finally(() => {
		delete root().dataset.viewTransition;
		onSettle?.();
	});

	// A skip rejects `ready`; unhandled, Chrome logs AbortError on the slow navigations the deadline rescues.
	void transition.ready.catch(ignore);

	return transition;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- --run src/lib/view-transition.svelte.test.ts`

Expected: PASS — 13 tests.

- [ ] **Step 5: Type-check and format**

Run: `npm run format && npm run check`

Expected: `svelte-check` reports 0 errors. `src/lib/view-transition.ts` is not yet exported from the barrel; that is Task 6.

- [ ] **Step 6: Commit**

```bash
jj commit -m "feat: view transition primitive with deadline and reduced-motion bail"
```

---

### Task 2: samePath

**Files:**

- Create: `src/lib/kit/same-path.ts`
- Test: `src/lib/kit/same-path.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/kit/same-path.test.ts`. Note the filename has no `.svelte` — this runs in the node project, which is correct because nothing here touches the DOM.

```ts
import { describe, expect, it } from 'vitest';
import { samePath } from './same-path.js';

describe('samePath', () => {
	it('matches across a trailing-slash difference', () => {
		expect(samePath({ url: new URL('https://x.test/profile/gender') }, '/profile/gender/')).toBe(
			true
		);
	});

	it('matches when neither side has a trailing slash', () => {
		expect(samePath({ url: new URL('https://x.test/profile/gender') }, '/profile/gender')).toBe(
			true
		);
	});

	it('does not match different paths', () => {
		expect(samePath({ url: new URL('https://x.test/profile/income') }, '/profile/gender/')).toBe(
			false
		);
	});

	it('is false when the target is null', () => {
		expect(samePath({ url: new URL('https://x.test/profile/gender') }, null)).toBe(false);
	});

	it('is false when the navigation target is null', () => {
		expect(samePath(null, '/profile/gender/')).toBe(false);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- --run src/lib/kit/same-path.test.ts`

Expected: FAIL — `Failed to resolve import "./same-path.js"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/kit/same-path.ts`:

```ts
import { normalizeUrl } from '@sveltejs/kit';

// Configured paths often keep a trailing slash; Kit strips it from navigation targets, so a bare === matches nothing.
export function samePath(
	to: { url: URL } | null | undefined,
	target: string | null | undefined
): boolean {
	if (!to || !target) return false;
	return normalizeUrl(to.url.pathname).url.pathname === normalizeUrl(target).url.pathname;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- --run src/lib/kit/same-path.test.ts`

Expected: PASS — 5 tests.

- [ ] **Step 5: Type-check and format**

Run: `npm run format && npm run check`

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
jj commit -m "feat(kit): samePath, trailing-slash-tolerant pathname comparison"
```

---

### Task 3: The Navigation type and the naming registry

This task builds `viewTransitionName` and the claim registry it owns. The navigation registration that drives the registry comes in Task 5 — here the tests call the internal phase API directly.

**Files:**

- Create: `src/lib/kit/types.ts`
- Create: `src/lib/kit/view-transition-name.ts`
- Test: `src/lib/kit/view-transition-name.svelte.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/kit/view-transition-name.svelte.test.ts`. Both call shapes run the same six behaviours from a shared table — that is the condition on shipping the imperative form, which has no consumer in either migrating app.

```ts
import { afterEach, describe, expect, it } from 'vitest';
import {
	beginPhase,
	endTransition,
	viewTransitionName,
	type ViewTransitionNameOptions
} from './view-transition-name.js';
import type { Navigation } from './types.js';

const nav = (to = 'https://x.test/b'): Navigation => ({
	complete: Promise.resolve(),
	from: { url: new URL('https://x.test/a') },
	to: { url: new URL(to) }
});

const cleanups: Array<() => void> = [];

function el(): HTMLElement {
	const node = document.createElement('div');
	document.body.appendChild(node);
	return node;
}

const named = (node: HTMLElement) => node.style.viewTransitionName;

/** The two published shapes reduced to one signature, so the table below runs against both. */
const forms = [
	{
		label: 'attachment',
		wire: (node: HTMLElement, name: string, options?: ViewTransitionNameOptions) =>
			viewTransitionName(name, options)(node) as () => void
	},
	{
		label: 'imperative',
		wire: (node: HTMLElement, name: string, options?: ViewTransitionNameOptions) =>
			viewTransitionName(node, name, options)
	}
];

/** Claims outlive their elements — the registry is module scope, so every test unregisters. */
function attach(
	node: HTMLElement,
	wire: (typeof forms)[number]['wire'],
	name: string,
	options?: ViewTransitionNameOptions
) {
	const cleanup = wire(node, name, options);
	cleanups.push(cleanup);
	return cleanup;
}

afterEach(() => {
	endTransition();
	while (cleanups.length) cleanups.pop()!();
	document.body.replaceChildren();
});

for (const { label, wire } of forms) {
	describe(`viewTransitionName — ${label} form`, () => {
		it('leaves the element unnamed while idle', () => {
			const node = el();
			attach(node, wire, 'hero');
			expect(named(node)).toBe('');
		});

		it('names the element for the duration of a transition', () => {
			const node = el();
			attach(node, wire, 'hero');
			beginPhase(nav(), 'capture');
			expect(named(node)).toBe('hero');
		});

		it('clears the name when the transition ends', () => {
			const node = el();
			attach(node, wire, 'hero');
			beginPhase(nav(), 'capture');
			endTransition();
			expect(named(node)).toBe('');
		});

		it('never names the element when `when` returns false', () => {
			const node = el();
			attach(node, wire, 'hero', { when: () => false });
			beginPhase(nav(), 'capture');
			expect(named(node)).toBe('');
		});

		it('gates on the navigation `when` receives', () => {
			const node = el();
			attach(node, wire, 'hero', { when: (n: Navigation) => n.to?.url.pathname === '/wanted' });
			beginPhase(nav('https://x.test/wanted'), 'capture');
			expect(named(node)).toBe('hero');
		});

		it('claims at arrival, not capture, when onArrival is set', () => {
			const node = el();
			attach(node, wire, 'hero', { onArrival: true });
			beginPhase(nav(), 'capture');
			expect(named(node)).toBe('');
			beginPhase(nav(), 'arrival');
			expect(named(node)).toBe('hero');
		});

		it('stops naming after cleanup', () => {
			const node = el();
			attach(node, wire, 'hero')();
			beginPhase(nav(), 'capture');
			expect(named(node)).toBe('');
		});
	});
}

describe('viewTransitionName — mounting mid-transition', () => {
	it('claims immediately when an onArrival element registers after the arrival sweep', () => {
		beginPhase(nav(), 'arrival');
		const node = el();
		cleanups.push(viewTransitionName(node, 'hero', { onArrival: true }));
		expect(named(node)).toBe('hero');
	});

	it('does not claim a capture-phase element that registers during arrival', () => {
		beginPhase(nav(), 'arrival');
		const node = el();
		cleanups.push(viewTransitionName(node, 'hero'));
		expect(named(node)).toBe('');
	});

	it('clears a mid-transition claim when the transition ends', () => {
		beginPhase(nav(), 'arrival');
		const node = el();
		cleanups.push(viewTransitionName(node, 'hero', { onArrival: true }));
		endTransition();
		expect(named(node)).toBe('');
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- --run src/lib/kit/view-transition-name.svelte.test.ts`

Expected: FAIL — `Failed to resolve import "./view-transition-name.js"`.

- [ ] **Step 3: Write the Navigation type**

Create `src/lib/kit/types.ts`:

```ts
/** Structural, not imported from Kit — any router handing over a completion promise fits. */
export interface Navigation {
	complete: Promise<void>;
	type?: string;
	from?: { url: URL } | null;
	to?: { url: URL } | null;
}
```

- [ ] **Step 4: Write the implementation**

Create `src/lib/kit/view-transition-name.ts`:

```ts
import type { Attachment } from 'svelte/attachments';
import type { Navigation } from './types.js';

export interface ViewTransitionNameOptions {
	/** Only claim the name for navigations this returns true for. */
	when?: (navigation: Navigation) => boolean;
	/** Claim inside the update callback instead, for an element that mounts during the transition. */
	onArrival?: boolean;
}

type Phase = 'capture' | 'arrival';

interface Claim {
	element: HTMLElement;
	name: string;
	options: ViewTransitionNameOptions;
	named: boolean;
}

const claims = new Set<Claim>();
let current: { navigation: Navigation; phase: Phase } | null = null;

function wanted(claim: Claim, phase: Phase, navigation: Navigation): boolean {
	if ((claim.options.onArrival ? 'arrival' : 'capture') !== phase) return false;
	return claim.options.when?.(navigation) ?? true;
}

function apply(claim: Claim) {
	claim.element.style.viewTransitionName = claim.name;
	claim.named = true;
}

function release(claim: Claim) {
	if (!claim.named) return;
	claim.element.style.viewTransitionName = '';
	claim.named = false;
}

/** @internal — driven by the navigation registration. */
export function beginPhase(navigation: Navigation, phase: Phase) {
	current = { navigation, phase };
	for (const claim of claims) if (wanted(claim, phase, navigation)) apply(claim);
}

/** @internal */
export function endTransition() {
	current = null;
	for (const claim of claims) release(claim);
}

function wire(
	element: HTMLElement,
	name: string,
	options: ViewTransitionNameOptions = {}
): () => void {
	const claim: Claim = { element, name, options, named: false };
	claims.add(claim);
	// An element mounting mid-transition registers after its phase already swept.
	if (current && wanted(claim, current.phase, current.navigation)) apply(claim);
	return () => {
		release(claim);
		claims.delete(claim);
	};
}

export function viewTransitionName(
	name: string,
	options?: ViewTransitionNameOptions
): Attachment<HTMLElement>;
export function viewTransitionName(
	element: HTMLElement,
	name: string,
	options?: ViewTransitionNameOptions
): () => void;
export function viewTransitionName(
	first: string | HTMLElement,
	second?: string | ViewTransitionNameOptions,
	third?: ViewTransitionNameOptions
): Attachment<HTMLElement> | (() => void) {
	if (typeof Element !== 'undefined' && first instanceof Element) {
		return wire(first as HTMLElement, second as string, third);
	}
	const options = second as ViewTransitionNameOptions | undefined;
	return (element) => wire(element, first as string, options);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:unit -- --run src/lib/kit/view-transition-name.svelte.test.ts`

Expected: PASS — 17 tests (7 behaviours × 2 forms, plus 3 mid-transition cases).

- [ ] **Step 6: Type-check, lint and format**

Run: `npm run format && npm run check && npm run lint`

Expected: 0 errors. The `as () => void` cast on the attachment form is deliberate: `Attachment<HTMLElement>` returns `void | (() => void)`, and the table needs one signature to drive both overloads.

- [ ] **Step 7: Commit**

```bash
jj commit -m "feat(kit): viewTransitionName attachment with a claim registry"
```

---

### Task 4: The direction predicate

Small and standalone, so it lands before the registration that consumes it.

**Files:**

- Create: `src/lib/kit/view-transition.ts` (predicate only; the registration is Task 5)
- Test: `src/lib/kit/view-transition.svelte.test.ts` (predicate tests only)

- [ ] **Step 1: Write the failing test**

Create `src/lib/kit/view-transition.svelte.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { isRetreat, retreat } from './view-transition.js';
import type { Navigation } from './types.js';

const nav = (overrides: Partial<Navigation> = {}): Navigation => ({
	complete: Promise.resolve(),
	from: { url: new URL('https://x.test/a') },
	to: { url: new URL('https://x.test/b') },
	...overrides
});

afterEach(() => {
	retreat(() => false);
});

describe('retreat', () => {
	it('defaults to forward', () => {
		expect(isRetreat(nav())).toBe(false);
	});

	it('consults the registered predicate', () => {
		retreat((n) => n.to?.url.pathname === '/b');
		expect(isRetreat(nav())).toBe(true);
	});

	it('treats a popstate as a retreat whatever the predicate says', () => {
		retreat(() => false);
		expect(isRetreat(nav({ type: 'popstate' }))).toBe(true);
	});

	it('replaces the predicate rather than stacking them', () => {
		retreat(() => true);
		retreat(() => false);
		expect(isRetreat(nav())).toBe(false);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- --run src/lib/kit/view-transition.svelte.test.ts`

Expected: FAIL — `Failed to resolve import "./view-transition.js"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/kit/view-transition.ts`:

```ts
import type { Navigation } from './types.js';

let predicate: (navigation: Navigation) => boolean = () => false;

/**
 * A predicate, never a flag: Kit skips `beforeNavigate` for a navigation begun while another is in
 * flight, so a flag set at click time can be stranded and reverse a later navigation.
 */
export function retreat(next: (navigation: Navigation) => boolean) {
	predicate = next;
}

/** @internal */
export function isRetreat(navigation: Navigation): boolean {
	return navigation.type === 'popstate' || predicate(navigation);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- --run src/lib/kit/view-transition.svelte.test.ts`

Expected: PASS — 4 tests.

- [ ] **Step 5: Type-check and format**

Run: `npm run format && npm run check`

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
jj commit -m "feat(kit): retreat direction predicate"
```

---

### Task 5: The navigation registration

This is the seam: it wires the primitive, the direction predicate, the `forward`/`retreat` attribute vocabulary and the claim registry into one `onNavigate` handler.

**Files:**

- Modify: `src/lib/kit/view-transition.ts` (add the registration to the predicate from Task 4)
- Test: `src/lib/kit/view-transition.svelte.test.ts` (append to the predicate tests)

- [ ] **Step 1: Write the failing test**

Append to `src/lib/kit/view-transition.svelte.test.ts`. First edit the two existing import lines at the top of the file so they read:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isRetreat, navigationTransition, retreat } from './view-transition.js';
import { viewTransitionName } from './view-transition-name.js';
```

Then append:

```ts
const root = () => document.documentElement;
const state = () => root().dataset.viewTransition;

/** Hand-driven stand-in: `finished` stays pending until `finish()`, so cleanup is observable. */
function fakeStart(updateDone: Promise<void> = Promise.resolve()) {
	const skipTransition = vi.fn();
	let finish!: () => void;
	const finished = new Promise<void>((resolve) => (finish = resolve));
	const start = vi.fn((update: () => void | Promise<void>) => {
		void Promise.resolve(update()).catch(() => {});
		return {
			ready: updateDone,
			updateCallbackDone: updateDone,
			finished,
			skipTransition
		} as unknown as ViewTransition;
	});
	return { start, skipTransition, finish };
}

describe('navigationTransition — the attribute', () => {
	afterEach(() => {
		delete root().dataset.viewTransition;
	});

	it('writes forward on an ordinary navigation', () => {
		const { start } = fakeStart();
		void navigationTransition({ start })(nav());
		expect(state()).toBe('forward');
	});

	it('writes retreat when the predicate says so', () => {
		retreat(() => true);
		const { start } = fakeStart();
		void navigationTransition({ start })(nav());
		expect(state()).toBe('retreat');
	});

	it('writes retreat on a popstate', () => {
		const { start } = fakeStart();
		void navigationTransition({ start })(nav({ type: 'popstate' }));
		expect(state()).toBe('retreat');
	});

	it('clears the attribute and calls onSettle once finished settles', async () => {
		const { start, finish } = fakeStart();
		const onSettle = vi.fn();
		void navigationTransition({ start, onSettle })(nav());
		finish();
		await vi.waitFor(() => expect(onSettle).toHaveBeenCalledTimes(1));
		expect(state()).toBeUndefined();
	});

	it('hands onStart the navigation', () => {
		const { start } = fakeStart();
		const onStart = vi.fn();
		const navigation = nav();
		void navigationTransition({ start, onStart })(navigation);
		expect(onStart).toHaveBeenCalledWith(navigation);
	});
});

describe('navigationTransition — the ordering guarantee', () => {
	it('resolves before navigation.complete settles', async () => {
		const { start } = fakeStart();
		// Never settles: if the handler awaited it, Kit and the browser would wait on each other forever.
		const navigation = nav({ complete: new Promise<void>(() => {}) });
		await navigationTransition({ start })(navigation);
		expect(state()).toBe('forward');
		delete root().dataset.viewTransition;
	});

	it('resolves under reduced motion without starting a transition', async () => {
		const { start } = fakeStart();
		await navigationTransition({ start, reducedMotion: () => true })(nav());
		expect(start).not.toHaveBeenCalled();
		expect(state()).toBeUndefined();
	});
});

describe('navigationTransition — naming integration', () => {
	afterEach(() => {
		delete root().dataset.viewTransition;
		document.body.replaceChildren();
	});

	it('names a claimed element for the transition and clears it after', async () => {
		const node = document.createElement('div');
		document.body.appendChild(node);
		const cleanup = viewTransitionName(node, 'hero');
		const { start, finish } = fakeStart();
		void navigationTransition({ start })(nav());
		expect(node.style.viewTransitionName).toBe('hero');
		finish();
		await vi.waitFor(() => expect(node.style.viewTransitionName).toBe(''));
		cleanup();
	});

	it('names an onArrival element only once the DOM has committed', async () => {
		const node = document.createElement('div');
		document.body.appendChild(node);
		const cleanup = viewTransitionName(node, 'hero', { onArrival: true });
		let commit!: () => void;
		const complete = new Promise<void>((resolve) => (commit = resolve));
		const { start } = fakeStart();
		void navigationTransition({ start })(nav({ complete }));
		expect(node.style.viewTransitionName).toBe('');
		commit();
		await vi.waitFor(() => expect(node.style.viewTransitionName).toBe('hero'));
		cleanup();
	});

	it('leaves claims alone when reduced motion skips the transition', async () => {
		const node = document.createElement('div');
		document.body.appendChild(node);
		const cleanup = viewTransitionName(node, 'hero', { onArrival: true });
		const { start } = fakeStart();
		await navigationTransition({ start, reducedMotion: () => true })(nav());
		await new Promise((r) => setTimeout(r));
		expect(node.style.viewTransitionName).toBe('');
		cleanup();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- --run src/lib/kit/view-transition.svelte.test.ts`

Expected: FAIL — `"navigationTransition" is not exported by "src/lib/kit/view-transition.ts"`.

- [ ] **Step 3: Write the implementation**

Replace `src/lib/kit/view-transition.ts` in full:

```ts
import { onNavigate } from '$app/navigation';
import {
	runViewTransition,
	viewTransition as directTransition,
	type ViewTransitionOptions
} from '../view-transition.js';
import { beginPhase, endTransition } from './view-transition-name.js';
import type { Navigation } from './types.js';

export interface NavigationTransitionOptions extends Omit<
	ViewTransitionOptions,
	'retreat' | 'onStart'
> {
	onStart?: (navigation: Navigation) => void;
}

let predicate: (navigation: Navigation) => boolean = () => false;

/**
 * A predicate, never a flag: Kit skips `beforeNavigate` for a navigation begun while another is in
 * flight, so a flag set at click time can be stranded and reverse a later navigation.
 */
export function retreat(next: (navigation: Navigation) => boolean) {
	predicate = next;
}

/** @internal */
export function isRetreat(navigation: Navigation): boolean {
	return navigation.type === 'popstate' || predicate(navigation);
}

/** @internal — the handler `viewTransition()` registers, exported so it is testable without a component. */
export function navigationTransition({
	onStart,
	onSettle,
	...rest
}: NavigationTransitionOptions = {}) {
	return (navigation: Navigation): Promise<void> =>
		new Promise<void>((resolve) => {
			let transitioning = false;
			runViewTransition(
				async () => {
					// resolve() BEFORE awaiting breaks a mutual wait: Kit holds the navigation until this
					// promise settles, the browser holds the snapshot until the callback settles.
					resolve();
					await navigation.complete;
					if (transitioning) beginPhase(navigation, 'arrival');
				},
				{
					...rest,
					state: isRetreat(navigation) ? 'retreat' : 'forward',
					onStart: () => {
						transitioning = true;
						beginPhase(navigation, 'capture');
						onStart?.(navigation);
					},
					onSettle: () => {
						transitioning = false;
						endTransition();
						onSettle?.();
					}
				}
			);
		});
}

export function viewTransition(options?: NavigationTransitionOptions): void;
export function viewTransition(
	update: () => void | Promise<void>,
	options?: ViewTransitionOptions
): ViewTransition | undefined;
export function viewTransition(
	first?: NavigationTransitionOptions | (() => void | Promise<void>),
	second?: ViewTransitionOptions
): ViewTransition | undefined | void {
	if (typeof first === 'function') return directTransition(first, second);
	onNavigate(navigationTransition(first));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- --run src/lib/kit/view-transition.svelte.test.ts`

Expected: PASS — 14 tests.

- [ ] **Step 5: Run the whole suite**

Run: `npm run test:unit -- --run`

Expected: PASS — every existing test plus the new ones. `expect.requireAssertions` is on, so every test needs at least one `expect`; the ordering-guarantee test would also hang rather than fail if the handler ever started awaiting `navigation.complete`, which is the point of it.

- [ ] **Step 6: Type-check, lint and format**

Run: `npm run format && npm run check && npm run lint`

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
jj commit -m "feat(kit): onNavigate registration wiring direction, attribute and claims"
```

---

### Task 6: Barrels and package exports

**Files:**

- Create: `src/lib/kit/index.ts`
- Modify: `src/lib/index.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the /kit barrel**

Create `src/lib/kit/index.ts`:

```ts
export { retreat, viewTransition } from './view-transition.js';
export type { NavigationTransitionOptions } from './view-transition.js';
export { viewTransitionName } from './view-transition-name.js';
export type { ViewTransitionNameOptions } from './view-transition-name.js';
export { samePath } from './same-path.js';
export type { Navigation } from './types.js';
```

- [ ] **Step 2: Extend the root barrel**

Replace `src/lib/index.ts` in full:

```ts
export { copy, copyText } from './copy.js';
export type { CopyOptions, CopyText } from './copy.js';
export { FiniteStateMachine } from './finite-state-machine.svelte.js';
export type {
	Action,
	ActionMeta,
	EnterMeta,
	EventMap,
	ExitMeta,
	StateHandler,
	Transition
} from './finite-state-machine.svelte.js';
export { viewTransition } from './view-transition.js';
export type { StartViewTransition, ViewTransitionOptions } from './view-transition.js';
```

Note what is deliberately absent: `runViewTransition`, `RunOptions`, `beginPhase`, `endTransition`, `isRetreat` and `navigationTransition` are internal. The `exports` map blocks deep imports, so they stay unreachable from outside the package.

- [ ] **Step 3: Declare the /kit entry point**

In `package.json`, replace the `"exports"` block and the `"peerDependencies"` block:

```json
	"exports": {
		".": {
			"types": "./dist/index.d.ts",
			"svelte": "./dist/index.js"
		},
		"./kit": {
			"types": "./dist/kit/index.d.ts",
			"svelte": "./dist/kit/index.js"
		}
	},
	"peerDependencies": {
		"svelte": "^5.40.0",
		"@sveltejs/kit": "^2.0.0"
	},
	"peerDependenciesMeta": {
		"@sveltejs/kit": {
			"optional": true
		}
	},
```

`@sveltejs/kit` stays in `devDependencies` as well — that is correct and normal for a Kit library: dev for building and testing here, optional peer for consumers.

- [ ] **Step 4: Build and check the published shape**

Run: `npm run build`

Expected: `vite build` succeeds, `svelte-package` writes `dist/`, `publint` reports no problems.

Then verify the tier landed where the exports map points:

Run: `ls dist/kit && head -1 dist/kit/view-transition.js`

Expected: `index.js`, `same-path.js`, `types.js`, `view-transition.js`, `view-transition-name.js` plus their `.d.ts` files, and the first line is `import { onNavigate } from '$app/navigation';` — the virtual module left unresolved, exactly as intended.

- [ ] **Step 5: Type-check, lint and format**

Run: `npm run format && npm run check && npm run lint`

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
jj commit -m "feat: export view transitions from the root barrel and a kenspeckle/kit entry"
```

---

### Task 7: Docs registry

The registry cannot describe a wiring function today: `Utility.type` is `UtilityType = 'class' | 'value' | 'attachment'`, while `'function'` exists only in `TagType` for the roadmap. `docs.css` already carries a `function` swatch (lines 257–258), so this is a types-and-data change only.

**Files:**

- Modify: `src/routes/docs/utilities.ts`
- Modify: `src/routes/docs/roadmap.ts`

- [ ] **Step 1: Widen the type and add the rows**

Replace `src/routes/docs/utilities.ts` in full:

```ts
import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';

export type UtilityType = 'class' | 'value' | 'attachment' | 'function';

export type TagType = UtilityType;

export interface Utility {
	slug: string;
	href: ResolvedPathname;
	label: string;
	type: UtilityType;
	blurb: string;
}

export const tagLabels: Record<TagType, string> = {
	class: 'class',
	value: 'value',
	attachment: 'attachment',
	function: 'function'
};

export const utilityTypes: UtilityType[] = ['class', 'value', 'attachment', 'function'];

export const utilities: Utility[] = [
	{
		slug: 'finite-state-machine',
		href: resolve('/docs/finite-state-machine'),
		label: 'FiniteStateMachine',
		type: 'class',
		blurb: 'fully typed FSM with reactive context'
	},
	{
		slug: 'copy',
		href: resolve('/docs/copy'),
		label: 'copy',
		type: 'attachment',
		blurb: 'clipboard attachment + imperative helper'
	},
	{
		slug: 'view-transition',
		href: resolve('/docs/view-transition'),
		label: 'viewTransition',
		type: 'function',
		blurb: 'view transitions, with a SvelteKit navigation tier'
	},
	{
		slug: 'view-transition-name',
		href: resolve('/docs/view-transition-name'),
		label: 'viewTransitionName',
		type: 'attachment',
		blurb: 'name an element for the transition it takes part in'
	}
];

export function bySlug(slug: string): Utility | undefined {
	return utilities.find((u) => u.slug === slug);
}
```

`utilityTypes` drives both the sidebar filter chips and the set of types shown by default — omit `'function'` there and `viewTransition` would never appear in the nav.

- [ ] **Step 2: Add the shipped roadmap entries**

In `src/routes/docs/roadmap.ts`, replace the `items` array of the `shipped` group:

```ts
items: [
	{ name: 'FiniteStateMachine', type: 'class', blurb: 'typed FSM with reactive context' },
	{ name: 'copy', type: 'attachment', blurb: 'clipboard attachment + imperative helper' },
	{
		name: 'viewTransition',
		type: 'function',
		blurb: 'view transitions, with a SvelteKit navigation tier'
	},
	{
		name: 'viewTransitionName',
		type: 'attachment',
		blurb: 'name an element for the transition it takes part in'
	},
	{ name: 'retreat', type: 'function', blurb: 'which navigations animate in reverse' },
	{ name: 'samePath', type: 'function', blurb: 'trailing-slash-tolerant path comparison' }
];
```

`retreat` and `samePath` get roadmap rows but no registry rows — they are sections of the `viewTransition` page, meaningless on their own.

- [ ] **Step 3: Type-check**

Run: `npm run check`

Expected: 0 errors. The doc pages the two new registry rows point at do not exist yet, so `resolve()` will fail to type-check against `ResolvedPathname` until Task 8 creates the routes. If `svelte-check` reports `Argument of type '"/docs/view-transition"' is not assignable`, that is this — do Task 8's Step 1 (create both `+page.svx` files, even empty) and re-run `npm run check` before continuing.

- [ ] **Step 4: Format and commit**

```bash
npm run format
jj commit -m "docs: widen the utility type to cover functions, register view transitions"
```

---

### Task 8: Documentation pages

Two `.svx` pages. **Gotcha that costs a runtime 500:** never put a raw `<script>` or `<style>` tag inside a ` ```svelte ` fence in a `.svx` file — the mdsvex→Kit preprocess pipeline mishandles it and the page 500s at SSR while compile and `svelte-check` both pass. Show script logic in prose or a ` ```ts ` fence; template-only markup in a ` ```svelte ` fence is fine.

Code examples: 2-space indent, comments on their own line, never trailing.

**Files:**

- Create: `src/routes/docs/view-transition/+page.svx`
- Create: `src/routes/docs/view-transition-name/+page.svx`

- [ ] **Step 1: Write the viewTransition page**

Create `src/routes/docs/view-transition/+page.svx`:

````svx
<script>
	import PageHeading from '../PageHeading.svelte';
</script>

<PageHeading slug="view-transition" />

Run a DOM update inside a CSS view transition. `viewTransition` handles the parts every hand-rolled version gets wrong: a deadline so a slow update cannot read as a hang, a reduced-motion bail that skips the transition entirely, and handlers on all three transition promises so a skip never logs an `AbortError`.

```ts
import { viewTransition } from 'kenspeckle';
```

SvelteKit apps import from the `/kit` entry point instead, which adds navigation:

```ts
import { viewTransition, retreat, samePath } from 'kenspeckle/kit';
```

## Around a DOM update

Pass the update. It runs inside the transition, and the browser animates from the old frame to the new one:

```ts
viewTransition(() => {
  step += 1;
});
```

The update may be async — await whatever has to land before the new frame is captured. In a Svelte 5 app with async components, that means `settled()`:

```ts
import { settled } from 'svelte';

viewTransition(async () => {
  step += 1;
  await settled();
});
```

If the browser lacks the API, or the user prefers reduced motion, the update still runs — it just runs without a transition. That is a bail, not a fallback: a view transition suspends rendering for the whole update, so animating nothing is not the same as not transitioning.

## On navigation

From `kenspeckle/kit`, call it with no update at all. It registers an `onNavigate` handler, so it belongs in a root layout's script — once, at init:

```ts
import { viewTransition } from 'kenspeckle/kit';

viewTransition();
```

Every client-side navigation now runs inside a transition. Nothing else is required.

## Direction

`retreat` registers a predicate that decides which navigations animate in reverse. It is consulted per navigation, at transition time:

```ts
import { retreat, samePath } from 'kenspeckle/kit';

retreat((navigation) => samePath(navigation.to, previousStep));
```

A `popstate` — the browser back button — is always a retreat, whatever the predicate returns.

Register a predicate, never set a flag at click time. SvelteKit skips `beforeNavigate` for a navigation begun while another is still in flight, so a flag set by one click can be left behind and reverse a later, unrelated navigation. There is no boolean that closes this.

`samePath` compares a navigation target against a configured path, tolerating a trailing-slash difference. Configured paths often keep the slash; Kit strips it from navigation targets, so a bare `===` matches nothing:

```ts
samePath(navigation.to, '/profile/gender/');
```

## The attribute

For the life of a transition, the document element carries one attribute:

```
data-view-transition="forward" | "retreat" | "step-forward" | "step-retreat"
```

It is absent when idle. `forward` and `retreat` are navigations; the `step-` pair is a direct `viewTransition(update)` call — a step within the same route, whose duration and easing usually differ. Author keyframes against it:

```css
[data-view-transition='retreat']::view-transition-old(profile-content) {
  animation: slide-out-right 200ms both;
}
```

Pass `retreat: true` to a direct call to get `step-retreat`:

```ts
viewTransition(() => (step -= 1), { retreat: true });
```

## Controlling the root snapshot

By default the browser names the whole document `root` and crossfades it. There are three positions, and a consumer hitting a duration surprise is usually in the first without knowing it:

1. Leave it alone — the UA crossfade. Nothing to write.
2. `::view-transition-group(root) { animation-duration: 0s }` — still captured, not animated.
3. `:root { view-transition-name: none }` — not captured at all, so only elements you name animate.

```css
:root {
  view-transition-name: none;
}
```

2 and 3 look identical when the unnamed remainder of the page is the same across screens. Prefer 3 for two reasons: it avoids a full-viewport snapshot pair on every navigation, and it takes the root out of the timing. The UA default is `0.25s`, so while root animates it governs the transition's length — which means `finished`, and therefore the attribute removal and `onSettle`, fire later than the visible motion ends.

## Options

```ts
viewTransition(update, {
  // reverse direction — writes step-retreat
  retreat: false,
  // ms before the transition is skipped; past this a crossfade reads as a hang
  deadline: 600,
  // runs synchronously before the old snapshot is captured
  onStart: () => {},
  // runs once the transition settles, resolved or rejected
  onSettle: () => {},
  // return true to skip the transition entirely
  reducedMotion: () => prefersReducedMotion.current
});
```

The navigation form takes the same options except `retreat` — that is what the predicate is for — and its `onStart` receives the navigation:

```ts
viewTransition({
  onStart: (navigation) => hideCloak(navigation),
  onSettle: () => showCloak()
});
```
````

- [ ] **Step 2: Write the viewTransitionName page**

Create `src/routes/docs/view-transition-name/+page.svx`:

````svx
<script>
	import PageHeading from '../PageHeading.svelte';
</script>

<PageHeading slug="view-transition-name" />

Name an element so it morphs across a navigation instead of crossfading with the page. `viewTransitionName` names it just before the old frame is captured and clears the name once the transition settles — nothing is named while idle, which is what keeps a name available to whichever element should claim it next.

```ts
import { viewTransitionName } from 'kenspeckle/kit';
```

It needs `viewTransition()` registered in your root layout; the navigation is what drives it.

## As an attachment

```svelte
<img src={photo.url} alt="" {@attach viewTransitionName('hero')} />
```

Attach the same name to an element on the destination screen and the two morph into each other.

## Imperative form

Pass an element first to wire it directly. It returns a cleanup function:

```ts
const cleanup = viewTransitionName(node, 'hero');

// later
cleanup();
```

Element first → imperative helper. Name only → attachment. The presence of the element picks the mode.

## Claiming a name from a list

Only one element may carry a given name during a transition. Twenty thumbnails all named `hero` abort the transition outright — so a list needs a gate. `when` receives the navigation and decides whether this element is the one:

```svelte
{#each photos as photo (photo.id)}
  <a
    href={resolve(`/photo/${photo.id}`)}
    {@attach viewTransitionName('hero', {
      when: (navigation) => navigation.to?.url.pathname === `/photo/${photo.id}`
    })}
  >
    <img src={photo.thumb} alt="" />
  </a>
{/each}
```

Each attachment closes over its own item, so only the one being navigated to claims the name. This is why static CSS cannot express the canonical morph: it has no navigation to gate on.

## Elements that arrive during the transition

The default moment for naming is before the old frame is captured, which only reaches elements already on the outgoing page. The destination half of a morph does not exist yet at that point — it mounts *during* the transition, after the DOM commits and before the new frame is captured. That window is the only one it can join, and `onArrival` is how you ask for it:

```svelte
<img src={photo.url} alt="" {@attach viewTransitionName('hero', { onArrival: true })} />
```

Use it on the incoming element, the plain form on the outgoing one. An element present on both sides needs neither — the default moment already covers it.

## Scope

This is navigation-scoped: it participates in transitions started by `viewTransition()`, not in a direct `viewTransition(update)` call within a route. An element that should animate on a same-route step wants a plain CSS `view-transition-name` instead, since nothing has to arbitrate who claims it.

## Options

```ts
viewTransitionName('hero', {
  // claim the name only for navigations this returns true for
  when: (navigation) => true,
  // claim inside the update callback, for an element that mounts during the transition
  onArrival: false
});
```
````

- [ ] **Step 3: Verify the pages render**

Ask the user to start the dev server — do not start one yourself. Once running, load `/docs/view-transition` and `/docs/view-transition-name` and confirm both render with a heading and its type tag, and that the sidebar shows a `function` filter chip.

If a page returns a 500 at SSR while `npm run check` passes, it is the `.svx` fence gotcha above — find the raw `<script>` or `<style>` tag inside a ` ```svelte ` fence and rewrite that example.

- [ ] **Step 4: Type-check, lint and format**

Run: `npm run format && npm run check && npm run lint`

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
jj commit -m "docs: viewTransition and viewTransitionName pages"
```

---

### Task 9: Full gate pass

**Files:** none — verification only.

- [ ] **Step 1: Run the unit suite**

Run: `npm run test:unit -- --run`

Expected: every test passes across both the client and server projects. Report the actual counts.

- [ ] **Step 2: Type-check and lint**

Run: `npm run check && npm run lint`

Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Build and validate the package**

Run: `npm run build`

Expected: `publint` reports no problems, and `dist/` contains both entry points.

- [ ] **Step 4: Confirm the internal surface stayed internal**

Run: `grep -n "runViewTransition\|beginPhase\|endTransition\|isRetreat\|navigationTransition" src/lib/index.ts src/lib/kit/index.ts`

Expected: no matches. Every one of those is internal; the `exports` map is what keeps them unreachable, and the barrels must not undo it.

- [ ] **Step 5: Commit anything the gates changed**

If formatting or a fix was needed:

```bash
jj commit -m "chore: gate fixes for view transitions"
```

Otherwise `jj st` shows a clean working copy and there is nothing to commit.

---

## Out of scope for this plan

The spec's sequencing continues past this package. These are separate efforts, each with its own plan, and none of them belong in a kenspeckle commit:

- **Link into cq locally** (`"kenspeckle": "file:../../kenspeckle"`), migrate call sites, run gates. **Do not deploy cq while linked** — `file:` resolves on one machine and Workers Builds has no sibling directory, so any deploy from a commit carrying that dep fails at `npm ci`. Keep that change uncommitted or off a deploying branch.
- **A manual pass over the imperative form**, the one shape with no consumer in either app.
- **Publish `0.1.0`**, then switch cq to `^0.1.0` and commit that. Re-emit `package-lock.json` with npm before committing — `nub add`/`nub remove` corrupts it on the round trip and Workers Builds runs `npm ci`.
- **Migrate blp** against the published version: replace `view-transition-deadline.ts`, keep the Cloak `onStart`/`onSettle` wiring verbatim, gain the reduced-motion bail it lacks.

## Facts worth not re-deriving

Carried from the spec so an implementer does not rediscover them the hard way:

- **`resolve()` before `await`** breaks a mutual wait: Kit holds the navigation until the returned promise settles, and the browser holds the snapshot until the update callback settles. Source is Geoff Rich, _Unlocking view transitions in SvelteKit 1.24_ (svelte.dev blog, 2023-08-31) — not the API reference, which ships no snippet.
- **Clear the deadline on `updateCallbackDone`, never `finished`.** Suspension lifts with the update callback; left on `finished` the timer stays armed through the animation and snaps a running morph to its end state on an ordinary slow-ish navigation.
- **`goto` pushes or replaces, never pops.** Kit exposes no `back()`, and `NavigationTarget` is `{ params, route, url }` — so `goto`'s `state` option cannot carry a direction hint readable at `onNavigate`. `history.back()` is the only pop and it surrenders the destination. This is why direction is a predicate.
- **`navigation.complete` rejects on abort and cancel.** Hence `.finally`, not `.then`, for cleanup.
- **`ready` is what a skip rejects.** `finished` mirrors `updateCallbackDone` and fulfils.
- **The supersede race on attribute cleanup is unreachable.** The `::view-transition` pseudo layer covers the viewport and intercepts pointer events, so no user can start a second navigation mid-animation. Verified in Chromium and with a Playwright click that failed "`<html>` intercepts pointer events". Do not add a transition-ownership token.
