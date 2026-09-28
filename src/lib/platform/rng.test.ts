import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRng, randomSeed } from './rng';

const sequence = (seed: number, n = 16) => {
	const rng = createRng(seed);
	return Array.from({ length: n }, () => rng.next());
};

describe('createRng', () => {
	it('is deterministic for a given seed', () => {
		fc.assert(
			fc.property(fc.integer(), (seed) => {
				expect(sequence(seed)).toEqual(sequence(seed));
			}),
		);
	});

	it('produces different sequences for different seeds', () => {
		expect(sequence(1)).not.toEqual(sequence(2));
	});

	it('next() stays within [0, 1)', () => {
		fc.assert(
			fc.property(fc.integer(), (seed) => {
				for (const v of sequence(seed, 64)) {
					expect(v).toBeGreaterThanOrEqual(0);
					expect(v).toBeLessThan(1);
				}
			}),
		);
	});

	it('int(min, max) stays within inclusive bounds', () => {
		fc.assert(
			fc.property(
				fc.integer(),
				fc.integer({ min: -1000, max: 1000 }),
				fc.integer({ min: 0, max: 1000 }),
				(seed, min, span) => {
					const v = createRng(seed).int(min, min + span);
					expect(Number.isInteger(v)).toBe(true);
					expect(v).toBeGreaterThanOrEqual(min);
					expect(v).toBeLessThanOrEqual(min + span);
				},
			),
		);
	});

	it('int() rejects an empty or fractional range', () => {
		expect(() => createRng(1).int(5, 4)).toThrow(RangeError);
		expect(() => createRng(1).int(0.5, 4)).toThrow(RangeError);
	});

	it('shuffle() returns a permutation and leaves the input untouched', () => {
		fc.assert(
			fc.property(fc.integer(), fc.array(fc.integer()), (seed, items) => {
				const copy = [...items];
				const shuffled = createRng(seed).shuffle(items);
				expect(items).toEqual(copy);
				expect([...shuffled].sort((a, b) => a - b)).toEqual([...items].sort((a, b) => a - b));
			}),
		);
	});

	it('pick() returns an element of the array and rejects empty arrays', () => {
		fc.assert(
			fc.property(fc.integer(), fc.array(fc.string(), { minLength: 1 }), (seed, items) => {
				expect(items).toContain(createRng(seed).pick(items));
			}),
		);
		expect(() => createRng(1).pick([])).toThrow(RangeError);
	});
});

describe('randomSeed', () => {
	it('returns a uint32', () => {
		const s = randomSeed();
		expect(Number.isInteger(s)).toBe(true);
		expect(s).toBeGreaterThanOrEqual(0);
		expect(s).toBeLessThanOrEqual(0xffffffff);
	});
});
