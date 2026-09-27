<script lang="ts">
	import Button from '../ui/Button.svelte';
	import Sheet from '../ui/Sheet.svelte';

	interface Props {
		sound: boolean;
		ontogglesound: () => void;
		onrestart: () => void;
		onclose: () => void;
	}

	let { sound, ontogglesound, onrestart, onclose }: Props = $props();
</script>

<Sheet title="Menu" {onclose}>
	<div class="items">
		<Button onclick={onrestart}>Restart game</Button>
		<Button aria-pressed={sound} onclick={ontogglesound}>
			Sound <span aria-hidden="true">· {sound ? 'on' : 'off'}</span>
		</Button>
	</div>
</Sheet>

<style>
	.items {
		display: grid;
		gap: 10px;
	}
</style>
