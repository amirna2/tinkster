import { expect, type Page, test } from '@playwright/test';

async function openFixture(page: Page) {
	await page.goto('play/test-fixture?seed=1');
}

async function start(page: Page, mode: 'Calm' | 'Wild' = 'Calm') {
	await page.getByRole('radio', { name: mode }).check();
	await page.getByRole('button', { name: 'Start' }).click();
	await expect(page.getByTestId('count')).toHaveText('0');
}

test.beforeEach(async ({ page }) => {
	await openFixture(page);
});

test('start panel applies the chosen option', async ({ page }) => {
	await start(page, 'Wild');
	await expect(page.getByText('mode wild')).toBeVisible();
	await page.getByRole('button', { name: 'Add one' }).click();
	await expect(page.getByText('count 1')).toBeVisible();
});

test('start panel remembers the last-used option across visits', async ({ page }) => {
	await start(page, 'Wild');
	await page.reload(); // nothing saved yet, so the start panel shows again
	await expect(page.getByRole('radio', { name: 'Wild' })).toBeChecked();
});

test('restart from the menu returns to the start panel', async ({ page }) => {
	await start(page);
	await page.getByRole('button', { name: 'Add one' }).click();
	await page.getByRole('button', { name: 'Menu' }).click();
	await page.getByRole('button', { name: 'Restart game' }).click();
	await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('button', { name: 'Start' })).toBeVisible(); // slot was cleared
});

test('opening the menu pauses the game and freezes the timer', async ({ page }) => {
	await start(page);
	const frame = page.getByTestId('game-frame');
	await page.getByRole('button', { name: 'Menu' }).click();
	await expect(frame).toHaveAttribute('data-paused', 'true');
	const before = await page.getByTestId('remaining').textContent();
	await page.waitForTimeout(1500);
	await expect(page.getByTestId('remaining')).toHaveText(before ?? '');
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('countdown')).toBeVisible();
	await expect(page.getByTestId('countdown')).toBeHidden();
	await expect(frame).toHaveAttribute('data-paused', 'false');
});

test('an interrupted game resumes after a reload, with a countdown', async ({ page }) => {
	await start(page);
	await page.getByRole('button', { name: 'Add one' }).click();
	await page.getByRole('button', { name: 'Add one' }).click();
	await page.reload();
	await expect(page.getByTestId('countdown')).toBeVisible();
	await expect(page.getByTestId('count')).toHaveText('2');
});

test('finishing shows the end card and clears the save', async ({ page }) => {
	await start(page);
	await page.getByRole('button', { name: 'Add one' }).click();
	await page.getByRole('button', { name: 'Win' }).click();
	const card = page.getByRole('dialog', { name: 'Done!' });
	await expect(card).toBeVisible();
	await expect(card.getByRole('heading', { name: 'Count 1' })).toBeVisible();
	await card.getByRole('button', { name: 'Play again' }).click();
	await expect(card).toBeHidden();
	await expect(page.getByTestId('count')).toHaveText('0');
	await page.reload();
	await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
});

test('a crashing game is caught and can start over', async ({ page }) => {
	await start(page);
	await page.getByRole('button', { name: 'Crash' }).click();
	await expect(page.getByRole('alert')).toContainText('Something broke.');
	await page.getByRole('button', { name: 'Start over' }).click();
	await expect(page.getByTestId('count')).toHaveText('0');
});

test('rules sheet opens and closes', async ({ page }) => {
	await page.getByRole('button', { name: 'How to play' }).click();
	const sheet = page.getByRole('dialog', { name: 'How to play Test Fixture' });
	await expect(sheet).toBeVisible();
	await sheet.getByRole('button', { name: 'Close' }).click();
	await expect(sheet).toBeHidden();
});

test('Escape opens the menu and closes it again', async ({ page }) => {
	await start(page);
	await page.keyboard.press('Escape');
	const menu = page.getByRole('dialog', { name: 'Menu' });
	await expect(menu).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(menu).toBeHidden();
});

test('the home button returns to the home page', async ({ page }) => {
	await page.getByRole('button', { name: 'Home' }).click();
	await expect(page).toHaveURL(/\/tinkster\/?$/);
});
