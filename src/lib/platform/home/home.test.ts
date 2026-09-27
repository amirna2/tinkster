import { describe, expect, it } from 'vitest';
import type { AnyGame, Category } from '../types';
import { formatMinutes, groupByCategory, latestResume } from './home';

const game = (id: string, category: Category, saveVersion = 1): AnyGame => ({
	id,
	title: id.toUpperCase(),
	pitch: 'p',
	category,
	pace: 'turn-based',
	minutes: [1, 2],
	icon: '<svg></svg>',
	saveVersion,
	load: async () => {
		throw new Error('not used');
	},
});

describe('groupByCategory', () => {
	it('orders sections words → logic → arcade and omits empty ones', () => {
		const list = [game('snake', 'arcade'), game('code', 'logic'), game('lock', 'logic')];
		expect(groupByCategory(list).map((s) => [s.id, s.label, s.games.map((g) => g.id)])).toEqual([
			['logic', 'Logic', ['code', 'lock']],
			['arcade', 'Arcade', ['snake']],
		]);
	});
});

describe('latestResume', () => {
	const list = [game('a', 'logic'), game('b', 'logic', 2)];

	it('returns the most recently saved slot of a registered game', () => {
		const entry = latestResume(
			[
				{ gameId: 'a', saveVersion: 1, savedAt: 10, label: 'old' },
				{ gameId: 'b', saveVersion: 2, savedAt: 20, label: 'new' },
			],
			list,
		);
		expect(entry?.game.id).toBe('b');
		expect(entry?.label).toBe('new');
	});

	it('ignores unknown games and stale save versions', () => {
		expect(
			latestResume(
				[
					{ gameId: 'zzz', saveVersion: 1, savedAt: 99, label: 'x' },
					{ gameId: 'b', saveVersion: 1, savedAt: 50, label: 'stale' },
				],
				list,
			),
		).toBeNull();
	});
});

describe('formatMinutes', () => {
	it('formats a range and a single value', () => {
		expect(formatMinutes([2, 10])).toBe('2–10m');
		expect(formatMinutes([3, 3])).toBe('3m');
	});
});
