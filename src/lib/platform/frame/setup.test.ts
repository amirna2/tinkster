import { describe, expect, it } from 'vitest';
import type { OptionField } from '../types';
import { resolveOptions, seedFromUrl } from './setup';

const fields: OptionField[] = [
	{
		key: 'difficulty',
		label: 'Difficulty',
		default: 'normal',
		choices: [
			{ value: 'easy', label: 'Easy' },
			{ value: 'normal', label: 'Normal' },
		],
	},
];

describe('resolveOptions', () => {
	it('uses defaults when nothing is stored', () => {
		expect(resolveOptions(fields, undefined)).toEqual({ difficulty: 'normal' });
	});

	it('uses a stored value when it is still a valid choice', () => {
		expect(resolveOptions(fields, { difficulty: 'easy' })).toEqual({ difficulty: 'easy' });
	});

	it('falls back to the default for a stale stored value and drops unknown keys', () => {
		expect(resolveOptions(fields, { difficulty: 'nightmare', extra: 'x' })).toEqual({
			difficulty: 'normal',
		});
	});

	it('returns an empty object for games without options', () => {
		expect(resolveOptions(undefined, { a: 'b' })).toEqual({});
	});
});

describe('seedFromUrl', () => {
	it('is ignored unless test hooks are enabled', () => {
		expect(seedFromUrl('http://x/play/a?seed=5', 0, false)).toBeNull();
	});

	it('offsets the seed by the run number when enabled', () => {
		expect(seedFromUrl('http://x/play/a?seed=5', 0, true)).toBe(5);
		expect(seedFromUrl('http://x/play/a?seed=5', 2, true)).toBe(7);
	});

	it('rejects missing or malformed seeds', () => {
		expect(seedFromUrl('http://x/play/a', 0, true)).toBeNull();
		expect(seedFromUrl('http://x/play/a?seed=abc', 0, true)).toBeNull();
	});
});
