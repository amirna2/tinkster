<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		label: string;
		children: Snippet;
	}

	let { label, children, ...rest }: Props = $props();
</script>

<button class="icon-btn" aria-label={label} title={label} {...rest}>{@render children()}</button>

<style>
	.icon-btn {
		flex: none;
		width: var(--tap);
		height: var(--tap);
		display: grid;
		place-items: center;
		border: var(--line) solid var(--ink);
		border-radius: 50%;
		background: var(--paper);
		font-weight: 700;
		font-size: 17px;
		line-height: 1;
		cursor: pointer;
		touch-action: manipulation;
		transition: transform var(--dur-fast) var(--ease-out);
	}
	.icon-btn:active {
		transform: scale(0.94);
	}
	.icon-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
