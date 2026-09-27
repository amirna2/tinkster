import { expect, test } from '@playwright/test';

test('shows the wordmark and no resume card on a first visit', async ({ page }) => {
	await page.goto('./');
	await expect(page.getByRole('heading', { level: 1, name: 'tinkster' })).toBeVisible();
	await expect(page.getByRole('link', { name: /Resume/ })).toHaveCount(0);
});

test('offers to resume the most recent unfinished game', async ({ page }) => {
	await page.goto('play/test-fixture?seed=1');
	await page.getByRole('button', { name: 'Start' }).click();
	await page.getByRole('button', { name: 'Add one' }).click();
	await page.getByRole('button', { name: 'Home' }).click();
	const resume = page.getByRole('link', { name: /Test Fixture.*count 1.*Resume/ });
	await expect(resume).toBeVisible();
	await resume.click();
	await expect(page.getByTestId('count')).toHaveText('1');
});
