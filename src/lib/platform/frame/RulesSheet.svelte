<script lang="ts">
	import type { Component } from 'svelte';
	import Sheet from '../ui/Sheet.svelte';

	let { title, Rules, onclose }: { title: string; Rules: Component; onclose: () => void } = $props();
</script>

<Sheet title="How to play {title}" {onclose}><Rules /></Sheet>
