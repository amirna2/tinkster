<script lang="ts">
	import { onMount } from 'svelte';

	let { ondone }: { ondone: () => void } = $props();
	let n = $state(3);

	onMount(() => {
		const id = setInterval(() => {
			n -= 1;
			if (n === 0) {
				clearInterval(id);
				ondone();
			}
		}, 600);
		return () => clearInterval(id);
	});
</script>

<div class="countdown" data-testid="countdown" role="status" aria-live="assertive">
	{#if n > 0}
		{#key n}<span>{n}</span>{/key}
	{/if}
</div>

<style>
	.countdown {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, var(--paper) 80%, transparent);
		z-index: 5;
	}
	span {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 96px;
		animation: pop 600ms var(--ease-out) both;
	}
	@keyframes pop {
		from {
			transform: scale(1.6);
			opacity: 0;
		}
	}
</style>
