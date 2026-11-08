<script lang="ts">
	import type { Countdown } from './countdown.svelte.js';

	let { countdown, never }: { countdown: Countdown; never: Promise<string> } = $props();
</script>

<svelte:boundary>
	<p>{countdown.current}</p>
	{#if never}
		<p>{await never}</p>
	{/if}

	{#snippet pending()}
		<p>Loading</p>
	{/snippet}
</svelte:boundary>
<p data-testid="outside">{countdown.current}</p>
