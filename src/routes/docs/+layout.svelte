<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { copy } from '$lib/copy.js';
	import './docs.css';

	let { children } = $props();

	const items = [
		{ href: resolve('/docs'), label: 'Introduction' },
		{ href: resolve('/docs/finite-state-machine'), label: 'FiniteStateMachine' }
	];

	const wideQuery = '(min-width: 48rem)';

	let navOpen = $state(false);
	let prose = $state<HTMLElement>();

	$effect(() => {
		const wide = window.matchMedia(wideQuery);
		const apply = () => (navOpen = wide.matches);
		apply();
		wide.addEventListener('change', apply);
		return () => wide.removeEventListener('change', apply);
	});

	function decorate() {
		const root = prose;
		if (!root) return;
		for (const pre of Array.from(root.querySelectorAll('pre'))) {
			if (pre.dataset.copy) continue;
			pre.dataset.copy = 'ready';
			const source = pre.querySelector('code')?.textContent ?? pre.textContent ?? '';
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'copy-button';
			button.textContent = 'Copy';
			button.setAttribute('aria-label', 'Copy code');
			pre.appendChild(button);
			copy(button, {
				text: source,
				onCopy: () => {
					button.textContent = 'Copied';
					button.dataset.copied = 'true';
					setTimeout(() => {
						button.textContent = 'Copy';
						delete button.dataset.copied;
					}, 1600);
				}
			});
		}
	}

	afterNavigate(() => {
		decorate();
		if (!window.matchMedia(wideQuery).matches) navOpen = false;
	});
</script>

<header class="[ site-header ] [ cluster ]">
	<a class="wordmark" href={resolve('/')}
		>ken<span class="dot">·</span>speck<span class="dot">·</span>le</a
	>
	<p class="gloss">adj. — easily recognised; familiar at sight</p>
</header>

<div class="docs-shell">
	<details class="doc-nav" bind:open={navOpen}>
		<summary>Contents</summary>
		<nav class="nav-body" aria-label="Docs">
			<ul>
				{#each items as item (item.href)}
					<li>
						<a href={item.href} aria-current={page.url.pathname === item.href ? 'page' : undefined}>
							{item.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	</details>

	<main class="content">
		<article class="[ prose ] [ flow ]" bind:this={prose}>
			{@render children()}
		</article>
	</main>
</div>
