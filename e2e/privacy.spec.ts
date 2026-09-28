import { expect, test } from '@playwright/test';
import { enterGuess, secretFor, startBreakTheCode, wrongCode } from './helpers';

test('never contacts another origin and never violates the CSP', async ({ page, baseURL }) => {
	const origin = new URL(baseURL ?? '').origin;
	const foreign: string[] = [];
	const violations: string[] = [];
	page.on('request', (req) => {
		const url = new URL(req.url());
		if (url.protocol.startsWith('http') && url.origin !== origin) foreign.push(req.url());
	});
	page.on('console', (msg) => {
		if (/content security policy/i.test(msg.text())) violations.push(msg.text());
	});

	await page.goto('./');
	await expect(page.locator('meta[http-equiv="content-security-policy"]')).toHaveCount(1);
	await startBreakTheCode(page);
	await enterGuess(page, wrongCode(secretFor(0)));
	await page.getByRole('button', { name: 'Menu' }).click();
	await page.getByRole('button', { name: 'Sound' }).click(); // exercises Web Audio
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'Home' }).click();
	await expect(page.getByRole('link', { name: /Resume/ })).toBeVisible();

	expect(foreign).toEqual([]);
	expect(violations).toEqual([]);
});
