<script lang="ts">
	import { untrack } from 'svelte';
	import type { GameProps } from '$lib/platform/types';
	import {
		type Action,
		type BtcOptions,
		isDifficulty,
		newGame,
		type Rejection,
		reduce,
		type State,
	} from './rules';

	let { options, saved, ctx }: GameProps<State, BtcOptions> = $props();

	let game = $state<State>(
		untrack(
			() =>
				saved ??
				newGame(isDifficulty(options.difficulty) ? options.difficulty : 'normal', ctx.rng),
		),
	);
	let rejection = $state<Rejection | null>(null);
	let nudge = $state(0);
	let pad = $state<HTMLElement>();

	const REASON: Record<Rejection, string> = {
		'too-short': 'Fill every slot first',
		repeat: 'No repeated digits at this level',
	};
	const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
	const slots = $derived(Array.from({ length: game.config.length }, (_, i) => i));
	const rows = $derived(Array.from({ length: game.config.maxGuesses }, (_, i) => i));

	$effect(() => {
		const { config, guesses } = game;
		ctx.setMeta(
			`Guess ${Math.min(guesses.length + 1, config.maxGuesses)} of ${config.maxGuesses}`,
			`${config.length} digits · ${config.repeats ? 'repeats allowed' : 'no repeats'}`,
		);
	});

	function act(action: Action): void {
		if (ctx.paused || game.status !== 'playing') return;
		const outcome = reduce(game, action);
		if (outcome.rejected) {
			rejection = outcome.rejected;
			nudge += 1;
			ctx.feedback.sound('fail');
			ctx.feedback.haptic('error');
			return;
		}
		if (outcome.state === game) return;
		rejection = null;
		game = outcome.state;

		if (action.type === 'submit') {
			ctx.feedback.sound('pop');
			ctx.feedback.haptic('tap');
		} else {
			ctx.feedback.sound('tick');
		}

		if (game.status === 'playing') {
			ctx.save(game);
			return;
		}
		const n = game.guesses.length;
		ctx.finish(
			game.status === 'won'
				? {
						stamp: 'Cracked!',
						headline: `${n} ${n === 1 ? 'guess' : 'guesses'}`,
						detail: 'The code was',
						reveal: codeReveal,
					}
				: { stamp: 'Locked out', headline: 'Out of guesses', detail: 'The code was', reveal: codeReveal },
		);
	}

	/** A focused control outside the keypad (Home, Menu, ...) keeps Enter and Backspace for itself. */
	function controlFocused(target: EventTarget | null): boolean {
		return (
			target instanceof Element &&
			!pad?.contains(target) &&
			target.closest('a, button, input, select, textarea, [tabindex]') !== null
		);
	}

	function onkeydown(e: KeyboardEvent): void {
		if (e.metaKey || e.ctrlKey || e.altKey || ctx.paused || game.status !== 'playing') return;
		if (/^[0-9]$/.test(e.key)) act({ type: 'digit', digit: Number(e.key) });
		else if (controlFocused(e.target)) return;
		else if (e.key === 'Backspace') act({ type: 'backspace' });
		else if (e.key === 'Enter') act({ type: 'submit' });
		else return;
		e.preventDefault();
	}

	function rowLabel(i: number): string {
		const guess = game.guesses[i];
		if (guess) {
			return `Guess ${i + 1}: ${guess.digits.join(' ')}, ${guess.hits} right place, ${guess.nears} wrong place`;
		}
		if (i === game.guesses.length && game.status === 'playing') {
			return `Current guess: ${game.entry.length ? game.entry.join(' ') : 'empty'}`;
		}
		return `Guess ${i + 1}: not played`;
	}
</script>

<svelte:window {onkeydown} />

