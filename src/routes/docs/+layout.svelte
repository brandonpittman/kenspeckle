<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { copy } from '$lib/copy.js';
	import { groupLabels, utilities, utilityTypes } from './utilities.js';
	import './docs.css';

	let { children } = $props();

	const wideQuery = '(min-width: 48rem)';

	let navOpen = $state(false);
	let prose = $state<HTMLElement>();

	const groups = utilityTypes
		.map((type) => ({ type, items: utilities.filter((u) => u.type === type) }))
		.filter((group) => group.items.length);

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
			copy({
				text: source,
				onCopy: () => {
					button.textContent = 'Copied';
					button.dataset.copied = 'true';
					setTimeout(() => {
						button.textContent = 'Copy';
						delete button.dataset.copied;
					}, 1600);
				}
			})(button);
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

			<div class="[ nav-groups ] [ flow ]">
				{#each groups as group (group.type)}
					<div>
						<span class="nav-group-label" id="nav-group-{group.type}">
							{groupLabels[group.type]}
						</span>
						<ul aria-labelledby="nav-group-{group.type}">
							{#each group.items as util (util.slug)}
								<li>
									<a
										href={util.href}
										aria-current={page.url.pathname === util.href ? 'page' : undefined}
									>
										{util.label}
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>

			<a
				href={resolve('/docs/recipes')}
				aria-current={page.url.pathname === resolve('/docs/recipes') ? 'page' : undefined}
			>
				Recipes
			</a>
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
