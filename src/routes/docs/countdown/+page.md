<script>
	import PageHeading from '../PageHeading.svelte';
</script>

<PageHeading slug="countdown" />

The milliseconds left until a deadline, read through `current` and ticking once a second.

```ts
import { Countdown } from 'kenspeckle';
```

## Reading it

Pass a getter that returns the deadline as a timestamp in milliseconds. `current` is the time left, clamped at `0`:

```ts
const session = new Countdown(() => data.expiresAt);
```

```svelte
<p>{Math.ceil((session.current ?? 0) / 1000)}s left</p>
```

Ticks land on whole seconds of time remaining, so a display that rounds up with `Math.ceil` flips on time and the last tick lands exactly on the deadline. Read outside an effect, `current` is computed fresh on every read.

The deadline is a getter, so it can change: return a later timestamp and the countdown follows it from the next read. Return `$state`, a prop or `data` from it, so every reader reruns when it changes. A deadline held in a plain variable is noticed only by reads that happen anyway, so one reader can move on while another keeps the old value. While the getter returns `undefined`, `current` is `undefined`. A `NaN` deadline, such as one parsed from a bad date, reads as `0`.

The timer runs only while an effect or `$derived` reads `current`, and stops when the last one is destroyed. A browser may throttle timers in a tab hidden for a while, Chrome to once a minute after five minutes, so expiry can arrive up to about a minute late there.

## Acting on it

There is no expiry callback. Respond to the value being what it is, in an effect. A session that warns two minutes before it ends and leaves when it does, written in a component script:

```ts
const session = new Countdown(() => data.expiresAt);
const warning = $derived(session.current !== undefined && session.current <= 2 * 60 * 1000);

$effect(() => {
  if (session.current === 0) goto(resolve('/signed-out'));
});
```

## On the server

There is no clock to follow on the server, so `current` is `undefined` there. Test `current === 0` for expiry rather than `!current`, so server rendering never counts as expired.
