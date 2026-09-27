import { expect, test } from '@playwright/test';
import { startBreakTheCode } from './helpers';

test('home and games keep working offline after the first visit', async ({
	page,
	context,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		'Playwright emulates offline service workers in Chromium only',
	);
	await page.goto('./');
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole('heading', { level: 1, name: 'tinkster' })).toBeVisible();
	await startBreakTheCode(page);
});
