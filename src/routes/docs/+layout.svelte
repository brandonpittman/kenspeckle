<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { SvelteSet } from 'svelte/reactivity';
	import { copy } from '$lib/copy.js';
	import { tagLabels, utilities, utilityTypes, type UtilityType } from './utilities.js';
	import TypeTag from './TypeTag.svelte';
	import './docs.css';

	let { children } = $props();

	const wideQuery = '(min-width: 48rem)';

	let navOpen = $state(false);
	let prose = $state<HTMLElement>();
	const active = new SvelteSet<UtilityType>(utilityTypes);

	const shown = $derived(utilities.filter((u) => active.has(u.type)));

	function toggle(type: UtilityType) {
		if (active.has(type)) active.delete(type);
		else active.add(type);
	}

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
			<a
				href={resolve('/docs')}
				aria-current={page.url.pathname === resolve('/docs') ? 'page' : undefined}
			>
				Introduction
			</a>

			<div class="nav-filter" role="group" aria-label="Filter by type">
				{#each utilityTypes as type (type)}
					<button
						type="button"
						class="filter-chip"
						data-type={type}
						aria-pressed={active.has(type)}
						onclick={() => toggle(type)}
					>
						{tagLabels[type]}
					</button>
				{/each}
			</div>

			{#if shown.length}
				<ul>
					{#each shown as util (util.slug)}
						<li>
							<a
								href={util.href}
								aria-current={page.url.pathname === util.href ? 'page' : undefined}
							>
								{util.label}
								<TypeTag type={util.type} />
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="nav-empty">No utilities match.</p>
			{/if}

			<a
				href={resolve('/docs/roadmap')}
				aria-current={page.url.pathname === resolve('/docs/roadmap') ? 'page' : undefined}
			>
				Roadmap
			</a>
		</nav>
	</details>

	<main class="content">
		<article class="[ prose ] [ flow ]" bind:this={prose}>
			{@render children()}
		</article>
	</main>
</div>
