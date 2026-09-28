/** Seeded PRNG: sfc32, seeded from one 32-bit integer via splitmix32. */
export interface Rng {
	/** Uniform float in [0, 1). */
	next(): number;
	/** Uniform integer in [min, max], inclusive. */
	int(min: number, max: number): number;
	pick<T>(items: readonly T[]): T;
	/** Fisher–Yates; returns a new array. */
	shuffle<T>(items: readonly T[]): T[];
}

function splitmix32(seed: number): () => number {
	let a = seed | 0;
	return () => {
		a = (a + 0x9e3779b9) | 0;
		let t = a ^ (a >>> 16);
		t = Math.imul(t, 0x21f0aaad);
		t ^= t >>> 15;
		t = Math.imul(t, 0x735a2d97);
		t ^= t >>> 15;
		return t >>> 0;
	};
}

export function createRng(seed: number): Rng {
	const init = splitmix32(seed);
	let a = init();
	let b = init();
	let c = init();
	let d = init();

	const next32 = (): number => {
		let t = (a + b) | 0;
		a = b ^ (b >>> 9);
		b = (c + (c << 3)) | 0;
		c = (c << 21) | (c >>> 11);
		d = (d + 1) | 0;
		t = (t + d) | 0;
		c = (c + t) | 0;
		return t >>> 0;
	};

	const next = () => next32() / 4294967296;

	const int = (min: number, max: number) => {
		if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
			throw new RangeError(`invalid range [${min}, ${max}]`);
		}
		return min + Math.floor(next() * (max - min + 1));
	};

	return {
		next,
		int,
		pick<T>(items: readonly T[]): T {
			if (items.length === 0) throw new RangeError('cannot pick from an empty array');
			return items[int(0, items.length - 1)] as T;
		},
		shuffle<T>(items: readonly T[]): T[] {
			const out = [...items];
			for (let i = out.length - 1; i > 0; i--) {
				const j = int(0, i);
				[out[i], out[j]] = [out[j] as T, out[i] as T];
			}
			return out;
		},
	};
}

export function randomSeed(): number {
	return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}
