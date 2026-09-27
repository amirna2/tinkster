import { expect, type Page } from '@playwright/test';
import { type Difficulty, newGame } from '../src/lib/games/break-the-code/rules';
import { createRng } from '../src/lib/platform/rng';

export const SEED = 7;

/** The secret the app will generate for run `run` of a page opened with ?seed=SEED. */
export function secretFor(run: number, difficulty: Difficulty = 'normal'): number[] {
	return newGame(difficulty, createRng(SEED + run)).secret;
}

/** A valid no-repeat guess sharing no digit with the secret (so: 0 hits, 0 nears). */
export function wrongCode(secret: number[], length = secret.length): number[] {
	return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !secret.includes(d)).slice(0, length);
}

export async function startBreakTheCode(
	page: Page,
	difficulty: 'Easy' | 'Normal' | 'Hard' = 'Normal',
) {
	await page.goto(`play/break-the-code?seed=${SEED}`);
	await page.getByRole('radio', { name: new RegExp(`^${difficulty}`) }).check();
	await page.getByRole('button', { name: 'Start' }).click();
	await expect(page.getByText(/^Guess 1 of \d+$/)).toBeVisible();
}

export async function enterGuess(page: Page, digits: number[]) {
	await page.keyboard.type(digits.join(''));
	await page.keyboard.press('Enter');
}
