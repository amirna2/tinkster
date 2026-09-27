import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { games } from './registry';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('registry', () => {
	it('has unique ids', () => {
		const ids = games.map((g) => g.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	for (const game of games) {
		describe(game.id, () => {
			it('has valid metadata', () => {
				expect(game.id).toMatch(SLUG);
				expect(game.title.trim()).not.toBe('');
				expect(game.pitch.trim()).not.toBe('');
				expect(game.pitch.length).toBeLessThanOrEqual(40);
				const [min, max] = game.minutes;
				expect(min).toBeGreaterThanOrEqual(1);
				expect(max).toBeLessThanOrEqual(15);
				expect(min).toBeLessThanOrEqual(max);
				expect(Number.isInteger(game.saveVersion) && game.saveVersion > 0).toBe(true);
				expect(game.icon.trim().startsWith('<svg')).toBe(true);
			});

			it('has well-formed options', () => {
				const keys = (game.options ?? []).map((o) => o.key);
				expect(new Set(keys).size).toBe(keys.length);
				for (const field of game.options ?? []) {
					expect(field.choices.length).toBeGreaterThan(0);
					expect(field.choices.map((c) => c.value)).toContain(field.default);
				}
			});

			it('lazy-loads a complete module', async () => {
				const mod = await game.load();
				expect(typeof mod.View).toBe('function');
				expect(typeof mod.Rules).toBe('function');
				expect(typeof mod.progressLabel).toBe('function');
			});

			it('has rules tests', () => {
				expect(existsSync(resolve(`src/lib/games/${game.id}/rules.test.ts`))).toBe(true);
			});
		});
	}
});
