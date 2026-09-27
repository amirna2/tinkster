<script lang="ts">
	import '$lib/platform/ui/tokens.css';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="shell">{@render children()}</div>

<style>
	.shell {
		max-width: var(--max-width);
		min-height: 100dvh;
		margin: 0 auto;
		padding: env(safe-area-inset-top) var(--gutter) env(safe-area-inset-bottom);
		display: flex;
		flex-direction: column;
	}
</style>
