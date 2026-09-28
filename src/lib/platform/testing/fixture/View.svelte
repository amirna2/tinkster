<script lang="ts">
	import { untrack } from 'svelte';
	import type { GameProps } from '../../types';
	import type { FixtureOptions, FixtureState } from './state';

	let { options, saved, ctx }: GameProps<FixtureState, FixtureOptions> = $props();

	let count = $state(untrack(() => saved?.count ?? 0));
	let crashed = $state(false);
	const timer = untrack(() =>
		ctx.timer(60_000, () => ctx.finish({ stamp: 'Time!', headline: `Count ${count}` })),
	);

	$effect(() => {
		ctx.setMeta(`count ${count}`, `mode ${options.mode}`);
	});

	function crash(): string {
		throw new Error('fixture crash');
	}
</script>

<div class="fixture">
	<p data-testid="count">{count}</p>
	<p data-testid="remaining">{Math.ceil(timer.remainingMs / 1000)}</p>
	<button
		onclick={() => {
			count += 1;
			ctx.save({ count });
		}}>Add one</button
	>
	<button onclick={() => ctx.finish({ stamp: 'Done!', headline: `Count ${count}` })}>Win</button>
	<button onclick={() => (crashed = true)}>Crash</button>
	<button
		onclick={() =>
			ctx.timer(1, () => {
				throw new Error('fixture timer crash');
			})}>Throw from timer</button
	>
	{#if crashed}{crash()}{/if}
</div>

<style>
	.fixture {
		display: grid;
		gap: 8px;
		padding: 16px 0;
	}
	button {
		min-height: var(--tap);
	}
</style>
