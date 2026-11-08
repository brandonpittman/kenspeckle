<script lang="ts">
	import { PersistedState } from '$lib/persisted-state.svelte.js';

	const count = new PersistedState('demo-count', 0);
</script>

<h1>PersistedState</h1>

<output>Count: {count.current}</output>
<button type="button" onclick={() => (count.current += 1)}>Increment</button>
