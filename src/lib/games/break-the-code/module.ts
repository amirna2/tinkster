import type { GameModule } from '$lib/platform/types';
import HowToPlay from './HowToPlay.svelte';
import type { BtcOptions, State } from './rules';
import View from './View.svelte';

const mod: GameModule<State, BtcOptions> = {
	View,
	Rules: HowToPlay,
	progressLabel: (s) => `guess ${s.guesses.length + 1} of ${s.config.maxGuesses}`,
};

export default mod;
