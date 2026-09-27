// Renders the PWA icons (ink "t" + red square on paper) with Playwright's Chromium.
// Run: npm run icons. The outputs are committed.
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const font = readFileSync('src/lib/platform/ui/fonts/fraunces-wght.woff2').toString('base64');

const html = (size, scale) => `<!doctype html><html><head><style>
@font-face { font-family: F; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 100 900; }
html, body { margin: 0; width: ${size}px; height: ${size}px; background: #f7f5f0; }
.mark { width: 100%; height: 100%; display: grid; place-items: center; }
.t { font-family: F; font-weight: 800; line-height: 1; color: #161514;
     font-size: ${Math.round(size * 0.72 * scale)}px; }
.dot { display: inline-block; background: #c93c25; margin-left: ${Math.round(size * 0.02 * scale)}px;
       width: ${Math.round(size * 0.13 * scale)}px; height: ${Math.round(size * 0.13 * scale)}px; }
</style></head><body><div class="mark"><span class="t">t<span class="dot"></span></span></div></body></html>`;

const targets = [
	['icon-192.png', 192, 1],
	['icon-512.png', 512, 1],
	['maskable-512.png', 512, 0.7], // content inside the maskable safe zone
	['apple-touch-icon.png', 180, 0.9],
];

mkdirSync('static/icons', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, scale] of targets) {
	await page.setViewportSize({ width: size, height: size });
	await page.setContent(html(size, scale));
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({ path: `static/icons/${name}` });
	console.log(`wrote static/icons/${name}`);
}
await browser.close();
