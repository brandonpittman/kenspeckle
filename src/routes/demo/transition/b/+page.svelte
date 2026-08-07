<script lang="ts">
	import { resolve } from '$app/paths';
	import { viewTransitionName } from '$lib/kit/view-transition-name.js';
</script>

<h1>B</h1>
<div class="hero" {@attach viewTransitionName('hero')}>B</div>
<a href={resolve('/demo/transition/a')}>to a</a>
