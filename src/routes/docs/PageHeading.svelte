<script lang="ts">
	import { bySlug } from './utilities.js';
	import TypeTag from './TypeTag.svelte';

	let { slug }: { slug: string } = $props();

	const util = $derived(bySlug(slug));
</script>

{#if util}
	<h1>{util.label} <TypeTag type={util.type} /></h1>
{/if}
