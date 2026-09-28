<script lang="ts">
	import IconButton from '../ui/IconButton.svelte';

	interface Props {
		title: string;
		onhome: () => void;
		onrules: () => void;
		onmenu: () => void;
	}

	let { title, onhome, onrules, onmenu }: Props = $props();
</script>

<header class="bar">
	<IconButton label="Home" onclick={onhome}>←</IconButton>
	<h1>{title}</h1>
	<IconButton label="How to play" onclick={onrules}>?</IconButton>
	<IconButton label="Menu" onclick={onmenu}>⋯</IconButton>
</header>

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 0 10px;
		border-bottom: var(--line) solid var(--ink);
	}
	h1 {
		flex: 1;
		font-size: 18px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
