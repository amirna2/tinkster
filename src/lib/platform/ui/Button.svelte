<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: 'outline' | 'ink' | 'accent';
		children: Snippet;
	}

	let { variant = 'outline', children, ...rest }: Props = $props();
</script>

<button class="btn {variant}" {...rest}>{@render children()}</button>

<style>
	.btn {
		min-height: var(--tap);
		padding: 0 18px;
		border: var(--line) solid var(--ink);
		border-radius: 10px;
		background: var(--paper);
		font-weight: 700;
		font-size: 15px;
		box-shadow: var(--shadow-sm);
		cursor: pointer;
		touch-action: manipulation;
		transition:
			transform var(--dur-fast) var(--ease-out),
			box-shadow var(--dur-fast) var(--ease-out);
	}
	.btn:active:not(:disabled) {
		transform: translate(2px, 2px);
		box-shadow: 0 0 0 var(--ink);
	}
	.btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.btn:disabled {
		opacity: 0.35;
		box-shadow: none;
		cursor: default;
	}
	.ink {
		background: var(--ink);
		color: var(--paper);
	}
	.accent {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--on-accent);
	}
</style>
