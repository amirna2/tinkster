import { breakTheCode } from '../games/break-the-code';
import { fixtureGame } from './testing/fixture';
import type { AnyGame, Category } from './types';

/**
 * Every playable game, one line each. Order within a category is the order on the home screen.
 * Adding a game = import its definition and add it here. See docs/adding-a-game.md.
 */
export const games: AnyGame[] = [breakTheCode];

/** Test-only games, compiled in only for the e2e build (PUBLIC_TEST_HOOKS=1). */
const testGames: AnyGame[] = __TEST_HOOKS__ ? [fixtureGame] : [];

/** Everything that gets a /play/<id> route. */
export const routableGames: AnyGame[] = [...games, ...testGames];

export function findGame(id: string): AnyGame | undefined {
	return routableGames.find((g) => g.id === id);
}

export const CATEGORIES: { id: Category; label: string }[] = [
	{ id: 'words', label: 'Words & numbers' },
	{ id: 'logic', label: 'Logic' },
	{ id: 'arcade', label: 'Arcade' },
];
