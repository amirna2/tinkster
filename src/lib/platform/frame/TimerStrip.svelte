<script lang="ts">
	import type { PausableTimer } from '../types';

	let { timer }: { timer: PausableTimer } = $props();
	const fraction = $derived(timer.durationMs > 0 ? timer.remainingMs / timer.durationMs : 0);
</script>

<div class="strip" role="timer" aria-label="{Math.ceil(timer.remainingMs / 1000)} seconds left">
	<i style:transform="scaleX({fraction})"></i>
</div>

<style>
	.strip {
		height: 6px;
		margin-top: 8px;
		border: var(--line) solid var(--ink);
		border-radius: 999px;
		overflow: hidden;
	}
	i {
		display: block;
		height: 100%;
		background: var(--accent);
		transform-origin: left center;
	}
</style>
