<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconButton from './IconButton.svelte';

	interface Props {
		title: string;
		onclose: () => void;
		children: Snippet;
	}

	let { title, onclose, children }: Props = $props();
	const uid = $props.id();
	let dialog = $state<HTMLDialogElement>();

	$effect(() => {
		dialog?.showModal();
		return () => dialog?.close();
	});
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="{uid}-title"
	oncancel={(e) => {
		e.preventDefault();
		onclose();
	}}
>
	<header>
		<h2 id="{uid}-title">{title}</h2>
		<IconButton label="Close" onclick={onclose}>✕</IconButton>
	</header>
	<div class="body">{@render children()}</div>
</dialog>

<style>
	dialog {
		margin: auto auto 0;
		width: min(100%, var(--max-width));
		max-width: 100%;
		max-height: 85dvh;
		padding: 16px var(--gutter) calc(20px + env(safe-area-inset-bottom));
		border: var(--line) solid var(--ink);
		border-bottom: 0;
		border-radius: 16px 16px 0 0;
		background: var(--paper);
		color: var(--ink);
		animation: rise var(--dur) var(--ease-out);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding-bottom: 12px;
		border-bottom: var(--line) solid var(--ink-faint);
	}
	h2 {
		font-size: 20px;
	}
	.body {
		padding-top: 14px;
		line-height: 1.5;
	}
	@keyframes rise {
		from {
			transform: translateY(24px);
			opacity: 0;
		}
	}
</style>
