import type { GameModule } from '../../types';
import HowToPlay from './HowToPlay.svelte';
import type { FixtureOptions, FixtureState } from './state';
import View from './View.svelte';

const mod: GameModule<FixtureState, FixtureOptions> = {
	View,
	Rules: HowToPlay,
	progressLabel: (s) => `count ${s.count}`,
};

export default mod;
