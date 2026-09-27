<script lang="ts">
	let { text }: { text: string } = $props();
</script>

<span class="stamp">{text}</span>

<style>
	.stamp {
		display: inline-block;
		padding: 2px 14px;
		border: 3px solid var(--accent);
		border-radius: 10px;
		color: var(--accent);
		font-family: var(--font-display);
		font-style: italic;
		font-weight: 700;
		font-size: 28px;
		transform: rotate(-6deg);
		animation: slam 320ms var(--ease-out) both;
		animation-delay: var(--stamp-delay, 0ms);
	}
	@keyframes slam {
		0% {
			transform: rotate(-6deg) scale(2.2);
			opacity: 0;
		}
		60% {
			transform: rotate(-6deg) scale(0.92);
			opacity: 1;
		}
		100% {
			transform: rotate(-6deg) scale(1);
		}
	}
</style>
