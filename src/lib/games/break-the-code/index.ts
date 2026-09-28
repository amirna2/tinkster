import { defineGame } from '$lib/platform/types';
import icon from './icon.svg?raw';
import type { BtcOptions, State } from './rules';

export const breakTheCode = defineGame<State, BtcOptions>({
	id: 'break-the-code',
	title: 'Break the Code',
	pitch: 'Crack the hidden digits',
	category: 'logic',
	pace: 'turn-based',
	minutes: [2, 4],
	icon,
	saveVersion: 1,
	options: [
		{
			key: 'difficulty',
			label: 'Difficulty',
			default: 'normal',
			choices: [
				{ value: 'easy', label: 'Easy', hint: '3 digits · 8 guesses' },
				{ value: 'normal', label: 'Normal', hint: '4 digits · 8 guesses' },
				{ value: 'hard', label: 'Hard', hint: '5 digits · repeats · 10 guesses' },
			],
		},
	],
	load: () => import('./module').then((m) => m.default),
});
