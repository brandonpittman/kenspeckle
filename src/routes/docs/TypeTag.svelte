<script lang="ts">
	import { tagLabels, type TagType } from './utilities.js';

	let { type }: { type: TagType } = $props();
</script>

<span class="type-tag" data-type={type}>{tagLabels[type]}</span>
