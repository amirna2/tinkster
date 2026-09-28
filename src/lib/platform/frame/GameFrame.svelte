<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { createFeedback, unlockAudio } from '../feedback';
	import { createRng, randomSeed } from '../rng';
	import { browserStore, createSaves } from '../save';
	import type { AnyGame, GameModule, GameResult, Options } from '../types';
	import Button from '../ui/Button.svelte';
	import Countdown from './Countdown.svelte';
	import EndCard from './EndCard.svelte';
	import MenuSheet from './MenuSheet.svelte';
	import RulesSheet from './RulesSheet.svelte';
	import { GameSession } from './session.svelte';
	import { resolveOptions, seedFromUrl } from './setup';
	import StartPanel from './StartPanel.svelte';
	import TimerStrip from './TimerStrip.svelte';
	import TopBar from './TopBar.svelte';

	let { game }: { game: AnyGame } = $props();

	const saves = createSaves(browserStore());
	let prefs = $state(saves.readPrefs());
	const feedback = createFeedback({ enabled: () => prefs.sound });

	type Phase = 'loading' | 'failed-to-load' | 'start' | 'playing';
	let phase = $state<Phase>('loading');
	let mod = $state.raw<GameModule<unknown> | null>(null);
	let options = $state<Options>({});
	let saved = $state.raw<unknown>(null);
	let session = $state.raw<GameSession<unknown> | null>(null);
	let result = $state.raw<GameResult | null>(null);
	let sheet = $state<'rules' | 'menu' | null>(null);
	let countingDown = $state(false);
	/** An error from a game callback outside the boundary (a timer's onExpire), rethrown inside it. */
	let crash = $state.raw<{ error: unknown } | null>(null);
	let runs = 0;

	const timed = $derived(game.pace !== 'turn-based');

	onMount(() => {
		let cancelled = false;
		const slot = saves.readSlot(game.id, game.saveVersion);
		options = slot?.options ?? resolveOptions(game.options, prefs.options[game.id]);
		saved = slot?.state ?? null;
		game.load().then(
			(m) => {
				if (cancelled) return;
				mod = m;
				if (slot || !game.options?.length) beginRun(slot !== null);
				else phase = 'start';
			},
			(err) => {
				console.error(err);
				if (!cancelled) phase = 'failed-to-load';
			},
		);
		const onPageHide = () => session?.flush();
		window.addEventListener('pagehide', onPageHide);
		// A game with no frame button on mount (no options, or a resumed run) gets no gesture to
		// unlock audio before its first rAF sound; unlock on the run's first tap or key instead.
		const onFirstGesture = () => {
			unlockSound();
			window.removeEventListener('pointerdown', onFirstGesture, true);
			window.removeEventListener('keydown', onFirstGesture, true);
		};
		window.addEventListener('pointerdown', onFirstGesture, true);
		window.addEventListener('keydown', onFirstGesture, true);
		return () => {
			cancelled = true;
			window.removeEventListener('pagehide', onPageHide);
			window.removeEventListener('pointerdown', onFirstGesture, true);
			window.removeEventListener('keydown', onFirstGesture, true);
			session?.dispose();
		};
	});

	$effect(() => {
		session?.setPause('sheet', sheet !== null);
	});
	$effect(() => {
		session?.setPause('countdown', countingDown);
	});

	function beginRun(resuming: boolean): void {
		if (!mod) return;
		session?.dispose();
		result = null;
		sheet = null;
		crash = null;
		const seed = seedFromUrl(location.href, runs++) ?? randomSeed();
		session = new GameSession<unknown>({
			game,
			module: mod,
			options: $state.snapshot(options),
			saves,
			rng: createRng(seed),
			feedback,
			onFinish: (r) => {
				result = r;
				feedback.sound('stamp');
			},
			onError: (error) => {
				crash = { error };
			},
		});
		countingDown = resuming && timed;
		session.setPause('countdown', countingDown);
		phase = 'playing';
	}

	/** Call from user gestures only: iOS unlocks audio inside one (see unlockAudio). */
	function unlockSound(): void {
		if (prefs.sound) unlockAudio();
	}

	function start(): void {
		unlockSound();
		prefs.options[game.id] = $state.snapshot(options);
		saves.writePrefs($state.snapshot(prefs));
		saved = null;
		beginRun(false);
	}

	function playAgain(): void {
		unlockSound();
		saved = null;
		beginRun(false);
	}

	function restart(): void {
		unlockSound();
		session?.discard();
		saves.clearSlot(game.id);
		saved = null;
		sheet = null;
		result = null;
		countingDown = false;
		session?.setPause('countdown', false);
		if (game.options?.length) {
			session = null;
			phase = 'start';
		} else {
			beginRun(false);
		}
	}

	function closeSheet(): void {
		unlockSound();
		sheet = null;
		if (timed && phase === 'playing' && !result) countingDown = true;
	}

	function toggleSound(): void {
		prefs.sound = !prefs.sound;
		saves.writePrefs($state.snapshot(prefs));
		unlockSound();
		if (prefs.sound) feedback.sound('pop');
	}

	function goHome(): void {
		session?.flush();
		goto(resolve('/'));
	}

	function onVisibility(): void {
		if (!session) return;
		if (document.hidden) {
			session.setPause('hidden', true);
			session.flush();
		} else {
			session.setPause('hidden', false);
			if (timed && !result && sheet === null && phase === 'playing') countingDown = true;
		}
	}

	function onKeydown(e: KeyboardEvent): void {
		// Spec §6.6: Escape opens the menu. While a sheet is open, the <dialog> handles Escape itself.
		if (e.key === 'Escape' && sheet === null && !result && phase === 'playing') {
			e.preventDefault();
			sheet = 'menu';
		}
	}

	function onGameError(error: unknown): void {
		console.error(error);
		session?.discard();
		saves.clearSlot(game.id);
	}

	function rethrow(error: unknown): string {
		throw error;
	}
