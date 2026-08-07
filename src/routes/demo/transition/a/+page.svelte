<script lang="ts">
	import { resolve } from '$app/paths';
	import { viewTransitionName } from '$lib/kit/view-transition-name.js';

	let node = $state<HTMLElement>();

	// The imperative form, wired the way a consumer without an attachment slot would: element first,
	// cleanup returned. The attachment form is exercised on the sibling page.
	$effect(() => {
		if (!node) return;
		return viewTransitionName(node, 'hero');
	});
</script>

<h1>A</h1>
<div class="hero" bind:this={node}>A</div>
<a href={resolve('/demo/transition/b')}>to b</a>
