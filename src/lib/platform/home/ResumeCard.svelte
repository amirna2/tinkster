<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ResumeEntry } from './home';

	let { entry }: { entry: ResumeEntry } = $props();
</script>

<a class="resume" href={resolve('/play/[game]', { game: entry.game.id })}>
	<span class="text">
		<b>{entry.game.title}</b>
		<span>{entry.label}</span>
	</span>
	<span class="go">Resume</span>
</a>

<style>
	.resume {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin: 14px 0 4px;
		padding: 10px 14px;
		border-radius: var(--radius);
		background: var(--ink);
		color: var(--paper);
		text-decoration: none;
		font-size: 12px;
	}
	.resume:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}
	b {
		display: block;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 15px;
	}
	.go {
		padding: 6px 14px;
		border-radius: 999px;
		background: var(--accent);
		color: var(--on-accent);
		font-weight: 700;
	}
</style>