</script>

<svelte:document onvisibilitychange={onVisibility} />
<svelte:window onkeydown={onKeydown} />

<div class="frame" data-testid="game-frame" data-paused={session?.paused ?? false}>
	<!-- The end card is modal: everything behind it is inert, so Tab stays in the card. -->
	<div class="stage" inert={result !== null}>
		<TopBar
			title={game.title}
			onhome={goHome}
			onrules={() => (sheet = 'rules')}
			onmenu={() => (sheet = 'menu')}
		/>
		<div class="meta tabular">
			<span>{session?.meta.left ?? ''}</span>
			<span>{session?.meta.right ?? ''}</span>
		</div>
		{#if session?.timer}<TimerStrip timer={session.timer} />{/if}

		<main class="play">
			{#if phase === 'loading'}
				<p class="status">Loading…</p>
			{:else if phase === 'failed-to-load'}
				<div class="status" role="alert">
					<p>This game couldn't load. Check your connection and try again.</p>
					<Button onclick={() => location.reload()}>Retry</Button>
				</div>
			{:else if phase === 'start' && game.options}
				<StartPanel fields={game.options} bind:values={options} onstart={start} />
			{:else if mod && session}
				{@const View = mod.View}
				<svelte:boundary onerror={onGameError}>
					{#key session}
						<View {options} {saved} ctx={session.ctx} />
					{/key}
					{#if crash}{rethrow(crash.error)}{/if}
					{#snippet failed(_error, reset)}
						<div class="status" role="alert">
							<p>Something broke.</p>
							<div class="row">
								<Button
									variant="accent"
									onclick={() => {
										saved = null;
										beginRun(false);
										reset();
									}}>Start over</Button
								>
								<Button onclick={goHome}>Home</Button>
							</div>
						</div>
					{/snippet}
				</svelte:boundary>
			{/if}
		</main>
	</div>

	{#if sheet === 'rules' && mod}
		<RulesSheet title={game.title} Rules={mod.Rules} onclose={closeSheet} />
	{/if}
	{#if sheet === 'menu'}
		<MenuSheet
			sound={prefs.sound}
			ontogglesound={toggleSound}
			onrestart={restart}
			onclose={closeSheet}
		/>
	{/if}
	{#if countingDown}<Countdown ondone={() => (countingDown = false)} />{/if}
	{#if result}<EndCard {result} onplayagain={playAgain} onhome={goHome} />{/if}
</div>

<style>
	.frame {
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.stage {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.meta {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		min-height: 26px;
		padding-top: 8px;
		color: var(--ink-soft);
		font-size: 12px;
	}
	.play {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		padding: 8px 0 16px;
	}
	.status {
		margin: auto 0;
		text-align: center;
		display: grid;
		gap: 12px;
		justify-items: center;
	}
	.row {
		display: flex;
		gap: 8px;
	}
</style>
