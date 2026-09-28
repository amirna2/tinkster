import { expect, test } from '@playwright/test';
import { enterGuess, secretFor, startBreakTheCode, wrongCode } from './helpers';

for (const colorScheme of ['light', 'dark'] as const) {
	test.describe(colorScheme, () => {
		test.use({ colorScheme });

		test('home', async ({ page }) => {
			await page.goto('./');
			await expect(page).toHaveScreenshot(`home-${colorScheme}.png`, { fullPage: true });
		});

		test('break the code in play', async ({ page }) => {
			await startBreakTheCode(page);
			const secret = secretFor(0);
			await enterGuess(page, wrongCode(secret));
			await enterGuess(page, [secret[1], secret[0], ...wrongCode(secret).slice(0, 2)] as number[]);
			await expect(page).toHaveScreenshot(`btc-play-${colorScheme}.png`);
		});

		test('end card', async ({ page }) => {
			await startBreakTheCode(page);
			await enterGuess(page, secretFor(0));
			await expect(page.getByRole('dialog', { name: 'Cracked!' })).toBeVisible();
			await expect(page).toHaveScreenshot(`end-card-${colorScheme}.png`);
		});
	});
}
