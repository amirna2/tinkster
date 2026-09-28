import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE = `http://localhost:${PORT}/tinkster/`;

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: { baseURL: BASE, trace: 'retain-on-failure' },
	webServer: {
		command: `npm run build:test && npx vite preview --port ${PORT} --strictPort`,
		url: BASE,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000,
	},
	projects: [
		{ name: 'iphone-se', use: { ...devices['iPhone SE'] }, testIgnore: /visual\.spec\.ts/ },
		{ name: 'pixel-7', use: { ...devices['Pixel 7'] }, testIgnore: /visual\.spec\.ts/ },
		{ name: 'visual', use: { ...devices['Pixel 7'] }, testMatch: /visual\.spec\.ts/ },
	],
});
