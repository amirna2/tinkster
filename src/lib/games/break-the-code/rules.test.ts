import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRng } from '$lib/platform/rng';
import {
	CONFIGS,
	type Difficulty,
	isDifficulty,
	newGame,
	reduce,
	type State,
	score,
} from './rules';

const code = (length: number) =>
	fc.array(fc.integer({ min: 0, max: 9 }), { minLength: length, maxLength: length });
const anyCode = fc.integer({ min: 1, max: 6 }).chain(code);
const codePair = fc.integer({ min: 1, max: 6 }).chain((n) => fc.tuple(code(n), code(n)));

describe('score', () => {
	it.each([
		[[1, 2, 3, 4], [1, 2, 3, 4], 4, 0],
		[[1, 2, 3, 4], [4, 3, 2, 1], 0, 4],
		[[1, 2, 3, 4], [1, 5, 6, 2], 1, 1],
		[[1, 2, 3, 4], [5, 6, 7, 8], 0, 0],
		[[1, 1, 2, 2, 3], [1, 2, 1, 2, 1], 2, 2],
		[[0, 0, 0], [0, 1, 1], 1, 0],
	])('score(%j, %j) → %i hits, %i nears', (secret, guess, hits, nears) => {
		expect(score(secret, guess)).toEqual({ hits, nears });
	});

	it('0 ≤ hits + nears ≤ length', () => {
		fc.assert(
			fc.property(codePair, ([secret, guess]) => {
				const { hits, nears } = score(secret, guess);
				expect(hits).toBeGreaterThanOrEqual(0);
				expect(nears).toBeGreaterThanOrEqual(0);
				expect(hits + nears).toBeLessThanOrEqual(secret.length);
			}),
		);
	});

	it('a code scored against itself is all hits', () => {
		fc.assert(
			fc.property(anyCode, (c) => {
				expect(score(c, c)).toEqual({ hits: c.length, nears: 0 });
			}),
		);
	});

	it('is symmetric in secret and guess', () => {
		fc.assert(
			fc.property(codePair, ([a, b]) => {
				expect(score(a, b)).toEqual(score(b, a));
			}),
		);
	});
});

describe('newGame', () => {
	const difficulties = Object.keys(CONFIGS) as Difficulty[];

	it('makes a secret of the right length, digits 0–9, distinct unless repeats are allowed', () => {
		fc.assert(
			fc.property(fc.integer(), fc.constantFrom(...difficulties), (seed, difficulty) => {
				const { secret, config, guesses, entry, status } = newGame(difficulty, createRng(seed));
				expect(secret).toHaveLength(config.length);
				for (const d of secret) expect(Number.isInteger(d) && d >= 0 && d <= 9).toBe(true);
				if (!config.repeats) expect(new Set(secret).size).toBe(secret.length);
				expect([guesses, entry, status]).toEqual([[], [], 'playing']);
			}),
		);
	});

	it('is deterministic for a seed', () => {
		expect(newGame('hard', createRng(42))).toEqual(newGame('hard', createRng(42)));
	});

	it('hard mode can produce repeated digits', () => {
		const seeds = Array.from({ length: 200 }, (_, i) => i);
		const withRepeat = seeds.some((s) => {
			const { secret } = newGame('hard', createRng(s));
			return new Set(secret).size < secret.length;
		});
		expect(withRepeat).toBe(true);
	});
});

describe('isDifficulty', () => {
	it('accepts only the three levels', () => {
		expect(isDifficulty('easy')).toBe(true);
		expect(isDifficulty('hard')).toBe(true);
		expect(isDifficulty('toString')).toBe(false);
		expect(isDifficulty('nightmare')).toBe(false);
	});
});

describe('reduce', () => {
	const fixed = (secret: number[], difficulty: Difficulty = 'normal'): State => ({
		config: CONFIGS[difficulty],
		secret,
		guesses: [],
		entry: [],
		status: 'playing',
	});
	const type = (state: State, digits: number[]) =>
		digits.reduce((s, digit) => reduce(s, { type: 'digit', digit }).state, state);
	const submit = (state: State) => reduce(state, { type: 'submit' });

	it('types digits up to the code length and ignores extras', () => {
		expect(type(fixed([1, 2, 3, 4]), [5, 6, 7, 8, 9]).entry).toEqual([5, 6, 7, 8]);
	});

	it('ignores out-of-range digits', () => {
		const s = fixed([1, 2, 3, 4]);
		expect(reduce(s, { type: 'digit', digit: 10 }).state).toBe(s);
		expect(reduce(s, { type: 'digit', digit: 1.5 }).state).toBe(s);
	});

	it('backspace removes the last digit and is a no-op on an empty entry', () => {
		const s = type(fixed([1, 2, 3, 4]), [5, 6]);
		expect(reduce(s, { type: 'backspace' }).state.entry).toEqual([5]);
		const empty = fixed([1, 2, 3, 4]);
		expect(reduce(empty, { type: 'backspace' }).state).toBe(empty);
	});

	it('rejects a short guess without changing state', () => {
		const s = type(fixed([1, 2, 3, 4]), [5, 6]);
		const out = submit(s);
		expect(out.rejected).toBe('too-short');
		expect(out.state).toBe(s);
	});

	it('rejects a repeated digit when repeats are not allowed', () => {
		const s = type(fixed([1, 2, 3, 4]), [7]);
		const out = reduce(s, { type: 'digit', digit: 7 });
		expect(out.rejected).toBe('repeat');
		expect(out.state.entry).toEqual([7]);
	});

	it('allows repeated digits in hard mode', () => {
		expect(type(fixed([1, 1, 2, 2, 3], 'hard'), [7, 7]).entry).toEqual([7, 7]);
	});

	it('scores a submitted guess and clears the entry', () => {
		const out = submit(type(fixed([1, 2, 3, 4]), [1, 5, 6, 2]));
		expect(out.state.guesses).toEqual([{ digits: [1, 5, 6, 2], hits: 1, nears: 1 }]);
		expect(out.state.entry).toEqual([]);
		expect(out.state.status).toBe('playing');
	});

	it('wins on an exact guess', () => {
		expect(submit(type(fixed([1, 2, 3, 4]), [1, 2, 3, 4])).state.status).toBe('won');
	});

	it('loses after the last wrong guess', () => {
		let s = fixed([1, 2, 3, 4]);
		for (let i = 0; i < 8; i++) s = submit(type(s, [5, 6, 7, 8])).state;
		expect(s.status).toBe('lost');
		expect(s.guesses).toHaveLength(8);
	});

	it('ignores all input once the game is over', () => {
		const won = submit(type(fixed([1, 2, 3, 4]), [1, 2, 3, 4])).state;
		expect(reduce(won, { type: 'digit', digit: 5 }).state).toBe(won);
		expect(reduce(won, { type: 'submit' }).state).toBe(won);
	});

	it('never mutates its input', () => {
		const s = type(fixed([1, 2, 3, 4]), [1, 5, 6]);
		const before = structuredClone(s);
		reduce(s, { type: 'digit', digit: 2 });
		reduce(s, { type: 'backspace' });
		submit(reduce(s, { type: 'digit', digit: 2 }).state);
		expect(s).toEqual(before);
	});
});
