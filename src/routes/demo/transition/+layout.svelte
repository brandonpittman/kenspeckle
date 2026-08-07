<script lang="ts">
	import { viewTransition } from '$lib/kit/view-transition.js';

	let { children } = $props();

	const hero = () =>
		document.querySelector<HTMLElement>('.hero')?.style.viewTransitionName ?? '(gone)';

	// Probes for the e2e: the only place that can observe naming mid-transition from outside.
	viewTransition({
		onStart: () => {
			window.__vtStart = hero();
			window.__vtAttr = document.documentElement.dataset.viewTransition ?? '';
		},
		onSettle: () => {
			window.__vtSettle = hero();
			window.__vtSettleAttr = document.documentElement.dataset.viewTransition ?? '(absent)';
		}
	});
</script>

{@render children()}

<style>
	:global(.hero) {
		display: grid;
		place-items: center;
		inline-size: 8rem;
		block-size: 8rem;
		background: rebeccapurple;
		color: white;
		font-size: 2rem;
	}
</style>
