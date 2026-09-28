import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { enterGuess, secretFor, startBreakTheCode, wrongCode } from './helpers';

async function settle(page: Page) {
	await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
}

async function audit(page: Page) {
	await settle(page);
	const { violations } = await new AxeBuilder({ page }).analyze();
	const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
	expect(
		serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
	).toEqual([]);
}

for (const colorScheme of ['light', 'dark'] as const) {
	test.describe(`${colorScheme} mode`, () => {
		test.use({ colorScheme });

		test('home', async ({ page }) => {
			await page.goto('./');
			await audit(page);
		});

		test('start panel', async ({ page }) => {
			await page.goto('play/break-the-code');
			await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
			await audit(page);
		});

		test('game in progress', async ({ page }) => {
			await startBreakTheCode(page);
			await enterGuess(page, wrongCode(secretFor(0)));
			await audit(page);
		});

		test('end card', async ({ page }) => {
			await startBreakTheCode(page);
			await enterGuess(page, secretFor(0));
			await expect(page.getByRole('dialog', { name: 'Cracked!' })).toBeVisible();
			await audit(page);
		});

		test('rules and menu sheets', async ({ page }) => {
			await startBreakTheCode(page);
			await page.getByRole('button', { name: 'How to play' }).click();
			await audit(page);
			await page.keyboard.press('Escape');
			await page.getByRole('button', { name: 'Menu' }).click();
			await audit(page);
		});
	});
}
