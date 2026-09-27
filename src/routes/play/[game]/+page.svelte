<script lang="ts">
	import GameFrame from '$lib/platform/frame/GameFrame.svelte';
	import { findGame } from '$lib/platform/registry';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const game = $derived(findGame(data.gameId));
</script>

<svelte:head><title>{data.title} · tinkster</title></svelte:head>

{#if game}
	{#key game.id}<GameFrame {game} />{/key}
{/if}
