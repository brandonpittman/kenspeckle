<script lang="ts">
	import { roadmap } from './roadmap.js';
	import TypeTag from './TypeTag.svelte';
</script>

{#each roadmap as group (group.status)}
	<section>
		<h2>{group.title}</h2>
		<p class="roadmap-note">{group.note}</p>
		<ul class="roadmap-list">
			{#each group.items as item (item.name)}
				<li>
					<span class="roadmap-name">{item.name}</span>
					<TypeTag type={item.type} />
					<span class="roadmap-blurb">{item.blurb}</span>
				</li>
			{/each}
		</ul>
	</section>
{/each}
