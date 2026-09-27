import type { Rng } from '$lib/platform/rng';

export type Difficulty = 'easy' | 'normal' | 'hard';
export type BtcOptions = { difficulty: Difficulty };

export interface Config {
	length: number;
	repeats: boolean;
	maxGuesses: number;
}

export const CONFIGS: Record<Difficulty, Config> = {
	easy: { length: 3, repeats: false, maxGuesses: 8 },
	normal: { length: 4, repeats: false, maxGuesses: 8 },
	hard: { length: 5, repeats: true, maxGuesses: 10 },
};

export interface Guess {
	digits: number[];
	/** Right digit, right position. */
	hits: number;
	/** Right digit, wrong position. */
	nears: number;
}

export interface State {
	config: Config;
	secret: number[];
	guesses: Guess[];
	/** The guess being typed. */
	entry: number[];
	status: 'playing' | 'won' | 'lost';
}

export type Action = { type: 'digit'; digit: number } | { type: 'backspace' } | { type: 'submit' };
export type Rejection = 'too-short' | 'repeat';

export interface Outcome {
	/** The same object as the input when the action was ignored or rejected. */
	state: State;
	rejected?: Rejection;
}

export function isDifficulty(value: string): value is Difficulty {
	return Object.hasOwn(CONFIGS, value);
}

export function makeSecret(config: Config, rng: Rng): number[] {
	if (config.repeats) return Array.from({ length: config.length }, () => rng.int(0, 9));
	return rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, config.length);
}

export function newGame(difficulty: Difficulty, rng: Rng): State {
	const config = CONFIGS[difficulty];
	return { config, secret: makeSecret(config, rng), guesses: [], entry: [], status: 'playing' };
}

/** Standard Mastermind scoring: nears = Σ_d min(count_secret(d), count_guess(d)) − hits. */
export function score(
	secret: readonly number[],
	guess: readonly number[],
): { hits: number; nears: number } {
	let hits = 0;
	const inSecret = new Array<number>(10).fill(0);
	const inGuess = new Array<number>(10).fill(0);
	for (let i = 0; i < secret.length; i++) {
		const s = secret[i] as number;
		const g = guess[i] as number;
		if (s === g) hits++;
		inSecret[s] = (inSecret[s] ?? 0) + 1;
		inGuess[g] = (inGuess[g] ?? 0) + 1;
	}
	let common = 0;
	for (let d = 0; d < 10; d++) common += Math.min(inSecret[d] ?? 0, inGuess[d] ?? 0);
	return { hits, nears: common - hits };
}

export function reduce(state: State, action: Action): Outcome {
	if (state.status !== 'playing') return { state };
	const { config, entry } = state;

	switch (action.type) {
		case 'digit': {
			const d = action.digit;
			if (!Number.isInteger(d) || d < 0 || d > 9 || entry.length >= config.length) {
				return { state };
			}
			if (!config.repeats && entry.includes(d)) return { state, rejected: 'repeat' };
			return { state: { ...state, entry: [...entry, d] } };
		}
		case 'backspace':
			return entry.length === 0 ? { state } : { state: { ...state, entry: entry.slice(0, -1) } };
		case 'submit': {
			if (entry.length < config.length) return { state, rejected: 'too-short' };
			const guess: Guess = { digits: [...entry], ...score(state.secret, entry) };
			const guesses = [...state.guesses, guess];
			const status =
				guess.hits === config.length
					? 'won'
					: guesses.length >= config.maxGuesses
						? 'lost'
						: 'playing';
			return { state: { ...state, guesses, entry: [], status } };
		}
	}
}