{#snippet codeReveal()}
	<div class="code" role="group" aria-label="The code">
		{#each game.secret as digit, i (i)}<span class="digit solid">{digit}</span>{/each}
	</div>
{/snippet}

<div class="btc">
	<ol class="board" aria-label="Guesses">
		{#each rows as i (i)}
			{@const guess = game.guesses[i]}
			{@const current = i === game.guesses.length && game.status === 'playing'}
			{@const digits = guess ? guess.digits : current ? game.entry : []}
			<li class="row" class:current aria-label={rowLabel(i)}>
				{#each slots as p (p)}
					<span class="digit" class:blank={!guess && !current}>{digits[p] ?? ''}</span>
				{/each}
				<span class="pegs" aria-hidden="true" style:--cols={Math.ceil(game.config.length / 2)}>
					{#each slots as p (p)}
						<i
							class:hit={!!guess && p < guess.hits}
							class:near={!!guess && p >= guess.hits && p < guess.hits + guess.nears}
							style:--delay="{p * 70}ms"
						></i>
					{/each}
				</span>
			</li>
		{/each}
	</ol>

	{#key nudge}
		<p class="reason" class:shake={nudge > 0} role="status">
			{rejection ? REASON[rejection] : ''}
		</p>
	{/key}

	<div class="pad" role="group" aria-label="Keypad" bind:this={pad}>
		<div class="keys">
			{#each KEYS as key (key)}
				<button class="key" onclick={() => act({ type: 'digit', digit: key })}>{key}</button>
			{/each}
		</div>
		<div class="actions">
			<button class="key" aria-label="Delete" onclick={() => act({ type: 'backspace' })}>⌫</button>
			<button class="key enter" onclick={() => act({ type: 'submit' })}>Enter</button>
		</div>
	</div>
</div>

<style>
	.btc {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.board {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		margin: 0;
		padding: 4px 0;
		list-style: none;
	}
	/* Centers the rows when they fit, stays scrollable from the top when they don't. */
	.board > :first-child {
		margin-top: auto;
	}
	.board > :last-child {
		margin-bottom: auto;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.digit {
		width: 34px;
		height: 38px;
		display: grid;
		place-items: center;
		border: var(--line) solid var(--ink);
		border-radius: var(--radius-sm);
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 19px;
	}
	.digit.blank {
		opacity: 0.18;
	}
	.row.current .digit {
		border: 2px solid var(--accent);
	}
	.digit.solid {
		background: var(--ink);
		color: var(--paper);
	}
	.pegs {
		display: grid;
		grid-template-columns: repeat(var(--cols), 9px);
		gap: 3px;
		margin-left: 8px;
	}
	.pegs i {
		width: 9px;
		height: 9px;
		border: var(--line) solid var(--ink);
		border-radius: 50%;
		opacity: 0.22;
	}
	.pegs i.hit,
	.pegs i.near {
		opacity: 1;
		animation: peg 220ms var(--ease-out) var(--delay) both;
	}
	.pegs i.hit {
		background: var(--accent);
		border-color: var(--accent);
	}
	@keyframes peg {
		from {
			transform: scale(0);
		}
	}
	.reason {
		min-height: 20px;
		margin: 6px 0;
		text-align: center;
		font-size: 13px;
		color: var(--accent);
	}
	.shake {
		animation: shake 300ms;
	}
	@keyframes shake {
		20%,
		60% {
			transform: translateX(-6px);
		}
		40%,
		80% {
			transform: translateX(6px);
		}
	}
	.pad {
		display: grid;
		gap: 6px;
	}
	.keys {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 6px;
	}
	.actions {
		display: grid;
		grid-template-columns: 1fr 2fr;
		gap: 6px;
	}
	.key {
		min-height: var(--tap);
		border: var(--line) solid var(--ink);
		border-radius: 10px;
		background: var(--paper);
		box-shadow: var(--shadow-sm);
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 19px;
		cursor: pointer;
		touch-action: manipulation;
	}
	.key:active {
		transform: translate(2px, 2px);
		box-shadow: none;
	}
	.key:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.enter {
		background: var(--ink);
		color: var(--paper);
		font-family: var(--font-ui);
		font-weight: 700;
		font-size: 15px;
	}
	.code {
		display: flex;
		gap: 6px;
	}
</style>
