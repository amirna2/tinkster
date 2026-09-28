// Fails when the production build exceeds the spec §7.7 budgets.
// Run after `npm run build` (not build:test).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const BUDGET = { home: 100 * KB, game: 50 * KB, fonts: 110 * KB };
const BUILD = 'build';
const MANIFESTS = ['.svelte-kit/output/client/.vite/manifest.json', `${BUILD}/.vite/manifest.json`];

const gz = (file) => gzipSync(readFileSync(file)).length;
const kb = (n) => `${(n / KB).toFixed(1)} KB`;
const failures = [];
const report = (label, size, budget) => {
	const ok = size <= budget;
	console.log(
		`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(40)} ${kb(size).padStart(9)} / ${kb(budget)}`,
	);
	if (!ok) failures.push(label);
};

// 1. Home route: every JS/CSS file the prerendered home page references.
const html = readFileSync(join(BUILD, 'index.html'), 'utf8');
const refs = new Set(
	[...html.matchAll(/(?:href|src)="([^"]+\.(?:js|css))"|import\("([^"]+\.js)"\)/g)]
		.map((m) => m[1] ?? m[2])
		.map((p) => p.replace(/^(\.\/|\/tinkster\/|\/)/, '')),
);
const homeFiles = [...refs].map((p) => join(BUILD, p)).filter((f) => existsSync(f));
if (homeFiles.length === 0) {
	console.error('No JS/CSS references found in build/index.html; has the output format changed?');
	process.exit(1);
}
report(
	'home route (JS+CSS, gzip)',
	homeFiles.reduce((sum, f) => sum + gz(f), 0),
	BUDGET.home,
);

// 2. Game chunks: each src/lib/games/<id>/module.ts entry plus imports not already loaded by home.
const manifestPath = MANIFESTS.find((p) => existsSync(p));
if (!manifestPath) {
	console.error(`Vite manifest not found (looked in ${MANIFESTS.join(', ')}).`);
	process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const clientDir = join(manifestPath, '..', '..');
const homeSet = new Set(homeFiles.map((f) => f.slice(BUILD.length + 1)));

const exclusive = (key, seen = new Set()) => {
	const entry = manifest[key];
	if (!entry || seen.has(key)) return [];
	seen.add(key);
	const own = [entry.file, ...(entry.css ?? [])].filter((f) => !homeSet.has(f));
	return [...own, ...(entry.imports ?? []).flatMap((k) => exclusive(k, seen))];
};

const gameKeys = Object.keys(manifest).filter((k) =>
	/^src\/lib\/games\/[^/]+\/module\.ts$/.test(k),
);
if (gameKeys.length === 0) failures.push('no game chunks found in manifest');
for (const key of gameKeys) {
	const files = [...new Set(exclusive(key))];
	const size = files.reduce((sum, f) => sum + gz(join(clientDir, f)), 0);
	report(`game ${key.split('/')[3]} (gzip)`, size, BUDGET.game);
}

// 3. The test fixture must never ship.
if (Object.keys(manifest).some((k) => k.includes('testing/fixture'))) {
	failures.push('test fixture found in production build');
	console.log('FAIL test fixture is present in the production build');
}

// 4. Fonts (already compressed woff2).
const assetsDir = join(BUILD, '_app', 'immutable', 'assets');
const fonts = readdirSync(assetsDir).filter((f) => f.endsWith('.woff2'));
report(
	'fonts (woff2)',
	fonts.reduce((sum, f) => sum + statSync(join(assetsDir, f)).size, 0),
	BUDGET.fonts,
);

if (failures.length) {
	console.error(`\nSize budget exceeded: ${failures.join(', ')}`);
	process.exit(1);
}
