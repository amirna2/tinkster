import { CATEGORIES } from '../registry';
import type { SlotSummary } from '../save';
import type { AnyGame, Category } from '../types';

export interface Section {
	id: Category;
	label: string;
	games: AnyGame[];
}

export function groupByCategory(list: AnyGame[]): Section[] {
	return CATEGORIES.map((c) => ({ ...c, games: list.filter((g) => g.category === c.id) })).filter(
		(s) => s.games.length > 0,
	);
}

export interface ResumeEntry {
	game: AnyGame;
	label: string;
	savedAt: number;
}

export function latestResume(slots: SlotSummary[], list: AnyGame[]): ResumeEntry | null {
	let best: ResumeEntry | null = null;
	for (const slot of slots) {
		const game = list.find((g) => g.id === slot.gameId);
		if (!game || game.saveVersion !== slot.saveVersion) continue;
		if (!best || slot.savedAt > best.savedAt) {
			best = { game, label: slot.label, savedAt: slot.savedAt };
		}
	}
	return best;
}

export function formatMinutes([min, max]: [number, number]): string {
	return min === max ? `${min}m` : `${min}–${max}m`;
}
