import { expect, test } from '@playwright/test';
import { enterGuess, secretFor, startBreakTheCode, wrongCode } from './helpers';

test('cracking the code shows the end card with the answer', async ({ page }) => {
	await startBreakTheCode(page);
	const secret = secretFor(0);
	await enterGuess(page, wrongCode(secret));
	await expect(page.getByText('Guess 2 of 8')).toBeVisible();
	await enterGuess(page, secret);
	const card = page.getByRole('dialog', { name: 'Cracked!' });
	await expect(card).toBeVisible();
	await expect(card.getByRole('heading', { name: '2 guesses' })).toBeVisible();
	await expect(card.getByRole('group', { name: 'The code' })).toHaveText(
		new RegExp(secret.join('\\s*')),
	);
	await card.getByRole('button', { name: 'Play again' }).click();
	await expect(page.getByText('Guess 1 of 8')).toBeVisible();
});

test('running out of guesses reveals the code', async ({ page }) => {
	await startBreakTheCode(page);
	const secret = secretFor(0);
	for (let i = 0; i < 8; i++) await enterGuess(page, wrongCode(secret));
	const card = page.getByRole('dialog', { name: 'Locked out' });
	await expect(card).toBeVisible();
	await expect(card.getByRole('group', { name: 'The code' })).toHaveText(
		new RegExp(secret.join('\\s*')),
	);
});

test('the keypad types, deletes and explains rejected input', async ({ page }) => {
	await startBreakTheCode(page);
	const pad = page.getByRole('group', { name: 'Keypad' });
	await pad.getByRole('button', { name: '1', exact: true }).click();
	await pad.getByRole('button', { name: '1', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('No repeated digits at this level');
	await pad.getByRole('button', { name: 'Enter' }).click();
	await expect(page.getByRole('status')).toHaveText('Fill every slot first');
	await pad.getByRole('button', { name: 'Delete' }).click();
	await expect(page.getByRole('listitem', { name: 'Current guess: empty' })).toBeVisible();
});

test('feedback pegs are announced per guess', async ({ page }) => {
	await startBreakTheCode(page);
	const secret = secretFor(0);
	const guess = [secret[1], secret[0], ...wrongCode(secret).slice(0, 2)] as number[];
	await enterGuess(page, guess);
	await expect(
		page.getByRole('listitem', {
			name: `Guess 1: ${guess.join(' ')}, 0 right place, 2 wrong place`,
		}),
	).toBeVisible();
});

test('an unfinished game resumes from the home screen', async ({ page }) => {
	await startBreakTheCode(page);
	const wrong = wrongCode(secretFor(0));
	await enterGuess(page, wrong);
	await page.getByRole('button', { name: 'Home' }).click();
	await page.getByRole('link', { name: /Break the Code.*guess 2 of 8.*Resume/ }).click();
	await expect(page.getByText('Guess 2 of 8')).toBeVisible();
	await expect(
		page.getByRole('listitem', { name: new RegExp(`^Guess 1: ${wrong.join(' ')},`) }),
	).toBeVisible();
});

test('hard mode allows repeated digits and has 10 guesses', async ({ page }) => {
	await startBreakTheCode(page, 'Hard');
	await expect(page.getByText('Guess 1 of 10')).toBeVisible();
	await enterGuess(page, [7, 7, 7, 7, 7]);
	await expect(page.getByText('Guess 2 of 10')).toBeVisible();
});

test('Enter on a focused top-bar button activates it instead of submitting a guess', async ({
	page,
}) => {
	await startBreakTheCode(page);
	const guess = wrongCode(secretFor(0));
	await page.getByRole('button', { name: 'Menu' }).focus();
	await page.keyboard.type(guess.join('')); // digits still type while a control has focus
	await page.keyboard.press('Enter');
	await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByText('Guess 1 of 8')).toBeVisible();
	await expect(
		page.getByRole('listitem', { name: `Current guess: ${guess.join(' ')}` }),
	).toBeVisible();
});
