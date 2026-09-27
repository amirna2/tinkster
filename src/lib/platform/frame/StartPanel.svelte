<script lang="ts">
	import type { OptionField, Options } from '../types';
	import Button from '../ui/Button.svelte';

	interface Props {
		fields: OptionField[];
		values: Options;
		onstart: () => void;
	}

	let { fields, values = $bindable(), onstart }: Props = $props();
</script>

<section class="start" aria-label="Game options">
	{#each fields as field (field.key)}
		<fieldset>
			<legend>{field.label}</legend>
			<div class="choices">
				{#each field.choices as choice (choice.value)}
					<label class="choice" class:selected={values[field.key] === choice.value}>
						<input type="radio" name={field.key} value={choice.value} bind:group={values[field.key]} />
						<span class="label">{choice.label}</span>
						{#if choice.hint}<span class="hint">{choice.hint}</span>{/if}
					</label>
				{/each}
			</div>
		</fieldset>
	{/each}
	<Button variant="accent" onclick={onstart}>Start</Button>
</section>

<style>
	.start {
		display: flex;
		flex-direction: column;
		gap: 20px;
		margin: auto 0;
		padding: 16px 0;
	}
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
	}
	legend {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 18px;
		margin-bottom: 10px;
	}
	.choices {
		display: grid;
		gap: 8px;
	}
	.choice {
		position: relative;
		display: flex;
		align-items: baseline;
		gap: 10px;
		min-height: var(--tap);
		padding: 10px 14px;
		border: var(--line) solid var(--ink);
		border-radius: var(--radius);
		cursor: pointer;
	}
	.choice.selected {
		box-shadow: var(--shadow);
		border-color: var(--accent);
	}
	.choice:has(input:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	/* The real radio covers the whole label so taps and e2e clicks land on it. */
	input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}
	.label {
		font-weight: 700;
	}
	.hint {
		color: var(--ink-soft);
		font-size: 13px;
	}
</style>
