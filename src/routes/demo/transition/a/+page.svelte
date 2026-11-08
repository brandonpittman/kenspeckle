<script lang="ts">
	import { resolve } from '$app/paths';
	import { viewTransitionName } from '$lib/kit/view-transition-name.js';
</script>

<h1>A</h1>
<div class="hero" {@attach viewTransitionName('hero')}>A</div>
<a href={resolve('/demo/transition/b')}>to b</a>
