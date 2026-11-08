<script lang="ts">
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => document.documentElement.toggleAttribute('hydrated', true));
</script>

{@render children()}
