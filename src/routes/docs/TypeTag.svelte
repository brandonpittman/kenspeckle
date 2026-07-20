<script lang="ts">
	import { typeLabels, type UtilityType } from './utilities.js';

	let { type }: { type: UtilityType } = $props();
</script>

<span class="type-tag" data-type={type}>{typeLabels[type]}</span>
