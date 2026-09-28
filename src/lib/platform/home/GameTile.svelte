<script lang="ts">
	import { resolve } from '$app/paths';
	import type { AnyGame, Category } from '../types';
	import { formatMinutes } from './home';

	let { game }: { game: AnyGame } = $props();

	const TEXTURE: Record<Category, string> = {
		words: 'tx-dots',
		logic: 'tx-lines',
		arcade: 'tx-grid',
	};
</script>

<a class="tile" href={resolve('/play/[game]', { game: game.id })}>
	<span class="tx {TEXTURE[game.category]}" aria-hidden="true"></span>
	<span class="title">{game.title}</span>
	<span class="pitch">{game.pitch}</span>
	<span class="badge tabular">{formatMinutes(game.minutes)}</span>
	<!-- Icons are our own static SVG files (imported with ?raw), never user content. -->
	<span class="icon" aria-hidden="true">{@html game.icon}</span>
</a>

<style>
	.tile {
		position: relative;
		display: block;
		height: 104px;
		padding: 11px 12px;
		overflow: hidden;
		border: var(--line) solid var(--ink);
		border-radius: var(--radius);
		background: var(--paper);
		box-shadow: var(--shadow);
		color: inherit;
		text-decoration: none;
		transition:
			transform var(--dur-fast) var(--ease-out),
			box-shadow var(--dur-fast) var(--ease-out);
	}
	.tile:active {
		transform: translate(3px, 3px);
		box-shadow: 0 0 0 var(--ink);
	}
	.tile:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}
	.tx {
		position: absolute;
		inset: 0;
		opacity: 0.13;
		pointer-events: none;
	}
	.title {
		position: relative;
		display: block;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 15px;
		line-height: 1.15;
	}
	.pitch {
		position: relative;
		display: block;
		max-width: 92px;
		margin-top: 3px;
		font-size: 11px;
		line-height: 1.25;
		color: var(--ink-soft);
	}
	.badge {
		position: absolute;
		left: 12px;
		bottom: 10px;
		padding: 1px 7px;
		border: 1px solid var(--ink);
		border-radius: 999px;
		background: var(--paper);
		font-size: 10px;
		font-weight: 600;
	}
	.icon {
		position: absolute;
		right: 8px;
		bottom: 8px;
		width: 40px;
		height: 40px;
	}
	.icon :global(svg) {
		width: 100%;
		height: 100%;
		fill: none;
		stroke: var(--ink);
		stroke-width: 2.2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.icon :global(.accent) {
		stroke: var(--accent);
	}
	.icon :global(.fill) {
		fill: var(--ink);
		stroke: none;
	}
</style>
