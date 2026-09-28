import { error } from '@sveltejs/kit';
import { findGame, routableGames } from '$lib/platform/registry';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => routableGames.map((g) => ({ game: g.id }));

export const load: PageLoad = ({ params }) => {
	const game = findGame(params.game);
	if (!game) error(404, 'Unknown game');
	return { gameId: game.id, title: game.title };
};
