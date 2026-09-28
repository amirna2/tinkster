import { expect, type Page, test } from '@playwright/test';

async function openFixture(page: Page) {
	await page.goto('play/test-fixture?seed=1');
}

/** Wraps the page's AudioContext constructor so tests can observe contexts without any app-side hook. */
async function trackAudioContexts(page: Page) {
	await page.addInitScript(() => {
		const Native = window.AudioContext;
		const contexts: AudioContext[] = [];
		(window as unknown as { __audioContexts: AudioContext[] }).__audioContexts = contexts;
		window.AudioContext = new Proxy(Native, {
			construct(target, args) {
				const ctx = Reflect.construct(target, args) as AudioContext;
				contexts.push(ctx);
				return ctx;
			},
		}) as unknown as typeof AudioContext;
	});
}

function audioContextStates(page: Page): Promise<string[]> {
	return page.evaluate(
		() =>
			(window as unknown as { __audioContexts?: AudioContext[] }).__audioContexts?.map(
				(c) => c.state,
			) ?? [],
	);
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

test('restarting during the resume countdown drops the countdown', async ({ page }) => {
	await start(page);
	await page.getByRole('button', { name: 'Add one' }).click();
	await page.reload();
	await expect(page.getByTestId('countdown')).toBeVisible();
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'Restart game' }).click();
	await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
	// The 3-2-1 would otherwise run on for up to 1.8 s over the start panel.
	await expect(page.getByTestId('countdown')).toHaveCount(0, { timeout: 300 });
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

test('the end card keeps keyboard focus inside it', async ({ page, browserName }) => {
	await start(page);
	await page.getByRole('button', { name: 'Win' }).click();
	const card = page.getByRole('dialog', { name: 'Done!' });
	await expect(card.getByRole('button', { name: 'Play again' })).toBeFocused();
	// WebKit only tabs to buttons with Option held, like Safari's default.
	const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
	const visited: string[] = [];
	for (let i = 0; i < 4; i++) {
		await page.keyboard.press(tab);
		// Between cycles focus may briefly leave the page (body); it must never reach the frame behind.
		const focus = await page.evaluate(() => {
			const el = document.activeElement;
			if (!el || el === document.body) return 'body';
			return el.closest('[role="dialog"]') ? `card:${el.textContent?.trim()}` : el.outerHTML;
		});
		visited.push(focus);
	}
	expect(visited).toContain('card:Home');
	expect(visited.filter((f) => f !== 'body' && !f.startsWith('card:'))).toEqual([]);
});

test('a crashing game is caught and can start over', async ({ page }) => {
	await start(page);
	await page.getByRole('button', { name: 'Crash' }).click();
	await expect(page.getByRole('alert')).toContainText('Something broke.');
	await page.getByRole('button', { name: 'Start over' }).click();
	await expect(page.getByTestId('count')).toHaveText('0');
});

test('an error in a timer callback is caught, clears the save and can start over', async ({
	page,
}) => {
	await start(page);
	await page.getByRole('button', { name: 'Add one' }).click();
	await page.getByRole('button', { name: 'Throw from timer' }).click();
	await expect(page.getByRole('alert')).toContainText('Something broke.');
	await page.reload();
	await expect(page.getByRole('button', { name: 'Start' })).toBeVisible(); // slot was cleared
	await start(page);
	await page.getByRole('button', { name: 'Throw from timer' }).click();
	await page.getByRole('button', { name: 'Start over' }).click();
	await expect(page.getByTestId('count')).toHaveText('0');
	await expect(page.getByRole('alert')).toBeHidden();
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

test('unlocks the shared AudioContext on the first gesture when sound is already on', async ({
	page,
}) => {
	await trackAudioContexts(page);
	await openFixture(page);
	await page.evaluate(() => {
		localStorage.setItem('tinkster:prefs', JSON.stringify({ sound: true, options: {} }));
	});
	await page.reload();
	await expect.poll(() => audioContextStates(page)).toHaveLength(0);
	await page.keyboard.press('Shift'); // no Start/Menu tap: only the frame's first-gesture listener
	await expect.poll(() => audioContextStates(page)).toEqual(['running']);
});

test('creates no AudioContext on the first gesture while sound is off', async ({ page }) => {
	await trackAudioContexts(page);
	await openFixture(page);
	await page.keyboard.press('Shift');
	await expect.poll(() => audioContextStates(page)).toHaveLength(0);
});
