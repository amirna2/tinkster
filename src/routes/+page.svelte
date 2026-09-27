<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import GameTile from '$lib/platform/home/GameTile.svelte';
	import { groupByCategory, latestResume, type ResumeEntry } from '$lib/platform/home/home';
	import ResumeCard from '$lib/platform/home/ResumeCard.svelte';
	import { games, routableGames } from '$lib/platform/registry';
	import { createRng, randomSeed } from '$lib/platform/rng';
	import { browserStore, createSaves } from '$lib/platform/save';
	import Wordmark from '$lib/platform/ui/Wordmark.svelte';

	const sections = groupByCategory(games);
	let resume = $state.raw<ResumeEntry | null>(null);

	onMount(() => {
		resume = latestResume(createSaves(browserStore()).listSlots(), routableGames);
	});

	function surprise(): void {
		if (games.length === 0) return;
		const game = createRng(randomSeed()).pick(games);
		goto(resolve('/play/[game]', { game: game.id }));
	}
</script>

<svelte:head><title>tinkster · tiny games for spare minutes</title></svelte:head>

<header class="top">
	<h1><Wordmark /></h1>
	<button class="surprise" onclick={surprise} disabled={games.length === 0}>
		<svg viewBox="0 0 20 20" aria-hidden="true">
			<rect x="2.5" y="2.5" width="15" height="15" rx="3" />
			<circle cx="7" cy="7" r="1.3" />
			<circle cx="13" cy="13" r="1.3" />
			<circle cx="10" cy="10" r="1.3" />
		</svg>
		Surprise me
	</button>
</header>
<p class="tagline">Tiny games for spare minutes. No sign-up, no tracking, works offline.</p>

{#if resume}<ResumeCard entry={resume} />{/if}

{#each sections as section (section.id)}
	<section aria-labelledby="sec-{section.id}">
		<h2 id="sec-{section.id}">{section.label}</h2>
		<div class="grid">
			{#each section.games as game (game.id)}<GameTile {game} />{/each}
		</div>
	</section>
{/each}

<footer>Open source · nothing you do here leaves your device</footer>

<style>
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding-top: 18px;
	}
	h1 {
		line-height: 1;
	}
	.surprise {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: var(--tap);
		padding: 0 14px;
		border: var(--line) solid var(--ink);
		border-radius: 999px;
		background: var(--paper);
		font-weight: 600;
		font-size: 13px;
		cursor: pointer;
	}
	.surprise:disabled {
		opacity: 0.35;
	}
	.surprise:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.surprise svg {
		width: 18px;
		height: 18px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
	}
	.surprise svg circle {
		fill: currentColor;
		stroke: none;
	}
	.tagline {
		margin: 6px 0 0;
		color: var(--ink-soft);
		font-size: 12px;
	}
	h2 {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 20px 2px 10px;
		font-size: 16px;
	}
	h2::after {
		content: '';
		flex: 1;
		border-top: var(--line) solid var(--ink-faint);
	}
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	footer {
		margin: auto 0 0;
		padding: 28px 0 16px;
		color: var(--ink-soft);
		font-size: 11px;
		text-align: center;
	}
</style>
