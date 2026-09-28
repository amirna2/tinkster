<script lang="ts">
	import type { GameResult } from '../types';
	import Button from '../ui/Button.svelte';
	import Stamp from '../ui/Stamp.svelte';

	interface Props {
		result: GameResult;
		onplayagain: () => void;
		onhome: () => void;
	}

	let { result, onplayagain, onhome }: Props = $props();
	const uid = $props.id();
	let card = $state<HTMLElement>();

	$effect(() => {
		card?.querySelector('button')?.focus();
	});
</script>

<div class="scrim"></div>
<div class="card" role="dialog" aria-modal="true" aria-labelledby="{uid}-stamp" bind:this={card}>
	<p class="stamp" id="{uid}-stamp"><Stamp text={result.stamp} /></p>
	<h2>{result.headline}</h2>
	{#if result.detail}<p class="detail">{result.detail}</p>{/if}
	{#if result.reveal}<div class="reveal">{@render result.reveal()}</div>{/if}
	<div class="actions">
		<Button variant="accent" onclick={onplayagain}>Play again</Button>
		<Button onclick={onhome}>Home</Button>
	</div>
</div>

<style>
	.scrim {
		position: absolute;
		inset: 0;
		background: var(--scrim);
		z-index: 9;
		animation: fade var(--dur) ease-out 400ms both;
	}
	.card {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 16px;
		z-index: 10;
		padding: 20px 16px 16px;
		border: var(--line) solid var(--ink);
		border-radius: 16px;
		background: var(--paper);
		box-shadow: 4px 4px 0 var(--ink);
		text-align: center;
		--stamp-delay: 550ms;
		animation: rise 260ms var(--ease-out) 400ms both;
	}
	.stamp {
		margin: 0 0 12px;
	}
	h2 {
		font-size: 22px;
	}
	.detail {
		margin: 4px 0 0;
		color: var(--ink-soft);
		font-size: 13px;
	}
	.reveal {
		margin: 12px 0 4px;
		display: flex;
		justify-content: center;
	}
	.actions {
		display: grid;
		gap: 8px;
		margin-top: 16px;
	}
	@keyframes rise {
		from {
			transform: translateY(24px);
			opacity: 0;
		}
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
</style>
