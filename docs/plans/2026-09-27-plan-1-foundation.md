# tinkster Plan 1: Foundation + Break the Code, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the tinkster platform (home, shared game frame, registry, platform services, offline, CI gates, GitHub Pages deploy) with Break the Code as the first real game.

**Architecture:** A static SvelteKit site (Svelte 5 runes, adapter-static, every route prerendered). Games plug into a typed registry and are lazy-loaded into a shared `GameFrame`. The frame owns chrome, pause, resume slots, the end card and error recovery. Each game owns pure rules (`rules.ts`) and a view (`View.svelte`). A test-only fixture game exercises the frame independently of any real game.

**Tech Stack:** SvelteKit 2 · Svelte 5 · TypeScript 6 · Vite 8 · Vitest 5 + fast-check 4 · Playwright 1.63 + @axe-core/playwright · Biome 2 · GitHub Actions + GitHub Pages.

**Spec:** [`docs/specs/2026-09-27-tinkster-v1-design.md`](../specs/2026-09-27-tinkster-v1-design.md). Read it before starting; this plan implements §§3–7, §8.1 and §§10–12 of it.

**Out of scope for this plan:** the word list pipeline and Letters & Numbers (Plan 2), and Snake (Plan 3). The platform pieces Snake needs (`loop.ts`, `input/swipe.ts`) **are** built here, because Plan 3 must not touch `src/lib/platform/`.

## Global Constraints

- Node 22 LTS (`.nvmrc` = `22`), npm with a committed `package-lock.json`.
- **TypeScript `^6`.** Do not install TypeScript 7: `svelte-check@4` and `@sveltejs/kit@2` peer ranges stop at `^6.0.0`.
- Svelte 5 **runes only** (`$props`, `$state`, `$derived`, `$effect`). No `export let`, no `svelte/store` in new code. `compilerOptions.runes = true` globally.
- **No runtime dependencies.** Everything installed is a devDependency; the shipped JS is our code plus Svelte/SvelteKit output.
- Base path: `/tinkster`, overridable with env `BASE_PATH` (empty string for a custom domain).
- Colors only through CSS tokens (`--paper`, `--ink`, `--accent`, `--on-accent`). No hard-coded colors in components. No emoji in UI chrome.
- Light accent `#c93c25`, dark accent `#ff6a4d`, `--on-accent` `#ffffff` light / `#121212` dark. Paper `#f7f5f0` / `#121212`, ink `#161514` / `#ecebe6`.
- Games import only from `$lib/platform/...` and their own folder. `rules.ts` is pure: no DOM, no timers, no `Math.random`, no `Date`.
- All `localStorage` keys start with `tinkster:`.
- Tap targets ≥ 44px. Honor `prefers-reduced-motion`.
- Budgets: home route JS+CSS ≤ 100 KB gzipped, each game's chunk ≤ 50 KB gzipped, fonts ≤ 110 KB.
- Git: work on branch `feat/v1-foundation`. Conventional Commits. End every commit message with the trailer `Assisted-by: Claude Code (<model you are running as>)`. **Never** add `Co-Authored-By`. **Never** commit `CLAUDE.md`, `AI_DEVELOPER.md` or `CONTEXT.md`. Never merge; the author merges.
- `svelte-check` runs with `--fail-on-warnings`: fix a11y and compiler warnings, don't suppress them.

## Branch setup (before Task 1)

- [ ] If `main` has commits, run `git checkout main && git checkout -b feat/v1-foundation`. If `main` has no commits yet (fresh repo), branch from the spec branch: `git checkout docs/v1-design && git checkout -b feat/v1-foundation`.

## File map

```
.nvmrc  package.json  svelte.config.js  vite.config.ts  tsconfig.json  biome.json
playwright.config.ts  LICENSE  README.md  AGENTS.md  THIRD_PARTY.md
.github/workflows/ci.yml
scripts/check-size.mjs            size budget gate
scripts/make-icons.mjs            renders PWA icons with Playwright
static/manifest.webmanifest  static/icons/*  static/.nojekyll
src/app.html  src/app.d.ts
src/service-worker.ts
src/routes/+layout.ts             prerender + trailingSlash
src/routes/+layout.svelte         tokens, fonts, page shell
src/routes/+page.svelte           home
src/routes/play/[game]/+page.ts   entries() + load
src/routes/play/[game]/+page.svelte
src/lib/platform/
  types.ts                        the game contract
  rng.ts                          seeded PRNG
  save.ts                         resume slots + prefs
  registry.ts                     games[] + routableGames[] + findGame
  timer.ts  timer.svelte.ts       pure countdown + reactive rAF timer
  loop.ts                         fixed-step loop
  feedback.ts                     Web Audio sounds + haptics
  sw-paths.ts                     service-worker cache key helper
  input/swipe.ts                  swipe classification + turn buffer + DOM binding
  home/home.ts  GameTile.svelte  ResumeCard.svelte
  frame/session.svelte.ts         per-run GameSession (ctx, pause, saves)
  frame/setup.ts                  option resolution + test seed hook
  frame/GameFrame.svelte  TopBar.svelte  StartPanel.svelte  RulesSheet.svelte
  frame/MenuSheet.svelte  EndCard.svelte  Countdown.svelte  TimerStrip.svelte
  ui/tokens.css  ui/fonts/*.woff2
  ui/Button.svelte  ui/IconButton.svelte  ui/Sheet.svelte  ui/Stamp.svelte  ui/Wordmark.svelte
  testing/fixture/                test-only game (registered only when PUBLIC_TEST_HOOKS=1)
src/lib/games/break-the-code/
  index.ts  module.ts  rules.ts  rules.test.ts  View.svelte  HowToPlay.svelte  icon.svg
e2e/  frame.spec.ts  home.spec.ts  break-the-code.spec.ts  offline.spec.ts
      privacy.spec.ts  a11y.spec.ts  visual.spec.ts
docs/adding-a-game.md
```

---

### Task 1: Project scaffold and toolchain

**Files:**
- Create: `.nvmrc`, `package.json` (via npm), `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `biome.json`, `src/app.html`, `src/app.d.ts`, `src/routes/+layout.ts`, `src/routes/+page.svelte`, `LICENSE`
- Modify: `.gitignore` (already exists; verify entries)

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `build:test`, `preview`, `check`, `lint`, `format`, `test`. Global compile-time constant `__TEST_HOOKS__: boolean` (true only when built with `PUBLIC_TEST_HOOKS=1`).

- [ ] **Step 1: Create `.nvmrc` and initialise npm**

```bash
cd ~/dev/tinkster
echo 22 > .nvmrc
npm init -y >/dev/null
```

- [ ] **Step 2: Replace `package.json` with the project manifest**

```json
{
	"name": "tinkster",
	"version": "0.0.0",
	"private": true,
	"description": "Short, simple, offline mini-games for when you're stuck waiting. No accounts, no tracking.",
	"license": "MIT",
	"type": "module",
	"engines": { "node": ">=22" },
	"scripts": {
		"dev": "vite dev",
		"build": "vite build",
		"build:test": "PUBLIC_TEST_HOOKS=1 vite build",
		"preview": "vite preview",
		"check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings",
		"lint": "biome check .",
		"format": "biome check --write .",
		"test": "vitest run --passWithNoTests"
	}
}
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm i -D svelte@^5 @sveltejs/kit@^2 @sveltejs/adapter-static@^3 @sveltejs/vite-plugin-svelte@^7 \
  vite@^8 typescript@^6 svelte-check@^4 vitest@^5 fast-check@^4 @biomejs/biome@^2 @types/node@^22
```

Expected: installs without `ERESOLVE` peer errors. If npm reports a peer conflict, **do not** use `--force`. Read the conflicting range and pick the newest versions that satisfy all peers.

- [ ] **Step 4: Write `svelte.config.js`**

```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: { runes: true },
	kit: {
		adapter: adapter({ fallback: '404.html' }),
		paths: { base: process.env.BASE_PATH ?? '/tinkster' },
	},
};

export default config;
```

- [ ] **Step 5: Write `vite.config.ts`**

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		__TEST_HOOKS__: JSON.stringify(process.env.PUBLIC_TEST_HOOKS === '1'),
	},
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node',
	},
});
```

- [ ] **Step 6: Write `tsconfig.json`**

```json
{
	"extends": "./.svelte-kit/tsconfig.json",
	"compilerOptions": {
		"allowJs": true,
		"checkJs": true,
		"esModuleInterop": true,
		"forceConsistentCasingInFileNames": true,
		"resolveJsonModule": true,
		"skipLibCheck": true,
		"sourceMap": true,
		"strict": true,
		"moduleResolution": "bundler",
		"noImplicitOverride": true
	}
}
```

- [ ] **Step 7: Write `biome.json`**

Biome lints and formats TS/JS/JSON/CSS. `.svelte` files are checked by `svelte-check`, so Biome skips them.

```json
{
	"$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
	"vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
	"files": {
		"includes": ["**", "!**/*.svelte", "!build", "!.svelte-kit", "!docs/specs/mockups", "!static"]
	},
	"formatter": { "enabled": true, "indentStyle": "tab", "lineWidth": 100 },
	"javascript": { "formatter": { "quoteStyle": "single" } },
	"linter": { "enabled": true, "rules": { "recommended": true } }
}
```

Run `npx biome check .`. If Biome reports an unknown configuration key (its schema changes between minors), run `npx biome migrate --write` and re-run.

- [ ] **Step 8: Write `src/app.html`**

```html
<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
		<meta name="color-scheme" content="light dark" />
		<meta name="theme-color" content="#f7f5f0" media="(prefers-color-scheme: light)" />
		<meta name="theme-color" content="#121212" media="(prefers-color-scheme: dark)" />
		<meta name="description" content="Short, simple mini-games for when you're stuck waiting. No accounts, no tracking, works offline." />
		%sveltekit.head%
	</head>
	<body data-sveltekit-preload-data="hover">
		<div style="display: contents">%sveltekit.body%</div>
	</body>
</html>
```

- [ ] **Step 9: Write `src/app.d.ts`**

```ts
declare global {
	/** True only in builds made with PUBLIC_TEST_HOOKS=1 (the e2e build). */
	const __TEST_HOOKS__: boolean;
	namespace App {}
}

export {};
```

- [ ] **Step 10: Write `src/routes/+layout.ts` and a placeholder home**

`src/routes/+layout.ts`:

```ts
export const prerender = true;
export const trailingSlash = 'never';
```

`src/routes/+page.svelte`:

```svelte
<h1>tinkster</h1>
```

- [ ] **Step 11: Write `LICENSE` (MIT)**

Run `git config user.name` and use its output as the copyright holder:

```text
MIT License

Copyright (c) 2026 <output of `git config user.name`>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 12: Verify `.gitignore`**

It must contain at least: `.superpowers/`, `node_modules/`, `.svelte-kit/`, `build/`, `test-results/`, `playwright-report/`, `.DS_Store`, `CLAUDE.md`, `AI_DEVELOPER.md`, `CONTEXT.md`. Add any that are missing.

- [ ] **Step 13: Verify the toolchain end to end**

```bash
npm run check && npm run lint && npm test && npm run build && ls build/index.html
```

Expected: `svelte-check found 0 errors and 0 warnings`, Biome reports no errors, Vitest passes with no tests, and `build/index.html` exists. If Biome flags formatting in the files you just wrote, run `npm run format` and re-run.

- [ ] **Step 14: Commit**

```bash
git add .nvmrc package.json package-lock.json svelte.config.js vite.config.ts tsconfig.json biome.json src LICENSE .gitignore
git commit -m "build: scaffold SvelteKit static site with strict toolchain" -m "Assisted-by: Claude Code (<model>)"
```

---

### Task 2: Seeded random number generator

**Files:**
- Create: `src/lib/platform/rng.ts`
- Test: `src/lib/platform/rng.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Rng {
    next(): number;                              // [0, 1)
    int(min: number, max: number): number;       // inclusive; throws RangeError if max < min or non-integers
    pick<T>(items: readonly T[]): T;             // throws RangeError on empty
    shuffle<T>(items: readonly T[]): T[];        // new array; input untouched
  }
  export function createRng(seed: number): Rng;
  export function randomSeed(): number;          // uint32 from crypto.getRandomValues
  ```

- [ ] **Step 1: Write the failing tests**

`src/lib/platform/rng.test.ts`:

```ts
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRng, randomSeed } from './rng';

const sequence = (seed: number, n = 16) => {
	const rng = createRng(seed);
	return Array.from({ length: n }, () => rng.next());
};

describe('createRng', () => {
	it('is deterministic for a given seed', () => {
		fc.assert(
			fc.property(fc.integer(), (seed) => {
				expect(sequence(seed)).toEqual(sequence(seed));
			}),
		);
	});

	it('produces different sequences for different seeds', () => {
		expect(sequence(1)).not.toEqual(sequence(2));
	});

	it('next() stays within [0, 1)', () => {
		fc.assert(
			fc.property(fc.integer(), (seed) => {
				for (const v of sequence(seed, 64)) {
					expect(v).toBeGreaterThanOrEqual(0);
					expect(v).toBeLessThan(1);
				}
			}),
		);
	});

	it('int(min, max) stays within inclusive bounds', () => {
		fc.assert(
			fc.property(
				fc.integer(),
				fc.integer({ min: -1000, max: 1000 }),
				fc.integer({ min: 0, max: 1000 }),
				(seed, min, span) => {
					const v = createRng(seed).int(min, min + span);
					expect(Number.isInteger(v)).toBe(true);
					expect(v).toBeGreaterThanOrEqual(min);
					expect(v).toBeLessThanOrEqual(min + span);
				},
			),
		);
	});

	it('int() rejects an empty or fractional range', () => {
		expect(() => createRng(1).int(5, 4)).toThrow(RangeError);
		expect(() => createRng(1).int(0.5, 4)).toThrow(RangeError);
	});

	it('shuffle() returns a permutation and leaves the input untouched', () => {
		fc.assert(
			fc.property(fc.integer(), fc.array(fc.integer()), (seed, items) => {
				const copy = [...items];
				const shuffled = createRng(seed).shuffle(items);
				expect(items).toEqual(copy);
				expect([...shuffled].sort((a, b) => a - b)).toEqual([...items].sort((a, b) => a - b));
			}),
		);
	});

	it('pick() returns an element of the array and rejects empty arrays', () => {
		fc.assert(
			fc.property(fc.integer(), fc.array(fc.string(), { minLength: 1 }), (seed, items) => {
				expect(items).toContain(createRng(seed).pick(items));
			}),
		);
		expect(() => createRng(1).pick([])).toThrow(RangeError);
	});
});

describe('randomSeed', () => {
	it('returns a uint32', () => {
		const s = randomSeed();
		expect(Number.isInteger(s)).toBe(true);
		expect(s).toBeGreaterThanOrEqual(0);
		expect(s).toBeLessThanOrEqual(0xffffffff);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/platform/rng.test.ts`
Expected: FAIL, `Failed to resolve import "./rng"`.

- [ ] **Step 3: Implement `src/lib/platform/rng.ts`**

```ts
/** Seeded PRNG: sfc32, seeded from one 32-bit integer via splitmix32. */
export interface Rng {
	/** Uniform float in [0, 1). */
	next(): number;
	/** Uniform integer in [min, max], inclusive. */
	int(min: number, max: number): number;
	pick<T>(items: readonly T[]): T;
	/** Fisher–Yates; returns a new array. */
	shuffle<T>(items: readonly T[]): T[];
}

function splitmix32(seed: number): () => number {
	let a = seed | 0;
	return () => {
		a = (a + 0x9e3779b9) | 0;
		let t = a ^ (a >>> 16);
		t = Math.imul(t, 0x21f0aaad);
		t ^= t >>> 15;
		t = Math.imul(t, 0x735a2d97);
		t ^= t >>> 15;
		return t >>> 0;
	};
}

export function createRng(seed: number): Rng {
	const init = splitmix32(seed);
	let a = init();
	let b = init();
	let c = init();
	let d = init();

	const next32 = (): number => {
		let t = (a + b) | 0;
		a = b ^ (b >>> 9);
		b = (c + (c << 3)) | 0;
		c = (c << 21) | (c >>> 11);
		d = (d + 1) | 0;
		t = (t + d) | 0;
		c = (c + t) | 0;
		return t >>> 0;
	};

	const next = () => next32() / 4294967296;

	const int = (min: number, max: number) => {
		if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
			throw new RangeError(`invalid range [${min}, ${max}]`);
		}
		return min + Math.floor(next() * (max - min + 1));
	};

	return {
		next,
		int,
		pick<T>(items: readonly T[]): T {
			if (items.length === 0) throw new RangeError('cannot pick from an empty array');
			return items[int(0, items.length - 1)] as T;
		},
		shuffle<T>(items: readonly T[]): T[] {
			const out = [...items];
			for (let i = out.length - 1; i > 0; i--) {
				const j = int(0, i);
				[out[i], out[j]] = [out[j] as T, out[i] as T];
			}
			return out;
		},
	};
}

export function randomSeed(): number {
	return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/platform/rng.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
git add src/lib/platform/rng.ts src/lib/platform/rng.test.ts
git commit -m "feat(platform): add seeded sfc32 random number generator" -m "Assisted-by: Claude Code (<model>)"
```

---

### Task 3: Game contract types and saves (resume slots + preferences)

**Files:**
- Create: `src/lib/platform/types.ts`, `src/lib/platform/save.ts`
- Test: `src/lib/platform/save.test.ts`

**Interfaces:**
- Consumes: `Rng` from Task 2.
- Produces (`types.ts`): the full contract. Later tasks import these exact names:
  ```ts
  export type Category = 'words' | 'logic' | 'arcade';
  export type Pace = 'turn-based' | 'timed' | 'realtime';
  export type Options = Record<string, string>;
  export interface OptionChoice { value: string; label: string; hint?: string }
  export interface OptionField { key: string; label: string; default: string; choices: OptionChoice[] }
  export type SoundName = 'tick' | 'pop' | 'stamp' | 'fail';
  export type HapticName = 'tap' | 'success' | 'error';
  export interface Feedback { sound(name: SoundName): void; haptic(name: HapticName): void }
  export interface PausableTimer { readonly durationMs: number; readonly remainingMs: number; readonly expired: boolean; stop(): void }
  export interface GameResult { stamp: string; headline: string; detail?: string; reveal?: Snippet }
  export interface GameContext<S> { save(state: S): void; finish(result: GameResult): void; setMeta(left: string, right?: string): void; readonly paused: boolean; readonly rng: Rng; readonly feedback: Feedback; timer(durationMs: number, onExpire: () => void): PausableTimer }
  export interface GameProps<S, O extends Options = Options> { options: O; saved: S | null; ctx: GameContext<S> }
  export interface GameModule<S, O extends Options = Options> { View: Component<GameProps<S, O>>; Rules: Component; progressLabel(state: S): string }
  export interface GameDefinition<S = unknown, O extends Options = Options> { id; title; pitch; category; pace; minutes: [number, number]; icon: string; saveVersion: number; options?: OptionField[]; load(): Promise<GameModule<S, O>> }
  export type AnyGame = GameDefinition<unknown, Options>;
  export function defineGame<S, O extends Options>(def: GameDefinition<S, O>): AnyGame;
  ```
- Produces (`save.ts`):
  ```ts
  export interface KeyValueStore { get(key: string): string | null; set(key: string, value: string): void; remove(key: string): void; keys(): string[] }
  export function memoryStore(): KeyValueStore;
  export function browserStore(): KeyValueStore;   // localStorage, or memory if unavailable
  export interface ResumeSlot<S = unknown> { gameId: string; saveVersion: number; savedAt: number; label: string; options: Options; state: S }
  export type SlotSummary = Omit<ResumeSlot, 'options' | 'state'>;
  export interface Prefs { sound: boolean; options: Record<string, Options> }
  export function defaultPrefs(): Prefs;
  export function createSaves(store: KeyValueStore): Saves;
  export interface Saves { readSlot<S>(gameId: string, saveVersion: number): ResumeSlot<S> | null; writeSlot<S>(slot: ResumeSlot<S>): void; clearSlot(gameId: string): void; listSlots(): SlotSummary[]; readPrefs(): Prefs; writePrefs(prefs: Prefs): void }
  ```

- [ ] **Step 1: Write `src/lib/platform/types.ts`**

It holds only types plus one identity helper, so it has no test of its own; the registry contract test (Task 4) and `svelte-check` cover it.

```ts
import type { Component, Snippet } from 'svelte';
import type { Rng } from './rng';

export type Category = 'words' | 'logic' | 'arcade';
/** timed and realtime games get a 3-2-1 countdown whenever play resumes. */
export type Pace = 'turn-based' | 'timed' | 'realtime';
/** Every game option is a string enum, e.g. { difficulty: 'normal' }. */
export type Options = Record<string, string>;

export interface OptionChoice {
	value: string;
	label: string;
	hint?: string;
}

export interface OptionField {
	key: string;
	label: string;
	default: string;
	choices: OptionChoice[];
}

export type SoundName = 'tick' | 'pop' | 'stamp' | 'fail';
export type HapticName = 'tap' | 'success' | 'error';

export interface Feedback {
	sound(name: SoundName): void;
	haptic(name: HapticName): void;
}

export interface PausableTimer {
	readonly durationMs: number;
	/** Reactive: updates every animation frame while running. */
	readonly remainingMs: number;
	readonly expired: boolean;
	stop(): void;
}

export interface GameResult {
	/** Stamped headline, e.g. 'Cracked!'. */
	stamp: string;
	/** Result line, e.g. '5 guesses'. */
	headline: string;
	detail?: string;
	/** Rendered under the headline: the answer, the best solution, ... */
	reveal?: Snippet;
}

export interface GameContext<S> {
	/** Debounced write of a JSON-serializable snapshot to this game's resume slot. */
	save(state: S): void;
	/** Clears the resume slot and shows the end card. Later save() calls are ignored. */
	finish(result: GameResult): void;
	/** The two status strings under the top bar. */
	setMeta(left: string, right?: string): void;
	/** Reactive. True while a sheet, the resume countdown, a hidden tab or the end card is up. */
	readonly paused: boolean;
	readonly rng: Rng;
	readonly feedback: Feedback;
	/** A countdown that freezes while paused; the frame shows it as the red timer strip. */
	timer(durationMs: number, onExpire: () => void): PausableTimer;
}

export interface GameProps<S, O extends Options = Options> {
	options: O;
	saved: S | null;
	ctx: GameContext<S>;
}

export interface GameModule<S, O extends Options = Options> {
	View: Component<GameProps<S, O>>;
	/** Content of the rules sheet. */
	Rules: Component;
	/** Short progress text for the home resume card, e.g. 'guess 4 of 8'. */
	progressLabel(state: S): string;
}

export interface GameDefinition<S = unknown, O extends Options = Options> {
	/** URL slug, e.g. 'break-the-code'. */
	id: string;
	title: string;
	/** One line for the home tile. */
	pitch: string;
	category: Category;
	pace: Pace;
	minutes: [min: number, max: number];
	/** Raw SVG markup (import './icon.svg?raw'). Use class="accent" for the red detail. */
	icon: string;
	/** Bump when the saved state shape changes; older saves are discarded. */
	saveVersion: number;
	/** Rendered as the start panel. Omit for games without options. */
	options?: OptionField[];
	/** Dynamic import, so each game is its own chunk. */
	load(): Promise<GameModule<S, O>>;
}

export type AnyGame = GameDefinition<unknown, Options>;

/** Type-checks a game definition, then erases its generics for the registry. */
export function defineGame<S, O extends Options>(def: GameDefinition<S, O>): AnyGame {
	return def as unknown as AnyGame;
}
```

- [ ] **Step 2: Write the failing save tests**

`src/lib/platform/save.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserStore, createSaves, defaultPrefs, memoryStore, type ResumeSlot } from './save';

const slot = (over: Partial<ResumeSlot<{ n: number }>> = {}): ResumeSlot<{ n: number }> => ({
	gameId: 'demo',
	saveVersion: 1,
	savedAt: 1000,
	label: 'turn 2',
	options: { level: 'easy' },
	state: { n: 2 },
	...over,
});

describe('resume slots', () => {
	it('round-trips a slot', () => {
		const saves = createSaves(memoryStore());
		saves.writeSlot(slot());
		expect(saves.readSlot('demo', 1)).toEqual(slot());
	});

	it('returns null when there is no slot', () => {
		expect(createSaves(memoryStore()).readSlot('demo', 1)).toBeNull();
	});

	it('discards and deletes a slot whose saveVersion differs', () => {
		const store = memoryStore();
		const saves = createSaves(store);
		saves.writeSlot(slot({ saveVersion: 1 }));
		expect(saves.readSlot('demo', 2)).toBeNull();
		expect(store.get('tinkster:slot:demo')).toBeNull();
	});

	it('discards and deletes corrupt JSON', () => {
		const store = memoryStore();
		store.set('tinkster:slot:demo', '{not json');
		expect(createSaves(store).readSlot('demo', 1)).toBeNull();
		expect(store.get('tinkster:slot:demo')).toBeNull();
	});

	it('discards a slot with a missing field or wrong gameId', () => {
		const store = memoryStore();
		const saves = createSaves(store);
		store.set('tinkster:slot:demo', JSON.stringify({ ...slot(), label: 42 }));
		expect(saves.readSlot('demo', 1)).toBeNull();
		store.set('tinkster:slot:demo', JSON.stringify(slot({ gameId: 'other' })));
		expect(saves.readSlot('demo', 1)).toBeNull();
	});

	it('clearSlot removes the slot', () => {
		const saves = createSaves(memoryStore());
		saves.writeSlot(slot());
		saves.clearSlot('demo');
		expect(saves.readSlot('demo', 1)).toBeNull();
	});

	it('listSlots summarizes valid slots and drops corrupt ones', () => {
		const store = memoryStore();
		const saves = createSaves(store);
		saves.writeSlot(slot());
		saves.writeSlot(slot({ gameId: 'other', savedAt: 2000, label: 'turn 9' }));
		store.set('tinkster:slot:broken', 'nope');
		store.set('unrelated', 'x');
		const list = saves.listSlots().sort((a, b) => a.savedAt - b.savedAt);
		expect(list).toEqual([
			{ gameId: 'demo', saveVersion: 1, savedAt: 1000, label: 'turn 2' },
			{ gameId: 'other', saveVersion: 1, savedAt: 2000, label: 'turn 9' },
		]);
		expect(store.get('tinkster:slot:broken')).toBeNull();
		expect(store.get('unrelated')).toBe('x');
	});
});

describe('preferences', () => {
	it('defaults to sound off and no options', () => {
		expect(createSaves(memoryStore()).readPrefs()).toEqual({ sound: false, options: {} });
	});

	it('round-trips', () => {
		const saves = createSaves(memoryStore());
		saves.writePrefs({ sound: true, options: { demo: { level: 'hard' } } });
		expect(saves.readPrefs()).toEqual({ sound: true, options: { demo: { level: 'hard' } } });
	});

	it('falls back to defaults on a malformed value', () => {
		const store = memoryStore();
		store.set('tinkster:prefs', JSON.stringify({ sound: 'yes', options: [] }));
		expect(createSaves(store).readPrefs()).toEqual(defaultPrefs());
	});

	it('drops non-string option values but keeps valid ones', () => {
		const store = memoryStore();
		store.set(
			'tinkster:prefs',
			JSON.stringify({ sound: false, options: { a: { level: 'easy', n: 3 }, b: 'x' } }),
		);
		expect(createSaves(store).readPrefs()).toEqual({ sound: false, options: { a: { level: 'easy' } } });
	});
});

describe('browserStore', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('falls back to memory when localStorage throws', () => {
		vi.stubGlobal('localStorage', {
			setItem() {
				throw new Error('SecurityError');
			},
		});
		const store = browserStore();
		store.set('k', 'v');
		expect(store.get('k')).toBe('v');
	});

	it('uses localStorage when it works', () => {
		const backing = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (k: string) => backing.get(k) ?? null,
			setItem: (k: string, v: string) => backing.set(k, v),
			removeItem: (k: string) => backing.delete(k),
			key: (i: number) => [...backing.keys()][i] ?? null,
			get length() {
				return backing.size;
			},
		});
		const store = browserStore();
		store.set('tinkster:x', '1');
		expect(backing.get('tinkster:x')).toBe('1');
		expect(store.keys()).toEqual(['tinkster:x']);
	});
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/platform/save.test.ts`
Expected: FAIL, `Failed to resolve import "./save"`.

- [ ] **Step 4: Implement `src/lib/platform/save.ts`**

```ts
import type { Options } from './types';

export interface KeyValueStore {
	get(key: string): string | null;
	set(key: string, value: string): void;
	remove(key: string): void;
	keys(): string[];
}

export function memoryStore(): KeyValueStore {
	const map = new Map<string, string>();
	return {
		get: (k) => map.get(k) ?? null,
		set: (k, v) => {
			map.set(k, v);
		},
		remove: (k) => {
			map.delete(k);
		},
		keys: () => [...map.keys()],
	};
}

/** localStorage when usable; otherwise (private mode, blocked storage, SSR) an in-memory store. */
export function browserStore(): KeyValueStore {
	try {
		const ls = globalThis.localStorage;
		const probe = 'tinkster:probe';
		ls.setItem(probe, '1');
		ls.removeItem(probe);
		return {
			get: (k) => ls.getItem(k),
			set: (k, v) => {
				try {
					ls.setItem(k, v);
				} catch {
					// Quota exceeded: resume is best-effort, so drop the write.
				}
			},
			remove: (k) => ls.removeItem(k),
			keys: () => Array.from({ length: ls.length }, (_, i) => ls.key(i)).filter((k) => k !== null),
		};
	} catch {
		return memoryStore();
	}
}

const SLOT_PREFIX = 'tinkster:slot:';
const PREFS_KEY = 'tinkster:prefs';

export interface ResumeSlot<S = unknown> {
	gameId: string;
	saveVersion: number;
	savedAt: number;
	label: string;
	options: Options;
	state: S;
}

export type SlotSummary = Omit<ResumeSlot, 'options' | 'state'>;

export interface Prefs {
	sound: boolean;
	/** Last-used options per game id. */
	options: Record<string, Options>;
}

export interface Saves {
	readSlot<S>(gameId: string, saveVersion: number): ResumeSlot<S> | null;
	writeSlot<S>(slot: ResumeSlot<S>): void;
	clearSlot(gameId: string): void;
	listSlots(): SlotSummary[];
	readPrefs(): Prefs;
	writePrefs(prefs: Prefs): void;
}

export function defaultPrefs(): Prefs {
	return { sound: false, options: {} };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

function stringOptions(v: unknown): Options | null {
	if (!isRecord(v)) return null;
	const out: Options = {};
	for (const [k, val] of Object.entries(v)) if (typeof val === 'string') out[k] = val;
	return out;
}

function parseSlot(raw: string): ResumeSlot | null {
	try {
		const v: unknown = JSON.parse(raw);
		if (!isRecord(v)) return null;
		const options = stringOptions(v.options);
		if (
			typeof v.gameId !== 'string' ||
			typeof v.saveVersion !== 'number' ||
			typeof v.savedAt !== 'number' ||
			typeof v.label !== 'string' ||
			options === null ||
			!('state' in v)
		) {
			return null;
		}
		return {
			gameId: v.gameId,
			saveVersion: v.saveVersion,
			savedAt: v.savedAt,
			label: v.label,
			options,
			state: v.state,
		};
	} catch {
		return null;
	}
}

export function createSaves(store: KeyValueStore): Saves {
	return {
		readSlot<S>(gameId: string, saveVersion: number): ResumeSlot<S> | null {
			const raw = store.get(SLOT_PREFIX + gameId);
			if (raw === null) return null;
			const slot = parseSlot(raw);
			if (!slot || slot.gameId !== gameId || slot.saveVersion !== saveVersion) {
				store.remove(SLOT_PREFIX + gameId);
				return null;
			}
			return slot as ResumeSlot<S>;
		},

		writeSlot(slot) {
			store.set(SLOT_PREFIX + slot.gameId, JSON.stringify(slot));
		},

		clearSlot(gameId) {
			store.remove(SLOT_PREFIX + gameId);
		},

		listSlots() {
			const out: SlotSummary[] = [];
			for (const key of store.keys()) {
				if (!key.startsWith(SLOT_PREFIX)) continue;
				const raw = store.get(key);
				const slot = raw === null ? null : parseSlot(raw);
				if (!slot) {
					store.remove(key);
					continue;
				}
				out.push({
					gameId: slot.gameId,
					saveVersion: slot.saveVersion,
					savedAt: slot.savedAt,
					label: slot.label,
				});
			}
			return out;
		},

		readPrefs() {
			const raw = store.get(PREFS_KEY);
			if (raw === null) return defaultPrefs();
			try {
				const v: unknown = JSON.parse(raw);
				if (!isRecord(v) || typeof v.sound !== 'boolean' || !isRecord(v.options)) {
					return defaultPrefs();
				}
				const options: Record<string, Options> = {};
				for (const [gameId, opts] of Object.entries(v.options)) {
					const parsed = stringOptions(opts);
					if (parsed) options[gameId] = parsed;
				}
				return { sound: v.sound, options };
			} catch {
				return defaultPrefs();
			}
		},

		writePrefs(prefs) {
			store.set(PREFS_KEY, JSON.stringify(prefs));
		},
	};
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/platform/save.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 6: Type-check, lint, commit**

```bash
npm run check && npm run lint
git add src/lib/platform/types.ts src/lib/platform/save.ts src/lib/platform/save.test.ts
git commit -m "feat(platform): add game contract types and versioned resume slots" -m "Assisted-by: Claude Code (<model>)"
```

---

### Task 4: Registry and home helpers

**Files:**
- Create: `src/lib/platform/registry.ts`, `src/lib/platform/registry.test.ts`, `src/lib/platform/home/home.ts`
- Test: `src/lib/platform/home/home.test.ts`

**Interfaces:**
- Consumes: `AnyGame`, `Category` (Task 3); `SlotSummary` (Task 3).
- Produces:
  ```ts
  // registry.ts
  export const games: AnyGame[];            // shown on home (real games only)
  export const routableGames: AnyGame[];    // games + test fixtures (fixtures only when __TEST_HOOKS__)
  export function findGame(id: string): AnyGame | undefined;   // searches routableGames
  export const CATEGORIES: { id: Category; label: string }[];  // fixed home order
  // home/home.ts
  export interface Section { id: Category; label: string; games: AnyGame[] }
  export function groupByCategory(list: AnyGame[]): Section[];  // CATEGORIES order, empty sections omitted
  export interface ResumeEntry { game: AnyGame; label: string; savedAt: number }
  export function latestResume(slots: SlotSummary[], list: AnyGame[]): ResumeEntry | null;
  export function formatMinutes([min, max]: [number, number]): string;   // '2–10m' | '3m'
  ```

- [ ] **Step 1: Write the failing home helper tests**

`src/lib/platform/home/home.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { AnyGame, Category } from '../types';
import { formatMinutes, groupByCategory, latestResume } from './home';

const game = (id: string, category: Category, saveVersion = 1): AnyGame => ({
	id,
	title: id.toUpperCase(),
	pitch: 'p',
	category,
	pace: 'turn-based',
	minutes: [1, 2],
	icon: '<svg></svg>',
	saveVersion,
	load: async () => {
		throw new Error('not used');
	},
});

describe('groupByCategory', () => {
	it('orders sections words → logic → arcade and omits empty ones', () => {
		const list = [game('snake', 'arcade'), game('code', 'logic'), game('lock', 'logic')];
		expect(groupByCategory(list).map((s) => [s.id, s.label, s.games.map((g) => g.id)])).toEqual([
			['logic', 'Logic', ['code', 'lock']],
			['arcade', 'Arcade', ['snake']],
		]);
	});
});

describe('latestResume', () => {
	const list = [game('a', 'logic'), game('b', 'logic', 2)];

	it('returns the most recently saved slot of a registered game', () => {
		const entry = latestResume(
			[
				{ gameId: 'a', saveVersion: 1, savedAt: 10, label: 'old' },
				{ gameId: 'b', saveVersion: 2, savedAt: 20, label: 'new' },
			],
			list,
		);
		expect(entry?.game.id).toBe('b');
		expect(entry?.label).toBe('new');
	});

	it('ignores unknown games and stale save versions', () => {
		expect(
			latestResume(
				[
					{ gameId: 'zzz', saveVersion: 1, savedAt: 99, label: 'x' },
					{ gameId: 'b', saveVersion: 1, savedAt: 50, label: 'stale' },
				],
				list,
			),
		).toBeNull();
	});
});

describe('formatMinutes', () => {
	it('formats a range and a single value', () => {
		expect(formatMinutes([2, 10])).toBe('2–10m');
		expect(formatMinutes([3, 3])).toBe('3m');
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/platform/home/home.test.ts`
Expected: FAIL, `Failed to resolve import "./home"`.

- [ ] **Step 3: Implement `src/lib/platform/registry.ts`**

`testGames` stays empty until Task 10 registers the fixture game.

```ts
import type { AnyGame, Category } from './types';

/**
 * Every playable game, one line each. Order within a category is the order on the home screen.
 * Adding a game = import its definition and add it here. See docs/adding-a-game.md.
 */
export const games: AnyGame[] = [];

/** Test-only games, compiled in only for the e2e build (PUBLIC_TEST_HOOKS=1). */
const testGames: AnyGame[] = [];

/** Everything that gets a /play/<id> route. */
export const routableGames: AnyGame[] = [...games, ...testGames];

export function findGame(id: string): AnyGame | undefined {
	return routableGames.find((g) => g.id === id);
}

export const CATEGORIES: { id: Category; label: string }[] = [
	{ id: 'words', label: 'Words & numbers' },
	{ id: 'logic', label: 'Logic' },
	{ id: 'arcade', label: 'Arcade' },
];
```

- [ ] **Step 4: Implement `src/lib/platform/home/home.ts`**

```ts
import { CATEGORIES } from '../registry';
import type { SlotSummary } from '../save';
import type { AnyGame, Category } from '../types';

export interface Section {
	id: Category;
	label: string;
	games: AnyGame[];
}

export function groupByCategory(list: AnyGame[]): Section[] {
	return CATEGORIES.map((c) => ({ ...c, games: list.filter((g) => g.category === c.id) })).filter(
		(s) => s.games.length > 0,
	);
}

export interface ResumeEntry {
	game: AnyGame;
	label: string;
	savedAt: number;
}

export function latestResume(slots: SlotSummary[], list: AnyGame[]): ResumeEntry | null {
	let best: ResumeEntry | null = null;
	for (const slot of slots) {
		const game = list.find((g) => g.id === slot.gameId);
		if (!game || game.saveVersion !== slot.saveVersion) continue;
		if (!best || slot.savedAt > best.savedAt) {
			best = { game, label: slot.label, savedAt: slot.savedAt };
		}
	}
	return best;
}

export function formatMinutes([min, max]: [number, number]): string {
	return min === max ? `${min}m` : `${min}–${max}m`;
}
```

- [ ] **Step 5: Run the home tests to verify they pass**

Run: `npx vitest run src/lib/platform/home/home.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Write the registry contract test**

This test is what makes "add a folder + one line" safe: every registered game must satisfy it. It loops over `games`, which is empty until Task 13; the uniqueness test runs regardless.

`src/lib/platform/registry.test.ts`:

```ts
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { games } from './registry';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('registry', () => {
	it('has unique ids', () => {
		const ids = games.map((g) => g.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	for (const game of games) {
		describe(game.id, () => {
			it('has valid metadata', () => {
				expect(game.id).toMatch(SLUG);
				expect(game.title.trim()).not.toBe('');
				expect(game.pitch.trim()).not.toBe('');
				expect(game.pitch.length).toBeLessThanOrEqual(40);
				const [min, max] = game.minutes;
				expect(min).toBeGreaterThanOrEqual(1);
				expect(max).toBeLessThanOrEqual(15);
				expect(min).toBeLessThanOrEqual(max);
				expect(Number.isInteger(game.saveVersion) && game.saveVersion > 0).toBe(true);
				expect(game.icon.trim().startsWith('<svg')).toBe(true);
			});

			it('has well-formed options', () => {
				const keys = (game.options ?? []).map((o) => o.key);
				expect(new Set(keys).size).toBe(keys.length);
				for (const field of game.options ?? []) {
					expect(field.choices.length).toBeGreaterThan(0);
					expect(field.choices.map((c) => c.value)).toContain(field.default);
				}
			});

			it('lazy-loads a complete module', async () => {
				const mod = await game.load();
				expect(typeof mod.View).toBe('function');
				expect(typeof mod.Rules).toBe('function');
				expect(typeof mod.progressLabel).toBe('function');
			});

			it('has rules tests', () => {
				expect(existsSync(resolve(`src/lib/games/${game.id}/rules.test.ts`))).toBe(true);
			});
		});
	}
});
```

- [ ] **Step 7: Run all tests, type-check, lint**

Run: `npm test && npm run check && npm run lint`
Expected: all PASS, 0 errors, 0 warnings.

- [ ] **Step 8: Commit**

```bash
git add src/lib/platform/registry.ts src/lib/platform/registry.test.ts src/lib/platform/home
git commit -m "feat(platform): add game registry, contract test and home helpers" -m "Assisted-by: Claude Code (<model>)"
```

---

### Task 5: Visual system (tokens, fonts, UI primitives, page shell)

**Files:**
- Create: `src/lib/platform/ui/tokens.css`, `src/lib/platform/ui/fonts/` (3 woff2 + 2 OFL texts), `src/lib/platform/ui/Button.svelte`, `IconButton.svelte`, `Sheet.svelte`, `Stamp.svelte`, `Wordmark.svelte`, `src/routes/+layout.svelte`
- Modify: `src/routes/+page.svelte` (temporary showcase, replaced in Task 11)

**Interfaces:**
- Produces CSS custom properties (global): `--paper --ink --accent --on-accent --ink-soft --ink-faint --font-display --font-ui --radius --radius-sm --line --shadow --shadow-sm --gutter --tap --max-width --ease-out --dur-fast --dur`. Global classes: `.tabular`, `.sr-only`, `.tx-dots`, `.tx-lines`, `.tx-grid`.
- Produces components:
  - `Button` props: `variant?: 'outline' | 'ink' | 'accent'` (default `'outline'`), `children: Snippet`, plus any `<button>` attribute.
  - `IconButton` props: `label: string` (becomes `aria-label`), `children: Snippet`, plus `<button>` attributes.
  - `Sheet` props: `title: string`, `onclose: () => void`, `children: Snippet`. It is a modal `<dialog>`; Escape calls `onclose`.
  - `Stamp` props: `text: string`.
  - `Wordmark`: no props.

This task has no unit tests: these are presentational. They are covered by the e2e, axe and visual-regression gates in Tasks 10–15. Verification here is `svelte-check` (which includes a11y lint) plus a build.

- [ ] **Step 1: Vendor the Latin font subsets**

```bash
T=$(mktemp -d)
( cd "$T" && npm pack -s @fontsource-variable/fraunces@5 @fontsource/fraunces@5 @fontsource-variable/inter@5 >/dev/null \
  && for f in *.tgz; do mkdir "${f%.tgz}" && tar xzf "$f" -C "${f%.tgz}"; done )
D=src/lib/platform/ui/fonts && mkdir -p $D
cp "$T"/fontsource-variable-fraunces-*/package/files/fraunces-latin-wght-normal.woff2 $D/fraunces-wght.woff2
cp "$T"/fontsource-fraunces-*/package/files/fraunces-latin-700-italic.woff2 $D/fraunces-700-italic.woff2
cp "$T"/fontsource-variable-inter-*/package/files/inter-latin-wght-normal.woff2 $D/inter-wght.woff2
cp "$T"/fontsource-variable-fraunces-*/package/LICENSE $D/OFL-Fraunces.txt
cp "$T"/fontsource-variable-inter-*/package/LICENSE $D/OFL-Inter.txt
ls -l $D && du -ch $D/*.woff2 | tail -1
```

Expected: three woff2 files, about 37 KB, 23 KB and 48 KB (≈108 KB total, within the 110 KB budget). Record the three package versions shown by `ls "$T"`; they go into `THIRD_PARTY.md` in Task 17.

- [ ] **Step 2: Write `src/lib/platform/ui/tokens.css`**

```css
/* Design tokens: the only place colors are defined. See spec §6. */

@font-face {
	font-family: 'Fraunces';
	src: url('./fonts/fraunces-wght.woff2') format('woff2');
	font-weight: 100 900;
	font-style: normal;
	font-display: swap;
	unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304,
		U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

@font-face {
	font-family: 'Fraunces';
	src: url('./fonts/fraunces-700-italic.woff2') format('woff2');
	font-weight: 700;
	font-style: italic;
	font-display: swap;
	unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304,
		U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

@font-face {
	font-family: 'Inter';
	src: url('./fonts/inter-wght.woff2') format('woff2');
	font-weight: 100 900;
	font-style: normal;
	font-display: swap;
	unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304,
		U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

:root {
	color-scheme: light dark;
	--paper: #f7f5f0;
	--ink: #161514;
	--accent: #c93c25;
	--on-accent: #ffffff;
	--ink-soft: color-mix(in srgb, var(--ink) 62%, transparent);
	--ink-faint: color-mix(in srgb, var(--ink) 16%, transparent);

	--font-display: 'Fraunces', Georgia, serif;
	--font-ui: 'Inter', system-ui, -apple-system, sans-serif;

	--line: 1.5px;
	--radius: 12px;
	--radius-sm: 8px;
	--shadow: 3px 3px 0 var(--ink);
	--shadow-sm: 2px 2px 0 var(--ink);
	--gutter: 16px;
	--tap: 44px;
	--max-width: 480px;

	--ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
	--dur-fast: 120ms;
	--dur: 200ms;
}

@media (prefers-color-scheme: dark) {
	:root {
		--paper: #121212;
		--ink: #ecebe6;
		--accent: #ff6a4d;
		--on-accent: #121212;
	}
}

*,
*::before,
*::after {
	box-sizing: border-box;
}

html,
body {
	margin: 0;
	background: var(--paper);
	color: var(--ink);
	font-family: var(--font-ui);
	-webkit-font-smoothing: antialiased;
	-webkit-tap-highlight-color: transparent;
	-webkit-text-size-adjust: 100%;
}

button {
	font: inherit;
	color: inherit;
}

h1,
h2,
h3 {
	font-family: var(--font-display);
	font-weight: 600;
	margin: 0;
}

.tabular {
	font-variant-numeric: tabular-nums;
}

.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
	white-space: nowrap;
	border: 0;
}

/* Category halftones (spec §5.1): dots = words, lines = logic, grid = arcade. */
.tx-dots {
	background-image: radial-gradient(var(--ink) 1.1px, transparent 1.3px);
	background-size: 7px 7px;
}
.tx-lines {
	background-image: repeating-linear-gradient(45deg, var(--ink) 0 1px, transparent 1px 6px);
}
.tx-grid {
	background-image:
		linear-gradient(var(--ink) 1px, transparent 1px),
		linear-gradient(90deg, var(--ink) 1px, transparent 1px);
	background-size: 8px 8px;
}

/* ::backdrop does not reliably inherit custom properties, so the scrim is spelled out here. */
dialog::backdrop {
	background: rgb(22 21 20 / 0.45);
}

@media (prefers-reduced-motion: reduce) {
	*,
	*::before,
	*::after {
		animation-duration: 1ms !important;
		animation-delay: 0ms !important;
		animation-iteration-count: 1 !important;
		transition-duration: 1ms !important;
	}
}
```

- [ ] **Step 3: Write `src/lib/platform/ui/Button.svelte`**

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: 'outline' | 'ink' | 'accent';
		children: Snippet;
	}

	let { variant = 'outline', children, ...rest }: Props = $props();
</script>

<button class="btn {variant}" {...rest}>{@render children()}</button>

<style>
	.btn {
		min-height: var(--tap);
		padding: 0 18px;
		border: var(--line) solid var(--ink);
		border-radius: 10px;
		background: var(--paper);
		font-weight: 700;
		font-size: 15px;
		box-shadow: var(--shadow-sm);
		cursor: pointer;
		touch-action: manipulation;
		transition:
			transform var(--dur-fast) var(--ease-out),
			box-shadow var(--dur-fast) var(--ease-out);
	}
	.btn:active:not(:disabled) {
		transform: translate(2px, 2px);
		box-shadow: 0 0 0 var(--ink);
	}
	.btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.btn:disabled {
		opacity: 0.35;
		box-shadow: none;
		cursor: default;
	}
	.ink {
		background: var(--ink);
		color: var(--paper);
	}
	.accent {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--on-accent);
	}
</style>
```

- [ ] **Step 4: Write `src/lib/platform/ui/IconButton.svelte`**

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		label: string;
		children: Snippet;
	}

	let { label, children, ...rest }: Props = $props();
</script>

<button class="icon-btn" aria-label={label} title={label} {...rest}>{@render children()}</button>

<style>
	.icon-btn {
		flex: none;
		width: var(--tap);
		height: var(--tap);
		display: grid;
		place-items: center;
		border: var(--line) solid var(--ink);
		border-radius: 50%;
		background: var(--paper);
		font-weight: 700;
		font-size: 17px;
		line-height: 1;
		cursor: pointer;
		touch-action: manipulation;
		transition: transform var(--dur-fast) var(--ease-out);
	}
	.icon-btn:active {
		transform: scale(0.94);
	}
	.icon-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
```

- [ ] **Step 5: Write `src/lib/platform/ui/Sheet.svelte`**

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconButton from './IconButton.svelte';

	interface Props {
		title: string;
		onclose: () => void;
		children: Snippet;
	}

	let { title, onclose, children }: Props = $props();
	const uid = $props.id();
	let dialog = $state<HTMLDialogElement>();

	$effect(() => {
		dialog?.showModal();
		return () => dialog?.close();
	});
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="{uid}-title"
	oncancel={(e) => {
		e.preventDefault();
		onclose();
	}}
>
	<header>
		<h2 id="{uid}-title">{title}</h2>
		<IconButton label="Close" onclick={onclose}>✕</IconButton>
	</header>
	<div class="body">{@render children()}</div>
</dialog>

<style>
	dialog {
		margin: auto auto 0;
		width: min(100%, var(--max-width));
		max-width: 100%;
		max-height: 85dvh;
		padding: 16px var(--gutter) calc(20px + env(safe-area-inset-bottom));
		border: var(--line) solid var(--ink);
		border-bottom: 0;
		border-radius: 16px 16px 0 0;
		background: var(--paper);
		color: var(--ink);
		animation: rise var(--dur) var(--ease-out);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding-bottom: 12px;
		border-bottom: var(--line) solid var(--ink-faint);
	}
	h2 {
		font-size: 20px;
	}
	.body {
		padding-top: 14px;
		line-height: 1.5;
	}
	@keyframes rise {
		from {
			transform: translateY(24px);
			opacity: 0;
		}
	}
</style>
```

- [ ] **Step 6: Write `src/lib/platform/ui/Stamp.svelte` and `Wordmark.svelte`**

`Stamp.svelte`:

```svelte
<script lang="ts">
	let { text }: { text: string } = $props();
</script>

<span class="stamp">{text}</span>

<style>
	.stamp {
		display: inline-block;
		padding: 2px 14px;
		border: 3px solid var(--accent);
		border-radius: 10px;
		color: var(--accent);
		font-family: var(--font-display);
		font-style: italic;
		font-weight: 700;
		font-size: 28px;
		transform: rotate(-6deg);
		animation: slam 320ms var(--ease-out) both;
		animation-delay: var(--stamp-delay, 0ms);
	}
	@keyframes slam {
		0% {
			transform: rotate(-6deg) scale(2.2);
			opacity: 0;
		}
		60% {
			transform: rotate(-6deg) scale(0.92);
			opacity: 1;
		}
		100% {
			transform: rotate(-6deg) scale(1);
		}
	}
</style>
```

`Wordmark.svelte`:

```svelte
<span class="wordmark">tink<em>ster</em></span>

<style>
	.wordmark {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 26px;
		letter-spacing: -0.6px;
	}
	em {
		font-style: italic;
		font-weight: 700;
		color: var(--accent);
	}
</style>
```

- [ ] **Step 7: Write `src/routes/+layout.svelte`**

```svelte
<script lang="ts">
	import '$lib/platform/ui/tokens.css';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="shell">{@render children()}</div>

<style>
	.shell {
		max-width: var(--max-width);
		min-height: 100dvh;
		margin: 0 auto;
		padding: env(safe-area-inset-top) var(--gutter) env(safe-area-inset-bottom);
		display: flex;
		flex-direction: column;
	}
</style>
```

- [ ] **Step 8: Temporary showcase on the home page**

Replace `src/routes/+page.svelte` (Task 11 replaces it again):

```svelte
<script lang="ts">
	import Button from '$lib/platform/ui/Button.svelte';
	import Stamp from '$lib/platform/ui/Stamp.svelte';
	import Wordmark from '$lib/platform/ui/Wordmark.svelte';
</script>

<Wordmark />
<p><Stamp text="Cracked!" /></p>
<p><Button variant="accent">Play again</Button> <Button>Home</Button></p>
```

- [ ] **Step 9: Verify**

Run: `npm run check && npm run lint && npm run build`
Expected: 0 errors, 0 warnings; the build emits three `.woff2` assets under `build/_app/immutable/assets/`.

Optional human check: `npm run dev -- --host`, then open the printed network URL on a phone. You should see the wordmark in ink with red italic "ster", a tilted red stamp and two buttons, in both light and dark mode.

- [ ] **Step 10: Commit**

```bash
git add src/lib/platform/ui src/routes/+layout.svelte src/routes/+page.svelte
git commit -m "feat(ui): add ink-and-paper design tokens, fonts and UI primitives" -m "Assisted-by: Claude Code (<model>)"
```

---

### Task 6: Pausable timer and fixed-step loop

**Files:**
- Create: `src/lib/platform/frames.ts`, `src/lib/platform/timer.ts`, `src/lib/platform/timer.svelte.ts`, `src/lib/platform/loop.ts`, `src/lib/platform/testing/fake-frames.ts`
- Test: `src/lib/platform/timer.test.ts`, `src/lib/platform/loop.test.ts`

**Interfaces:**
- Consumes: `PausableTimer` (Task 3).
- Produces:
  ```ts
  // frames.ts
  export interface FrameDeps { now(): number; raf(cb: FrameRequestCallback): number; caf(handle: number): void }
  export const browserFrames: FrameDeps;
  // timer.ts (pure)
  export interface Countdown { readonly durationMs: number; readonly elapsedMs: number; readonly runningSince: number | null }
  export function createCountdown(durationMs: number): Countdown;
  export function startCountdown(c: Countdown, now: number): Countdown;
  export function pauseCountdown(c: Countdown, now: number): Countdown;
  export function remainingMs(c: Countdown, now: number): number;
  export function isRunning(c: Countdown): boolean;
  // timer.svelte.ts (reactive)
  export class RafTimer implements PausableTimer { constructor(durationMs: number, onExpire: () => void, isPaused: () => boolean, frames?: FrameDeps) }
  export function createRafTimer(durationMs: number, onExpire: () => void, isPaused: () => boolean, frames?: FrameDeps): PausableTimer;
  // loop.ts
  export function advance(accumulatorMs: number, elapsedMs: number, stepMs: () => number, step: () => void, maxElapsedMs?: number): number;
  export interface LoopOptions { stepMs: () => number; step: () => void; render: () => void; isPaused: () => boolean; frames?: FrameDeps }
  export function startLoop(options: LoopOptions): () => void;   // returns stop()
  ```

- [ ] **Step 1: Write `src/lib/platform/frames.ts`**

```ts
/** Injectable animation-frame clock, so timers and loops are testable without a browser. */
export interface FrameDeps {
	now(): number;
	raf(cb: FrameRequestCallback): number;
	caf(handle: number): void;
}

export const browserFrames: FrameDeps = {
	now: () => performance.now(),
	raf: (cb) => requestAnimationFrame(cb),
	caf: (handle) => cancelAnimationFrame(handle),
};
```

- [ ] **Step 2: Write a fake frame clock for tests**

`src/lib/platform/testing/fake-frames.ts`, shared by the timer and loop tests:

```ts
import type { FrameDeps } from '../frames';

export interface FakeFrames extends FrameDeps {
	/** Moves the clock forward and runs the callbacks that were queued before the call. */
	advance(ms: number): void;
	readonly pending: number;
}

export function fakeFrames(): FakeFrames {
	let t = 0;
	let queue: FrameRequestCallback[] = [];
	return {
		now: () => t,
		raf: (cb) => {
			queue.push(cb);
			return queue.length;
		},
		caf: () => {
			queue = [];
		},
		advance(ms) {
			t += ms;
			const due = queue;
			queue = [];
			for (const cb of due) cb(t);
		},
		get pending() {
			return queue.length;
		},
	};
}
```

- [ ] **Step 2b: Write the failing timer tests**

`src/lib/platform/timer.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { fakeFrames } from './testing/fake-frames';
import {
	createCountdown,
	isRunning,
	pauseCountdown,
	remainingMs,
	startCountdown,
} from './timer';
import { RafTimer } from './timer.svelte';

describe('countdown (pure)', () => {
	it('starts stopped with the full duration', () => {
		const c = createCountdown(1000);
		expect(isRunning(c)).toBe(false);
		expect(remainingMs(c, 500)).toBe(1000);
	});

	it('counts down while running and clamps at zero', () => {
		const c = startCountdown(createCountdown(1000), 100);
		expect(remainingMs(c, 400)).toBe(700);
		expect(remainingMs(c, 5000)).toBe(0);
	});

	it('freezes while paused and resumes where it left off', () => {
		let c = startCountdown(createCountdown(1000), 0);
		c = pauseCountdown(c, 300);
		expect(remainingMs(c, 10_000)).toBe(700);
		c = startCountdown(c, 10_000);
		expect(remainingMs(c, 10_200)).toBe(500);
	});

	it('start and pause are idempotent', () => {
		const running = startCountdown(createCountdown(1000), 0);
		expect(startCountdown(running, 50)).toBe(running);
		const paused = pauseCountdown(running, 100);
		expect(pauseCountdown(paused, 200)).toBe(paused);
	});
});

describe('RafTimer', () => {
	it('counts down each frame and fires onExpire exactly once', () => {
		const frames = fakeFrames();
		const onExpire = vi.fn();
		const timer = new RafTimer(1000, onExpire, () => false, frames);
		frames.advance(400);
		expect(timer.remainingMs).toBe(600);
		frames.advance(700);
		expect(timer.remainingMs).toBe(0);
		expect(timer.expired).toBe(true);
		frames.advance(100);
		expect(onExpire).toHaveBeenCalledTimes(1);
		expect(frames.pending).toBe(0);
	});

	it('freezes while isPaused() is true', () => {
		const frames = fakeFrames();
		let paused = false;
		const timer = new RafTimer(1000, () => {}, () => paused, frames);
		frames.advance(300);
		paused = true;
		frames.advance(1); // this frame notices the pause
		const frozen = timer.remainingMs;
		frames.advance(5000);
		expect(timer.remainingMs).toBe(frozen);
		paused = false;
		frames.advance(1); // this frame notices the resume
		frames.advance(200);
		expect(timer.remainingMs).toBe(frozen - 200);
	});

	it('stop() cancels further ticks', () => {
		const frames = fakeFrames();
		const onExpire = vi.fn();
		const timer = new RafTimer(1000, onExpire, () => false, frames);
		timer.stop();
		frames.advance(5000);
		expect(onExpire).not.toHaveBeenCalled();
		expect(timer.remainingMs).toBe(1000);
	});
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/lib/platform/timer.test.ts`
Expected: FAIL, `Failed to resolve import "./timer"`.

- [ ] **Step 4: Implement `src/lib/platform/timer.ts`**

```ts
/** Pure countdown state. `now` is any monotonic millisecond clock. */
export interface Countdown {
	readonly durationMs: number;
	/** Time consumed during completed running spans. */
	readonly elapsedMs: number;
	/** Start of the current running span, or null while paused. */
	readonly runningSince: number | null;
}

export function createCountdown(durationMs: number): Countdown {
	return { durationMs, elapsedMs: 0, runningSince: null };
}

export function isRunning(c: Countdown): boolean {
	return c.runningSince !== null;
}

export function startCountdown(c: Countdown, now: number): Countdown {
	return c.runningSince === null ? { ...c, runningSince: now } : c;
}

export function pauseCountdown(c: Countdown, now: number): Countdown {
	return c.runningSince === null
		? c
		: { ...c, elapsedMs: c.elapsedMs + (now - c.runningSince), runningSince: null };
}

export function remainingMs(c: Countdown, now: number): number {
	const running = c.runningSince === null ? 0 : now - c.runningSince;
	return Math.max(0, c.durationMs - c.elapsedMs - running);
}
```

- [ ] **Step 5: Implement `src/lib/platform/timer.svelte.ts`**

```ts
import { browserFrames, type FrameDeps } from './frames';
import {
	type Countdown,
	createCountdown,
	isRunning,
	pauseCountdown,
	remainingMs,
	startCountdown,
} from './timer';
import type { PausableTimer } from './types';

/** A countdown driven by animation frames. Freezes whenever isPaused() is true. */
export class RafTimer implements PausableTimer {
	readonly durationMs: number;
	remainingMs = $state(0);
	expired = $state(false);

	#countdown: Countdown;
	#handle: number | null = null;
	#onExpire: () => void;
	#isPaused: () => boolean;
	#frames: FrameDeps;

	constructor(
		durationMs: number,
		onExpire: () => void,
		isPaused: () => boolean,
		frames: FrameDeps = browserFrames,
	) {
		this.durationMs = durationMs;
		this.remainingMs = durationMs;
		this.#countdown = createCountdown(durationMs);
		this.#onExpire = onExpire;
		this.#isPaused = isPaused;
		this.#frames = frames;
		this.#tick();
	}

	#tick = (): void => {
		const now = this.#frames.now();
		const paused = this.#isPaused();
		if (paused && isRunning(this.#countdown)) {
			this.#countdown = pauseCountdown(this.#countdown, now);
		} else if (!paused && !isRunning(this.#countdown)) {
			this.#countdown = startCountdown(this.#countdown, now);
		}
		this.remainingMs = remainingMs(this.#countdown, now);
		if (this.remainingMs === 0) {
			this.expired = true;
			this.#handle = null;
			this.#onExpire();
			return;
		}
		this.#handle = this.#frames.raf(this.#tick);
	};

	stop(): void {
		if (this.#handle !== null) this.#frames.caf(this.#handle);
		this.#handle = null;
	}
}

export function createRafTimer(
	durationMs: number,
	onExpire: () => void,
	isPaused: () => boolean,
	frames?: FrameDeps,
): PausableTimer {
	return new RafTimer(durationMs, onExpire, isPaused, frames);
}
```

- [ ] **Step 6: Run the timer tests to verify they pass**

Run: `npx vitest run src/lib/platform/timer.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 7: Write the failing loop tests**

`src/lib/platform/loop.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { advance, startLoop } from './loop';
import { fakeFrames } from './testing/fake-frames';

describe('advance', () => {
	it('runs whole steps and carries the remainder', () => {
		const step = vi.fn();
		expect(advance(0, 250, () => 100, step)).toBe(50);
		expect(step).toHaveBeenCalledTimes(2);
	});

	it('clamps a long gap (tab switch) to maxElapsedMs', () => {
		const step = vi.fn();
		advance(0, 60_000, () => 100, step, 250);
		expect(step).toHaveBeenCalledTimes(2);
	});

	it('treats negative elapsed time as zero', () => {
		const step = vi.fn();
		expect(advance(40, -500, () => 100, step)).toBe(40);
		expect(step).not.toHaveBeenCalled();
	});

	it('re-reads stepMs after every step (speed-ups apply immediately)', () => {
		let ms = 100;
		const step = vi.fn(() => {
			ms = 50;
		});
		expect(advance(0, 200, () => ms, step)).toBe(0);
		expect(step).toHaveBeenCalledTimes(3); // 100 + 50 + 50
	});
});

describe('startLoop', () => {
	it('steps at the fixed rate and renders every frame', () => {
		const frames = fakeFrames();
		const step = vi.fn();
		const render = vi.fn();
		startLoop({ stepMs: () => 100, step, render, isPaused: () => false, frames });
		for (let i = 0; i < 10; i++) frames.advance(25);
		expect(step).toHaveBeenCalledTimes(2);
		expect(render).toHaveBeenCalledTimes(10);
	});

	it('does not step while paused, and does not catch up afterwards', () => {
		const frames = fakeFrames();
		const step = vi.fn();
		let paused = true;
		startLoop({ stepMs: () => 100, step, render: () => {}, isPaused: () => paused, frames });
		for (let i = 0; i < 20; i++) frames.advance(50);
		expect(step).not.toHaveBeenCalled();
		paused = false;
		frames.advance(50);
		expect(step).not.toHaveBeenCalled();
		frames.advance(50);
		expect(step).toHaveBeenCalledTimes(1);
	});

	it('stop() ends the loop', () => {
		const frames = fakeFrames();
		const render = vi.fn();
		const stop = startLoop({ stepMs: () => 100, step: () => {}, render, isPaused: () => false, frames });
		frames.advance(16);
		stop();
		frames.advance(16);
		expect(render).toHaveBeenCalledTimes(1);
		expect(frames.pending).toBe(0);
	});
});
```

- [ ] **Step 8: Run to verify failure**

Run: `npx vitest run src/lib/platform/loop.test.ts`
Expected: FAIL, `Failed to resolve import "./loop"`.

- [ ] **Step 9: Implement `src/lib/platform/loop.ts`**

```ts
import { browserFrames, type FrameDeps } from './frames';

/**
 * Fixed-timestep accumulator. Runs step() once per stepMs of elapsed time, re-reading stepMs after
 * each step. Returns the leftover accumulator. Elapsed time is clamped so a long pause (a
 * backgrounded tab) never causes a burst of catch-up steps.
 */
export function advance(
	accumulatorMs: number,
	elapsedMs: number,
	stepMs: () => number,
	step: () => void,
	maxElapsedMs = 250,
): number {
	let acc = accumulatorMs + Math.min(Math.max(elapsedMs, 0), maxElapsedMs);
	let ms = stepMs();
	while (acc >= ms) {
		step();
		acc -= ms;
		ms = stepMs();
	}
	return acc;
}

export interface LoopOptions {
	stepMs: () => number;
	step: () => void;
	render: () => void;
	isPaused: () => boolean;
	frames?: FrameDeps;
}

/** Game logic at a fixed rate, rendering at display rate. Returns stop(). */
export function startLoop({
	stepMs,
	step,
	render,
	isPaused,
	frames = browserFrames,
}: LoopOptions): () => void {
	let acc = 0;
	let last = frames.now();
	let stopped = false;
	let handle = frames.raf(tick);

	function tick(): void {
		if (stopped) return;
		const now = frames.now();
		const elapsed = now - last;
		last = now;
		acc = isPaused() ? 0 : advance(acc, elapsed, stepMs, step);
		render();
		handle = frames.raf(tick);
	}

	return () => {
		stopped = true;
		frames.caf(handle);
	};
}
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run src/lib/platform/loop.test.ts src/lib/platform/timer.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 11: Type-check, lint, commit**

```bash
npm run check && npm run lint
git add src/lib/platform/frames.ts src/lib/platform/timer.ts src/lib/platform/timer.svelte.ts src/lib/platform/loop.ts src/lib/platform/testing/fake-frames.ts src/lib/platform/timer.test.ts src/lib/platform/loop.test.ts
git commit -m "feat(platform): add pausable countdown timer and fixed-step game loop" -m "Assisted-by: Claude Code (<model>)"
```

---

### Task 7: Swipe input and turn buffer

**Files:**
- Create: `src/lib/platform/input/swipe.ts`
- Test: `src/lib/platform/input/swipe.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Direction = 'up' | 'down' | 'left' | 'right';
  export const OPPOSITE: Record<Direction, Direction>;
  export function classifySwipe(dx: number, dy: number, minDistancePx?: number): Direction | null;  // default 24
  export function keyToDirection(key: string): Direction | null;   // arrows + WASD, case-insensitive
  export class TurnBuffer { constructor(capacity?: number); readonly size: number; push(dir: Direction, heading: Direction): boolean; next(heading: Direction): Direction; clear(): void }
  export function attachSwipe(el: HTMLElement, onSwipe: (dir: Direction) => void, minDistancePx?: number): () => void;  // returns detach
  ```

- [ ] **Step 1: Write the failing tests**

`src/lib/platform/input/swipe.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { attachSwipe, classifySwipe, keyToDirection, TurnBuffer } from './swipe';

describe('classifySwipe', () => {
	it('ignores movement shorter than the threshold', () => {
		expect(classifySwipe(10, 5)).toBeNull();
		expect(classifySwipe(23, 0)).toBeNull();
	});

	it('picks the dominant axis', () => {
		expect(classifySwipe(40, 10)).toBe('right');
		expect(classifySwipe(-40, 10)).toBe('left');
		expect(classifySwipe(5, 40)).toBe('down');
		expect(classifySwipe(5, -40)).toBe('up');
	});

	it('honors a custom threshold', () => {
		expect(classifySwipe(30, 0, 50)).toBeNull();
	});
});

describe('keyToDirection', () => {
	it('maps arrows and WASD', () => {
		expect(keyToDirection('ArrowUp')).toBe('up');
		expect(keyToDirection('a')).toBe('left');
		expect(keyToDirection('S')).toBe('down');
		expect(keyToDirection('d')).toBe('right');
		expect(keyToDirection('x')).toBeNull();
	});
});

describe('TurnBuffer', () => {
	it('queues up to capacity turns and replays them in order', () => {
		const b = new TurnBuffer(2);
		expect(b.push('up', 'right')).toBe(true);
		expect(b.push('left', 'right')).toBe(true);
		expect(b.push('down', 'right')).toBe(false); // full
		expect(b.next('right')).toBe('up');
		expect(b.next('up')).toBe('left');
		expect(b.next('left')).toBe('left'); // empty → keep heading
	});

	it('rejects a reversal or a repeat of the last effective direction', () => {
		const b = new TurnBuffer(2);
		expect(b.push('left', 'right')).toBe(false); // reverse of heading
		expect(b.push('right', 'right')).toBe(false); // same as heading
		expect(b.push('up', 'right')).toBe(true);
		expect(b.push('down', 'right')).toBe(false); // reverse of queued 'up'
		expect(b.size).toBe(1);
	});

	it('clear() empties the queue', () => {
		const b = new TurnBuffer();
		b.push('up', 'right');
		b.clear();
		expect(b.size).toBe(0);
	});
});

describe('attachSwipe', () => {
	const pointer = (type: string, x: number, y: number, id = 1) =>
		Object.assign(new Event(type), { clientX: x, clientY: y, pointerId: id });

	const fakeElement = () => {
		const target = new EventTarget();
		return Object.assign(target, { style: { touchAction: '' } }) as unknown as HTMLElement;
	};

	it('emits one direction per threshold crossed during a continuous drag', () => {
		const el = fakeElement();
		const onSwipe = vi.fn();
		attachSwipe(el, onSwipe);
		el.dispatchEvent(pointer('pointerdown', 0, 0));
		el.dispatchEvent(pointer('pointermove', 30, 2));
		el.dispatchEvent(pointer('pointermove', 32, 40));
		el.dispatchEvent(pointer('pointerup', 32, 40));
		el.dispatchEvent(pointer('pointermove', 90, 40)); // after release: ignored
		expect(onSwipe.mock.calls).toEqual([['right'], ['down']]);
	});

	it('detach() removes listeners and restores touch-action', () => {
		const el = fakeElement();
		const onSwipe = vi.fn();
		const detach = attachSwipe(el, onSwipe);
		expect(el.style.touchAction).toBe('none');
		detach();
		expect(el.style.touchAction).toBe('');
		el.dispatchEvent(pointer('pointerdown', 0, 0));
		el.dispatchEvent(pointer('pointermove', 60, 0));
		expect(onSwipe).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/platform/input/swipe.test.ts`
Expected: FAIL, `Failed to resolve import "./swipe"`.

- [ ] **Step 3: Implement `src/lib/platform/input/swipe.ts`**

```ts
export type Direction = 'up' | 'down' | 'left' | 'right';

export const OPPOSITE: Record<Direction, Direction> = {
	up: 'down',
	down: 'up',
	left: 'right',
	right: 'left',
};

export function classifySwipe(dx: number, dy: number, minDistancePx = 24): Direction | null {
	if (Math.max(Math.abs(dx), Math.abs(dy)) < minDistancePx) return null;
	if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
	return dy > 0 ? 'down' : 'up';
}

const KEYS: Record<string, Direction> = {
	arrowup: 'up',
	arrowdown: 'down',
	arrowleft: 'left',
	arrowright: 'right',
	w: 'up',
	s: 'down',
	a: 'left',
	d: 'right',
};

export function keyToDirection(key: string): Direction | null {
	return KEYS[key.toLowerCase()] ?? null;
}

/**
 * Queues quick successive turns (e.g. a fast up-then-left) so none are lost between game steps.
 * A turn is rejected if it repeats or reverses the last effective direction.
 */
export class TurnBuffer {
	readonly capacity: number;
	#queue: Direction[] = [];

	constructor(capacity = 2) {
		this.capacity = capacity;
	}

	get size(): number {
		return this.#queue.length;
	}

	push(dir: Direction, heading: Direction): boolean {
		const last = this.#queue.at(-1) ?? heading;
		if (dir === last || dir === OPPOSITE[last] || this.#queue.length >= this.capacity) return false;
		this.#queue.push(dir);
		return true;
	}

	next(heading: Direction): Direction {
		return this.#queue.shift() ?? heading;
	}

	clear(): void {
		this.#queue = [];
	}
}

/**
 * Reports swipes anywhere on `el`. A long drag can produce several turns: after each detected
 * swipe the origin resets to the current point. Returns a detach function.
 */
export function attachSwipe(
	el: HTMLElement,
	onSwipe: (dir: Direction) => void,
	minDistancePx = 24,
): () => void {
	let origin: { x: number; y: number; id: number } | null = null;

	const down = (e: PointerEvent) => {
		origin = { x: e.clientX, y: e.clientY, id: e.pointerId };
	};
	const move = (e: PointerEvent) => {
		if (!origin || e.pointerId !== origin.id) return;
		const dir = classifySwipe(e.clientX - origin.x, e.clientY - origin.y, minDistancePx);
		if (!dir) return;
		onSwipe(dir);
		origin = { x: e.clientX, y: e.clientY, id: e.pointerId };
	};
	const up = (e: PointerEvent) => {
		if (origin?.id === e.pointerId) origin = null;
	};

	const previousTouchAction = el.style.touchAction;
	el.style.touchAction = 'none';
	el.addEventListener('pointerdown', down as EventListener);
	el.addEventListener('pointermove', move as EventListener);
	el.addEventListener('pointerup', up as EventListener);
	el.addEventListener('pointercancel', up as EventListener);

	return () => {
		el.removeEventListener('pointerdown', down as EventListener);
		el.removeEventListener('pointermove', move as EventListener);
		el.removeEventListener('pointerup', up as EventListener);
		el.removeEventListener('pointercancel', up as EventListener);
		el.style.touchAction = previousTouchAction;
	};
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/platform/input/swipe.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Type-check, lint, commit**

```bash
npm run check && npm run lint
git add src/lib/platform/input
git commit -m "feat(platform): add swipe classification, turn buffer and pointer binding" -m "Assisted-by: Claude Code (<model>)"
```

---

### Task 8: Feedback (synthesized sound + haptics)

**Files:**
- Create: `src/lib/platform/feedback.ts`
- Test: `src/lib/platform/feedback.test.ts`

**Interfaces:**
- Consumes: `Feedback`, `SoundName`, `HapticName` (Task 3).
- Produces:
  ```ts
  export type AudioLike = Pick<AudioContext, 'currentTime' | 'destination' | 'state' | 'resume' | 'createOscillator' | 'createGain'>;
  export interface FeedbackDeps { enabled: () => boolean; audio?: () => AudioLike | null; vibrate?: ((pattern: number | number[]) => boolean) | null }
  export function createFeedback(deps: FeedbackDeps): Feedback;
  export const HAPTICS: Record<HapticName, number | number[]>;
  ```
  Sound only plays when `enabled()` is true, and the AudioContext is created lazily on the first allowed sound. Haptics ignore the sound setting.

- [ ] **Step 1: Write the failing tests**

`src/lib/platform/feedback.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { type AudioLike, createFeedback, HAPTICS } from './feedback';

function fakeAudio() {
	const param = () => ({
		setValueAtTime: vi.fn(),
		exponentialRampToValueAtTime: vi.fn(),
	});
	const started: string[] = [];
	const ctx = {
		currentTime: 0,
		state: 'running',
		destination: {},
		resume: vi.fn(async () => {}),
		createOscillator: vi.fn(() => {
			const osc = {
				type: 'sine',
				frequency: param(),
				connect: vi.fn((node: unknown) => node),
				start: vi.fn(() => started.push(osc.type)),
				stop: vi.fn(),
			};
			return osc;
		}),
		createGain: vi.fn(() => ({ gain: param(), connect: vi.fn((node: unknown) => node) })),
	};
	return { ctx: ctx as unknown as AudioLike, started, raw: ctx };
}

describe('createFeedback', () => {
	it('never touches audio while sound is disabled', () => {
		const audio = vi.fn();
		createFeedback({ enabled: () => false, audio, vibrate: null }).sound('pop');
		expect(audio).not.toHaveBeenCalled();
	});

	it('plays oscillator tones when enabled', () => {
		const { ctx, started } = fakeAudio();
		const fb = createFeedback({ enabled: () => true, audio: () => ctx, vibrate: null });
		fb.sound('stamp');
		expect(started.length).toBeGreaterThanOrEqual(1);
	});

	it('creates the audio context lazily and only once', () => {
		const { ctx } = fakeAudio();
		const audio = vi.fn(() => ctx);
		const fb = createFeedback({ enabled: () => true, audio, vibrate: null });
		fb.sound('tick');
		fb.sound('pop');
		expect(audio).toHaveBeenCalledTimes(1);
	});

	it('resumes a suspended context', () => {
		const { ctx, raw } = fakeAudio();
		raw.state = 'suspended';
		createFeedback({ enabled: () => true, audio: () => ctx, vibrate: null }).sound('tick');
		expect(raw.resume).toHaveBeenCalled();
	});

	it('is silent (no throw) when audio is unavailable', () => {
		const fb = createFeedback({ enabled: () => true, audio: () => null, vibrate: null });
		expect(() => fb.sound('fail')).not.toThrow();
	});

	it('maps haptics to vibration patterns regardless of the sound setting', () => {
		const vibrate = vi.fn(() => true);
		const fb = createFeedback({ enabled: () => false, audio: () => null, vibrate });
		fb.haptic('error');
		expect(vibrate).toHaveBeenCalledWith(HAPTICS.error);
	});

	it('is a no-op where vibration is unsupported', () => {
		expect(() =>
			createFeedback({ enabled: () => false, audio: () => null, vibrate: null }).haptic('tap'),
		).not.toThrow();
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/platform/feedback.test.ts`
Expected: FAIL, `Failed to resolve import "./feedback"`.

- [ ] **Step 3: Implement `src/lib/platform/feedback.ts`**

```ts
import type { Feedback, HapticName, SoundName } from './types';

export type AudioLike = Pick<
	AudioContext,
	'currentTime' | 'destination' | 'state' | 'resume' | 'createOscillator' | 'createGain'
>;

export interface FeedbackDeps {
	/** Sound preference; read on every call. */
	enabled: () => boolean;
	audio?: () => AudioLike | null;
	vibrate?: ((pattern: number | number[]) => boolean) | null;
}

interface Tone {
	type: OscillatorType;
	from: number;
	to: number;
	durationMs: number;
	gain: number;
}

/** Every sound is synthesized: no audio files to download or cache. */
const RECIPES: Record<SoundName, Tone[]> = {
	tick: [{ type: 'square', from: 1400, to: 1300, durationMs: 25, gain: 0.03 }],
	pop: [{ type: 'sine', from: 520, to: 880, durationMs: 70, gain: 0.12 }],
	stamp: [
		{ type: 'sine', from: 140, to: 60, durationMs: 160, gain: 0.35 },
		{ type: 'triangle', from: 900, to: 300, durationMs: 40, gain: 0.08 },
	],
	fail: [{ type: 'sawtooth', from: 220, to: 110, durationMs: 220, gain: 0.07 }],
};

export const HAPTICS: Record<HapticName, number | number[]> = {
	tap: 8,
	success: [18, 40, 18],
	error: [50, 30, 50],
};

function defaultAudio(): AudioLike | null {
	return typeof AudioContext === 'undefined' ? null : new AudioContext();
}

function defaultVibrate(): ((pattern: number | number[]) => boolean) | null {
	return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
		? (pattern) => navigator.vibrate(pattern)
		: null;
}

function play(ac: AudioLike, tone: Tone): void {
	const t0 = ac.currentTime;
	const t1 = t0 + tone.durationMs / 1000;
	const osc = ac.createOscillator();
	const gain = ac.createGain();
	osc.type = tone.type;
	osc.frequency.setValueAtTime(tone.from, t0);
	osc.frequency.exponentialRampToValueAtTime(tone.to, t1);
	gain.gain.setValueAtTime(tone.gain, t0);
	gain.gain.exponentialRampToValueAtTime(0.0001, t1);
	osc.connect(gain).connect(ac.destination);
	osc.start(t0);
	osc.stop(t1 + 0.02);
}

export function createFeedback({
	enabled,
	audio = defaultAudio,
	vibrate = defaultVibrate(),
}: FeedbackDeps): Feedback {
	let ac: AudioLike | null | undefined;

	return {
		sound(name) {
			if (!enabled()) return;
			if (ac === undefined) ac = audio();
			if (!ac) return;
			if (ac.state === 'suspended') void ac.resume();
			for (const tone of RECIPES[name]) play(ac, tone);
		},
		haptic(name) {
			vibrate?.(HAPTICS[name]);
		},
	};
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/platform/feedback.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Type-check, lint, commit**

```bash
npm run check && npm run lint
git add src/lib/platform/feedback.ts src/lib/platform/feedback.test.ts
git commit -m "feat(platform): add synthesized sound effects and haptics" -m "Assisted-by: Claude Code (<model>)"
```

---

### Task 9: Game session (the `GameContext` implementation) and frame setup helpers

**Files:**
- Create: `src/lib/platform/frame/session.svelte.ts`, `src/lib/platform/frame/setup.ts`
- Test: `src/lib/platform/frame/session.test.ts`, `src/lib/platform/frame/setup.test.ts`

**Interfaces:**
- Consumes: `GameContext`, `GameModule`, `GameResult`, `AnyGame`, `Options`, `OptionField`, `PausableTimer`, `Feedback` (Task 3); `Saves` (Task 3); `Rng` (Task 2); `createRafTimer` (Task 6).
- Produces:
  ```ts
  // session.svelte.ts
  export type PauseReason = 'sheet' | 'hidden' | 'countdown' | 'ended';
  export type TimerFactory = (durationMs: number, onExpire: () => void, isPaused: () => boolean) => PausableTimer;
  export interface SessionDeps<S> { game: AnyGame; module: GameModule<S>; options: Options; saves: Saves; rng: Rng; feedback: Feedback; onFinish: (result: GameResult) => void; now?: () => number; debounceMs?: number; createTimer?: TimerFactory }
  export class GameSession<S> {
    readonly ctx: GameContext<S>;
    readonly paused: boolean;                      // reactive
    meta: { left: string; right: string };         // reactive
    timer: PausableTimer | null;                   // reactive (raw)
    readonly finished: boolean;
    setPause(reason: PauseReason, on: boolean): void;
    flush(): void;      // write any pending save now
    dispose(): void;    // flush + stop timer
    discard(): void;    // drop pending save, stop timer, ignore further saves (used by Restart / crash)
  }
  // setup.ts
  export function resolveOptions(fields: OptionField[] | undefined, stored: Options | undefined): Options;
  export function seedFromUrl(href: string, run: number, enabled?: boolean): number | null;  // enabled defaults to __TEST_HOOKS__
  ```

- [ ] **Step 1: Write the failing setup tests**

`src/lib/platform/frame/setup.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { OptionField } from '../types';
import { resolveOptions, seedFromUrl } from './setup';

const fields: OptionField[] = [
	{
		key: 'difficulty',
		label: 'Difficulty',
		default: 'normal',
		choices: [
			{ value: 'easy', label: 'Easy' },
			{ value: 'normal', label: 'Normal' },
		],
	},
];

describe('resolveOptions', () => {
	it('uses defaults when nothing is stored', () => {
		expect(resolveOptions(fields, undefined)).toEqual({ difficulty: 'normal' });
	});

	it('uses a stored value when it is still a valid choice', () => {
		expect(resolveOptions(fields, { difficulty: 'easy' })).toEqual({ difficulty: 'easy' });
	});

	it('falls back to the default for a stale stored value and drops unknown keys', () => {
		expect(resolveOptions(fields, { difficulty: 'nightmare', extra: 'x' })).toEqual({
			difficulty: 'normal',
		});
	});

	it('returns an empty object for games without options', () => {
		expect(resolveOptions(undefined, { a: 'b' })).toEqual({});
	});
});

describe('seedFromUrl', () => {
	it('is ignored unless test hooks are enabled', () => {
		expect(seedFromUrl('http://x/play/a?seed=5', 0, false)).toBeNull();
	});

	it('offsets the seed by the run number when enabled', () => {
		expect(seedFromUrl('http://x/play/a?seed=5', 0, true)).toBe(5);
		expect(seedFromUrl('http://x/play/a?seed=5', 2, true)).toBe(7);
	});

	it('rejects missing or malformed seeds', () => {
		expect(seedFromUrl('http://x/play/a', 0, true)).toBeNull();
		expect(seedFromUrl('http://x/play/a?seed=abc', 0, true)).toBeNull();
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/platform/frame/setup.test.ts`
Expected: FAIL, `Failed to resolve import "./setup"`.

- [ ] **Step 3: Implement `src/lib/platform/frame/setup.ts`**

```ts
import type { OptionField, Options } from '../types';

/** Last-used options where still valid, otherwise each field's default. */
export function resolveOptions(
	fields: OptionField[] | undefined,
	stored: Options | undefined,
): Options {
	const out: Options = {};
	for (const field of fields ?? []) {
		const value = stored?.[field.key];
		out[field.key] =
			value !== undefined && field.choices.some((c) => c.value === value) ? value : field.default;
	}
	return out;
}

/**
 * e2e determinism hook: `?seed=<n>` fixes the RNG seed (offset by run number so "Play again"
 * is deterministic too). Only honored in builds made with PUBLIC_TEST_HOOKS=1.
 */
export function seedFromUrl(href: string, run: number, enabled = __TEST_HOOKS__): number | null {
	if (!enabled) return null;
	const raw = new URL(href).searchParams.get('seed');
	if (raw === null || !/^\d+$/.test(raw)) return null;
	return (Number(raw) + run) >>> 0;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/platform/frame/setup.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Write the failing session tests**

`src/lib/platform/frame/session.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRng } from '../rng';
import { createSaves, memoryStore } from '../save';
import type { AnyGame, GameModule, PausableTimer } from '../types';
import { GameSession, type SessionDeps } from './session.svelte';

interface S {
	n: number;
}

const game: AnyGame = {
	id: 'demo',
	title: 'Demo',
	pitch: 'p',
	category: 'logic',
	pace: 'timed',
	minutes: [1, 2],
	icon: '<svg></svg>',
	saveVersion: 3,
	load: async () => {
		throw new Error('unused');
	},
};

const module = {
	View: (() => {}) as unknown as GameModule<S>['View'],
	Rules: (() => {}) as unknown as GameModule<S>['Rules'],
	progressLabel: (s: S) => `n=${s.n}`,
} satisfies GameModule<S>;

function setup(over: Partial<SessionDeps<S>> = {}) {
	const saves = createSaves(memoryStore());
	const onFinish = vi.fn();
	const session = new GameSession<S>({
		game,
		module,
		options: { level: 'easy' },
		saves,
		rng: createRng(1),
		feedback: { sound: vi.fn(), haptic: vi.fn() },
		onFinish,
		now: () => 1234,
		debounceMs: 300,
		...over,
	});
	return { session, saves, onFinish };
}

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
});

describe('GameSession saves', () => {
	it('debounces saves and writes only the latest state', () => {
		const { session, saves } = setup();
		const write = vi.spyOn(saves, 'writeSlot');
		session.ctx.save({ n: 1 });
		session.ctx.save({ n: 2 });
		expect(write).not.toHaveBeenCalled();
		vi.advanceTimersByTime(300);
		expect(write).toHaveBeenCalledTimes(1);
		expect(saves.readSlot<S>('demo', 3)?.state).toEqual({ n: 2 });
	});

	it('flush() writes immediately with label, options, version and timestamp', () => {
		const { session, saves } = setup();
		session.ctx.save({ n: 7 });
		session.flush();
		expect(saves.readSlot<S>('demo', 3)).toEqual({
			gameId: 'demo',
			saveVersion: 3,
			savedAt: 1234,
			label: 'n=7',
			options: { level: 'easy' },
			state: { n: 7 },
		});
	});

	it('dispose() flushes a pending save', () => {
		const { session, saves } = setup();
		session.ctx.save({ n: 4 });
		session.dispose();
		expect(saves.readSlot<S>('demo', 3)?.state).toEqual({ n: 4 });
	});

	it('discard() drops the pending save and ignores later saves', () => {
		const { session, saves } = setup();
		session.ctx.save({ n: 4 });
		session.discard();
		session.ctx.save({ n: 5 });
		vi.advanceTimersByTime(1000);
		session.flush();
		expect(saves.readSlot('demo', 3)).toBeNull();
	});
});

describe('GameSession finish', () => {
	it('clears the slot, pauses, reports the result and ignores later saves', () => {
		const { session, saves, onFinish } = setup();
		session.ctx.save({ n: 1 });
		session.flush();
		session.ctx.finish({ stamp: 'Done!', headline: 'n=1' });
		expect(saves.readSlot('demo', 3)).toBeNull();
		expect(session.paused).toBe(true);
		expect(session.finished).toBe(true);
		expect(onFinish).toHaveBeenCalledWith({ stamp: 'Done!', headline: 'n=1' });
		session.ctx.save({ n: 2 });
		vi.advanceTimersByTime(1000);
		expect(saves.readSlot('demo', 3)).toBeNull();
	});

	it('only reports the first finish', () => {
		const { session, onFinish } = setup();
		session.ctx.finish({ stamp: 'A', headline: 'a' });
		session.ctx.finish({ stamp: 'B', headline: 'b' });
		expect(onFinish).toHaveBeenCalledTimes(1);
	});
});

describe('GameSession pause and meta', () => {
	it('is paused while any reason is active', () => {
		const { session } = setup();
		expect(session.paused).toBe(false);
		session.setPause('sheet', true);
		session.setPause('sheet', true);
		session.setPause('hidden', true);
		expect(session.ctx.paused).toBe(true);
		session.setPause('sheet', false);
		expect(session.paused).toBe(true);
		session.setPause('hidden', false);
		expect(session.ctx.paused).toBe(false);
	});

	it('setMeta() updates both lines, right defaulting to empty', () => {
		const { session } = setup();
		session.ctx.setMeta('Guess 1 of 8');
		expect(session.meta).toEqual({ left: 'Guess 1 of 8', right: '' });
	});
});

describe('GameSession timers', () => {
	const fakeTimer = (): PausableTimer & { stop: ReturnType<typeof vi.fn> } => ({
		durationMs: 1000,
		remainingMs: 1000,
		expired: false,
		stop: vi.fn(),
	});

	it('creates timers bound to the session pause state and replaces the previous one', () => {
		const made: { timer: ReturnType<typeof fakeTimer>; isPaused: () => boolean }[] = [];
		const { session } = setup({
			createTimer: (_ms, _onExpire, isPaused) => {
				const timer = fakeTimer();
				made.push({ timer, isPaused });
				return timer;
			},
		});
		const first = session.ctx.timer(1000, () => {});
		expect(session.timer).toBe(first);
		session.setPause('sheet', true);
		expect(made[0]?.isPaused()).toBe(true);
		const second = session.ctx.timer(2000, () => {});
		expect(made[0]?.timer.stop).toHaveBeenCalled();
		expect(session.timer).toBe(second);
	});
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run src/lib/platform/frame/session.test.ts`
Expected: FAIL, `Failed to resolve import "./session.svelte"`.

- [ ] **Step 7: Implement `src/lib/platform/frame/session.svelte.ts`**

```ts
import { untrack } from 'svelte';
import type { Rng } from '../rng';
import type { Saves } from '../save';
import { createRafTimer } from '../timer.svelte';
import type {
	AnyGame,
	Feedback,
	GameContext,
	GameModule,
	GameResult,
	Options,
	PausableTimer,
} from '../types';

export type PauseReason = 'sheet' | 'hidden' | 'countdown' | 'ended';

export type TimerFactory = (
	durationMs: number,
	onExpire: () => void,
	isPaused: () => boolean,
) => PausableTimer;

export interface SessionDeps<S> {
	game: AnyGame;
	module: GameModule<S>;
	options: Options;
	saves: Saves;
	rng: Rng;
	feedback: Feedback;
	onFinish: (result: GameResult) => void;
	now?: () => number;
	debounceMs?: number;
	createTimer?: TimerFactory;
}

/** One run of one game: implements the GameContext handed to the game's View. */
export class GameSession<S> {
	#reasons = $state<PauseReason[]>([]);
	readonly paused = $derived(this.#reasons.length > 0);
	meta = $state({ left: '', right: '' });
	timer = $state.raw<PausableTimer | null>(null);
	readonly ctx: GameContext<S>;

	#deps: SessionDeps<S>;
	#pending: { state: S } | null = null;
	#handle: ReturnType<typeof setTimeout> | undefined;
	#finished = false;

	constructor(deps: SessionDeps<S>) {
		this.#deps = deps;
		const session = this;
		this.ctx = {
			save: (state) => this.#queueSave(state),
			finish: (result) => this.#finish(result),
			setMeta: (left, right = '') => {
				this.meta = { left, right };
			},
			get paused() {
				return session.paused;
			},
			rng: deps.rng,
			feedback: deps.feedback,
			timer: (durationMs, onExpire) => {
				this.timer?.stop();
				const timer = (deps.createTimer ?? createRafTimer)(durationMs, onExpire, () => this.paused);
				this.timer = timer;
				return timer;
			},
		};
	}

	get finished(): boolean {
		return this.#finished;
	}

	setPause(reason: PauseReason, on: boolean): void {
		const has = untrack(() => this.#reasons.includes(reason));
		if (on && !has) this.#reasons.push(reason);
		else if (!on && has) this.#reasons = this.#reasons.filter((r) => r !== reason);
	}

	flush(): void {
		clearTimeout(this.#handle);
		const pending = this.#pending;
		this.#pending = null;
		if (!pending || this.#finished) return;
		const { game, module, options, saves, now = Date.now } = this.#deps;
		saves.writeSlot({
			gameId: game.id,
			saveVersion: game.saveVersion,
			savedAt: now(),
			label: module.progressLabel(pending.state),
			options,
			state: pending.state,
		});
	}

	dispose(): void {
		this.flush();
		this.timer?.stop();
	}

	discard(): void {
		clearTimeout(this.#handle);
		this.#pending = null;
		this.#finished = true;
		this.timer?.stop();
	}

	#queueSave(state: S): void {
		if (this.#finished) return;
		this.#pending = { state };
		clearTimeout(this.#handle);
		this.#handle = setTimeout(() => this.flush(), this.#deps.debounceMs ?? 300);
	}

	#finish(result: GameResult): void {
		if (this.#finished) return;
		this.#finished = true;
		clearTimeout(this.#handle);
		this.#pending = null;
		this.timer?.stop();
		this.#deps.saves.clearSlot(this.#deps.game.id);
		this.setPause('ended', true);
		this.#deps.onFinish(result);
	}
}
```

- [ ] **Step 8: Run to verify pass**

Run: `npx vitest run src/lib/platform/frame`
Expected: PASS (16 tests: 7 setup + 9 session).

- [ ] **Step 9: Type-check, lint, commit**

```bash
npm run check && npm run lint
git add src/lib/platform/frame
git commit -m "feat(frame): add game session implementing the GameContext contract" -m "Assisted-by: Claude Code (<model>)"
```

---

### Task 10: Game frame UI, play route, fixture game and e2e harness

**Files:**
- Create: `src/lib/platform/frame/GameFrame.svelte`, `TopBar.svelte`, `StartPanel.svelte`, `RulesSheet.svelte`, `MenuSheet.svelte`, `EndCard.svelte`, `Countdown.svelte`, `TimerStrip.svelte`
- Create: `src/routes/play/[game]/+page.ts`, `src/routes/play/[game]/+page.svelte`
- Create: `src/lib/platform/testing/fixture/{index.ts,module.ts,state.ts,View.svelte,HowToPlay.svelte}`
- Create: `playwright.config.ts`, `e2e/frame.spec.ts`
- Modify: `src/lib/platform/registry.ts` (register the fixture as a test game), `package.json` (scripts)

**Interfaces:**
- Consumes: everything from Tasks 2–9.
- Produces:
  - Route `/play/<id>` for every `routableGames` entry (prerendered).
  - `GameFrame` props: `{ game: AnyGame }`.
  - DOM hooks used by e2e tests: `data-testid="game-frame"` with `data-paused="true|false"`, `data-testid="countdown"`. The end card is a `role="dialog"` named by its stamp text.
  - Test game `test-fixture` (pace `timed`, option `mode: calm|wild`), with buttons **Add one**, **Win** and **Crash** and test ids `count` and `remaining`.
  - npm script `test:e2e`.

- [ ] **Step 1: Install Playwright and axe**

```bash
npm i -D @playwright/test@^1 @axe-core/playwright@^4
npx playwright install chromium webkit
```

Add to `package.json` `scripts`:

```json
"test:e2e": "playwright test --project=iphone-se --project=pixel-7"
```

- [ ] **Step 2: Write `playwright.config.ts`**

```ts
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
```

- [ ] **Step 3: Write the fixture game**

The fixture is a deliberately simple timed game used to test the frame: resume, pause, timer, end card and error boundary. It is compiled in only when `PUBLIC_TEST_HOOKS=1`.

`src/lib/platform/testing/fixture/state.ts`:

```ts
export interface FixtureState {
	count: number;
}

export type FixtureOptions = { mode: 'calm' | 'wild' };
```

`src/lib/platform/testing/fixture/View.svelte`:

```svelte
<script lang="ts">
	import { untrack } from 'svelte';
	import type { GameProps } from '../../types';
	import type { FixtureOptions, FixtureState } from './state';

	let { options, saved, ctx }: GameProps<FixtureState, FixtureOptions> = $props();

	let count = $state(untrack(() => saved?.count ?? 0));
	let crashed = $state(false);
	const timer = untrack(() =>
		ctx.timer(60_000, () => ctx.finish({ stamp: 'Time!', headline: `Count ${count}` })),
	);

	$effect(() => {
		ctx.setMeta(`count ${count}`, `mode ${options.mode}`);
	});

	function crash(): string {
		throw new Error('fixture crash');
	}
</script>

<div class="fixture">
	<p data-testid="count">{count}</p>
	<p data-testid="remaining">{Math.ceil(timer.remainingMs / 1000)}</p>
	<button
		onclick={() => {
			count += 1;
			ctx.save({ count });
		}}>Add one</button
	>
	<button onclick={() => ctx.finish({ stamp: 'Done!', headline: `Count ${count}` })}>Win</button>
	<button onclick={() => (crashed = true)}>Crash</button>
	{#if crashed}{crash()}{/if}
</div>

<style>
	.fixture {
		display: grid;
		gap: 8px;
		padding: 16px 0;
	}
	button {
		min-height: var(--tap);
	}
</style>
```

`src/lib/platform/testing/fixture/HowToPlay.svelte`:

```svelte
<p>Test-only game. Tap “Add one”, then leave and come back.</p>
```

`src/lib/platform/testing/fixture/module.ts`:

```ts
import type { GameModule } from '../../types';
import HowToPlay from './HowToPlay.svelte';
import type { FixtureOptions, FixtureState } from './state';
import View from './View.svelte';

const mod: GameModule<FixtureState, FixtureOptions> = {
	View,
	Rules: HowToPlay,
	progressLabel: (s) => `count ${s.count}`,
};

export default mod;
```

`src/lib/platform/testing/fixture/index.ts`:

```ts
import { defineGame } from '../../types';
import type { FixtureOptions, FixtureState } from './state';

export const fixtureGame = defineGame<FixtureState, FixtureOptions>({
	id: 'test-fixture',
	title: 'Test Fixture',
	pitch: 'Platform test game',
	category: 'logic',
	pace: 'timed',
	minutes: [1, 1],
	icon: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="12" /></svg>',
	saveVersion: 1,
	options: [
		{
			key: 'mode',
			label: 'Mode',
			default: 'calm',
			choices: [
				{ value: 'calm', label: 'Calm' },
				{ value: 'wild', label: 'Wild' },
			],
		},
	],
	load: () => import('./module').then((m) => m.default),
});
```

- [ ] **Step 4: Register the fixture as a test game**

In `src/lib/platform/registry.ts`, add the import and replace the `testGames` line:

```ts
import { fixtureGame } from './testing/fixture';
```

```ts
/** Test-only games, compiled in only for the e2e build (PUBLIC_TEST_HOOKS=1). */
const testGames: AnyGame[] = __TEST_HOOKS__ ? [fixtureGame] : [];
```

In production `__TEST_HOOKS__` is the literal `false`, so the bundler drops the fixture entirely. Task 15's size check confirms no fixture chunk ships.

- [ ] **Step 5: Write the small frame components**

`src/lib/platform/frame/TopBar.svelte`:

```svelte
<script lang="ts">
	import IconButton from '../ui/IconButton.svelte';

	interface Props {
		title: string;
		onhome: () => void;
		onrules: () => void;
		onmenu: () => void;
	}

	let { title, onhome, onrules, onmenu }: Props = $props();
</script>

<header class="bar">
	<IconButton label="Home" onclick={onhome}>←</IconButton>
	<h1>{title}</h1>
	<IconButton label="How to play" onclick={onrules}>?</IconButton>
	<IconButton label="Menu" onclick={onmenu}>⋯</IconButton>
</header>

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 0 10px;
		border-bottom: var(--line) solid var(--ink);
	}
	h1 {
		flex: 1;
		font-size: 18px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
```

`src/lib/platform/frame/TimerStrip.svelte`:

```svelte
<script lang="ts">
	import type { PausableTimer } from '../types';

	let { timer }: { timer: PausableTimer } = $props();
	const fraction = $derived(timer.durationMs > 0 ? timer.remainingMs / timer.durationMs : 0);
</script>

<div class="strip" role="timer" aria-label="{Math.ceil(timer.remainingMs / 1000)} seconds left">
	<i style:transform="scaleX({fraction})"></i>
</div>

<style>
	.strip {
		height: 6px;
		margin-top: 8px;
		border: var(--line) solid var(--ink);
		border-radius: 999px;
		overflow: hidden;
	}
	i {
		display: block;
		height: 100%;
		background: var(--accent);
		transform-origin: left center;
	}
</style>
```

`src/lib/platform/frame/Countdown.svelte`:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';

	let { ondone }: { ondone: () => void } = $props();
	let n = $state(3);

	onMount(() => {
		const id = setInterval(() => {
			n -= 1;
			if (n === 0) {
				clearInterval(id);
				ondone();
			}
		}, 600);
		return () => clearInterval(id);
	});
</script>

<div class="countdown" data-testid="countdown" role="status" aria-live="assertive">
	{#if n > 0}
		{#key n}<span>{n}</span>{/key}
	{/if}
</div>

<style>
	.countdown {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, var(--paper) 80%, transparent);
		z-index: 5;
	}
	span {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 96px;
		animation: pop 600ms var(--ease-out) both;
	}
	@keyframes pop {
		from {
			transform: scale(1.6);
			opacity: 0;
		}
	}
</style>
```

`src/lib/platform/frame/StartPanel.svelte`:

```svelte
<script lang="ts">
	import type { OptionField, Options } from '../types';
	import Button from '../ui/Button.svelte';

	interface Props {
		fields: OptionField[];
		values: Options;
		onstart: () => void;
	}

	let { fields, values = $bindable(), onstart }: Props = $props();
</script>

<section class="start" aria-label="Game options">
	{#each fields as field (field.key)}
		<fieldset>
			<legend>{field.label}</legend>
			<div class="choices">
				{#each field.choices as choice (choice.value)}
					<label class="choice" class:selected={values[field.key] === choice.value}>
						<input type="radio" name={field.key} value={choice.value} bind:group={values[field.key]} />
						<span class="label">{choice.label}</span>
						{#if choice.hint}<span class="hint">{choice.hint}</span>{/if}
					</label>
				{/each}
			</div>
		</fieldset>
	{/each}
	<Button variant="accent" onclick={onstart}>Start</Button>
</section>

<style>
	.start {
		display: flex;
		flex-direction: column;
		gap: 20px;
		margin: auto 0;
		padding: 16px 0;
	}
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
	}
	legend {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 18px;
		margin-bottom: 10px;
	}
	.choices {
		display: grid;
		gap: 8px;
	}
	.choice {
		position: relative;
		display: flex;
		align-items: baseline;
		gap: 10px;
		min-height: var(--tap);
		padding: 10px 14px;
		border: var(--line) solid var(--ink);
		border-radius: var(--radius);
		cursor: pointer;
	}
	.choice.selected {
		box-shadow: var(--shadow);
		border-color: var(--accent);
	}
	.choice:has(input:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	/* The real radio covers the whole label so taps and e2e clicks land on it. */
	input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}
	.label {
		font-weight: 700;
	}
	.hint {
		color: var(--ink-soft);
		font-size: 13px;
	}
</style>
```

`src/lib/platform/frame/RulesSheet.svelte`:

```svelte
<script lang="ts">
	import type { Component } from 'svelte';
	import Sheet from '../ui/Sheet.svelte';

	let { title, Rules, onclose }: { title: string; Rules: Component; onclose: () => void } = $props();
</script>

<Sheet title="How to play {title}" {onclose}><Rules /></Sheet>
```

`src/lib/platform/frame/MenuSheet.svelte`:

```svelte
<script lang="ts">
	import Button from '../ui/Button.svelte';
	import Sheet from '../ui/Sheet.svelte';

	interface Props {
		sound: boolean;
		ontogglesound: () => void;
		onrestart: () => void;
		onclose: () => void;
	}

	let { sound, ontogglesound, onrestart, onclose }: Props = $props();
</script>

<Sheet title="Menu" {onclose}>
	<div class="items">
		<Button onclick={onrestart}>Restart game</Button>
		<Button aria-pressed={sound} onclick={ontogglesound}>
			Sound <span aria-hidden="true">· {sound ? 'on' : 'off'}</span>
		</Button>
	</div>
</Sheet>

<style>
	.items {
		display: grid;
		gap: 10px;
	}
</style>
```

`src/lib/platform/frame/EndCard.svelte`:

```svelte
<script lang="ts">
	import type { GameResult } from '../types';
	import Button from '../ui/Button.svelte';
	import Stamp from '../ui/Stamp.svelte';

	interface Props {
		result: GameResult;
		onplayagain: () => void;
		onhome: () => void;
	}

	let { result, onplayagain, onhome }: Props = $props();
	const uid = $props.id();
	let card = $state<HTMLElement>();

	$effect(() => {
		card?.querySelector('button')?.focus();
	});
</script>

<div class="scrim"></div>
<div class="card" role="dialog" aria-modal="true" aria-labelledby="{uid}-stamp" bind:this={card}>
	<p class="stamp" id="{uid}-stamp"><Stamp text={result.stamp} /></p>
	<h2>{result.headline}</h2>
	{#if result.detail}<p class="detail">{result.detail}</p>{/if}
	{#if result.reveal}<div class="reveal">{@render result.reveal()}</div>{/if}
	<div class="actions">
		<Button variant="accent" onclick={onplayagain}>Play again</Button>
		<Button onclick={onhome}>Home</Button>
	</div>
</div>

<style>
	.scrim {
		position: absolute;
		inset: 0;
		background: rgb(22 21 20 / 0.45);
		z-index: 9;
		animation: fade var(--dur) ease-out 400ms both;
	}
	.card {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 16px;
		z-index: 10;
		padding: 20px 16px 16px;
		border: var(--line) solid var(--ink);
		border-radius: 16px;
		background: var(--paper);
		box-shadow: 4px 4px 0 var(--ink);
		text-align: center;
		--stamp-delay: 550ms;
		animation: rise 260ms var(--ease-out) 400ms both;
	}
	.stamp {
		margin: 0 0 12px;
	}
	h2 {
		font-size: 22px;
	}
	.detail {
		margin: 4px 0 0;
		color: var(--ink-soft);
		font-size: 13px;
	}
	.reveal {
		margin: 12px 0 4px;
		display: flex;
		justify-content: center;
	}
	.actions {
		display: grid;
		gap: 8px;
		margin-top: 16px;
	}
	@keyframes rise {
		from {
			transform: translateY(24px);
			opacity: 0;
		}
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
</style>
```

(The scrim color is the same fixed value as `dialog::backdrop` in `tokens.css`, for the same reason.)

- [ ] **Step 6: Write `src/lib/platform/frame/GameFrame.svelte`**

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { createFeedback } from '../feedback';
	import { createRng, randomSeed } from '../rng';
	import { browserStore, createSaves } from '../save';
	import type { AnyGame, GameModule, GameResult, Options } from '../types';
	import Button from '../ui/Button.svelte';
	import Countdown from './Countdown.svelte';
	import EndCard from './EndCard.svelte';
	import MenuSheet from './MenuSheet.svelte';
	import RulesSheet from './RulesSheet.svelte';
	import { GameSession } from './session.svelte';
	import { resolveOptions, seedFromUrl } from './setup';
	import StartPanel from './StartPanel.svelte';
	import TimerStrip from './TimerStrip.svelte';
	import TopBar from './TopBar.svelte';

	let { game }: { game: AnyGame } = $props();

	const saves = createSaves(browserStore());
	let prefs = $state(saves.readPrefs());
	const feedback = createFeedback({ enabled: () => prefs.sound });

	type Phase = 'loading' | 'failed-to-load' | 'start' | 'playing';
	let phase = $state<Phase>('loading');
	let mod = $state.raw<GameModule<unknown> | null>(null);
	let options = $state<Options>({});
	let saved = $state.raw<unknown>(null);
	let session = $state.raw<GameSession<unknown> | null>(null);
	let result = $state.raw<GameResult | null>(null);
	let sheet = $state<'rules' | 'menu' | null>(null);
	let countingDown = $state(false);
	let runs = 0;

	const timed = $derived(game.pace !== 'turn-based');

	onMount(() => {
		let cancelled = false;
		const slot = saves.readSlot(game.id, game.saveVersion);
		options = slot?.options ?? resolveOptions(game.options, prefs.options[game.id]);
		saved = slot?.state ?? null;
		game.load().then(
			(m) => {
				if (cancelled) return;
				mod = m;
				if (slot || !game.options?.length) beginRun(slot !== null);
				else phase = 'start';
			},
			() => {
				if (!cancelled) phase = 'failed-to-load';
			},
		);
		const onPageHide = () => session?.flush();
		window.addEventListener('pagehide', onPageHide);
		return () => {
			cancelled = true;
			window.removeEventListener('pagehide', onPageHide);
			session?.dispose();
		};
	});

	$effect(() => {
		session?.setPause('sheet', sheet !== null);
	});
	$effect(() => {
		session?.setPause('countdown', countingDown);
	});

	function beginRun(resuming: boolean): void {
		if (!mod) return;
		session?.dispose();
		result = null;
		sheet = null;
		const seed = seedFromUrl(location.href, runs++) ?? randomSeed();
		session = new GameSession<unknown>({
			game,
			module: mod,
			options: $state.snapshot(options),
			saves,
			rng: createRng(seed),
			feedback,
			onFinish: (r) => {
				result = r;
				feedback.sound('stamp');
			},
		});
		countingDown = resuming && timed;
		session.setPause('countdown', countingDown);
		phase = 'playing';
	}

	function start(): void {
		prefs.options[game.id] = $state.snapshot(options);
		saves.writePrefs($state.snapshot(prefs));
		saved = null;
		beginRun(false);
	}

	function playAgain(): void {
		saved = null;
		beginRun(false);
	}

	function restart(): void {
		session?.discard();
		saves.clearSlot(game.id);
		saved = null;
		sheet = null;
		result = null;
		if (game.options?.length) {
			session = null;
			phase = 'start';
		} else {
			beginRun(false);
		}
	}

	function closeSheet(): void {
		sheet = null;
		if (timed && phase === 'playing' && !result) countingDown = true;
	}

	function toggleSound(): void {
		prefs.sound = !prefs.sound;
		saves.writePrefs($state.snapshot(prefs));
		if (prefs.sound) feedback.sound('pop');
	}

	function goHome(): void {
		session?.flush();
		goto(resolve('/'));
	}

	function onVisibility(): void {
		if (!session) return;
		if (document.hidden) {
			session.setPause('hidden', true);
			session.flush();
		} else {
			session.setPause('hidden', false);
			if (timed && !result && sheet === null && phase === 'playing') countingDown = true;
		}
	}

	function onKeydown(e: KeyboardEvent): void {
		// Spec §6.6: Escape opens the menu. While a sheet is open, the <dialog> handles Escape itself.
		if (e.key === 'Escape' && sheet === null && !result && phase === 'playing') {
			e.preventDefault();
			sheet = 'menu';
		}
	}

	function onGameError(error: unknown): void {
		console.error(error);
		session?.discard();
		saves.clearSlot(game.id);
	}
</script>

<svelte:document onvisibilitychange={onVisibility} />
<svelte:window onkeydown={onKeydown} />

<div class="frame" data-testid="game-frame" data-paused={session?.paused ?? false}>
	<TopBar
		title={game.title}
		onhome={goHome}
		onrules={() => (sheet = 'rules')}
		onmenu={() => (sheet = 'menu')}
	/>
	<div class="meta tabular">
		<span>{session?.meta.left ?? ''}</span>
		<span>{session?.meta.right ?? ''}</span>
	</div>
	{#if session?.timer}<TimerStrip timer={session.timer} />{/if}

	<main class="play">
		{#if phase === 'loading'}
			<p class="status">Loading…</p>
		{:else if phase === 'failed-to-load'}
			<div class="status" role="alert">
				<p>This game couldn't load. Check your connection and try again.</p>
				<Button onclick={() => location.reload()}>Retry</Button>
			</div>
		{:else if phase === 'start' && game.options}
			<StartPanel fields={game.options} bind:values={options} onstart={start} />
		{:else if mod && session}
			{@const View = mod.View}
			<svelte:boundary onerror={onGameError}>
				{#key session}
					<View {options} {saved} ctx={session.ctx} />
				{/key}
				{#snippet failed(_error, reset)}
					<div class="status" role="alert">
						<p>Something broke.</p>
						<div class="row">
							<Button
								variant="accent"
								onclick={() => {
									saved = null;
									beginRun(false);
									reset();
								}}>Start over</Button
							>
							<Button onclick={goHome}>Home</Button>
						</div>
					</div>
				{/snippet}
			</svelte:boundary>
		{/if}
	</main>

	{#if sheet === 'rules' && mod}
		<RulesSheet title={game.title} Rules={mod.Rules} onclose={closeSheet} />
	{/if}
	{#if sheet === 'menu'}
		<MenuSheet
			sound={prefs.sound}
			ontogglesound={toggleSound}
			onrestart={restart}
			onclose={closeSheet}
		/>
	{/if}
	{#if countingDown}<Countdown ondone={() => (countingDown = false)} />{/if}
	{#if result}<EndCard {result} onplayagain={playAgain} onhome={goHome} />{/if}
</div>

<style>
	.frame {
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.meta {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		min-height: 26px;
		padding-top: 8px;
		color: var(--ink-soft);
		font-size: 12px;
	}
	.play {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		padding: 8px 0 16px;
	}
	.status {
		margin: auto 0;
		text-align: center;
		display: grid;
		gap: 12px;
		justify-items: center;
	}
	.row {
		display: flex;
		gap: 8px;
	}
</style>
```

- [ ] **Step 7: Write the play route**

`src/routes/play/[game]/+page.ts`:

```ts
import { error } from '@sveltejs/kit';
import { findGame, routableGames } from '$lib/platform/registry';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => routableGames.map((g) => ({ game: g.id }));

export const load: PageLoad = ({ params }) => {
	const game = findGame(params.game);
	if (!game) error(404, 'Unknown game');
	return { gameId: game.id, title: game.title };
};
```

`src/routes/play/[game]/+page.svelte`:

```svelte
<script lang="ts">
	import GameFrame from '$lib/platform/frame/GameFrame.svelte';
	import { findGame } from '$lib/platform/registry';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const game = $derived(findGame(data.gameId));
</script>

<svelte:head><title>{data.title} · tinkster</title></svelte:head>

{#if game}
	{#key game.id}<GameFrame {game} />{/key}
{/if}
```

- [ ] **Step 8: Write the frame e2e tests**

`e2e/frame.spec.ts`:

```ts
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
```

- [ ] **Step 9: Run the e2e tests**

Run: `npm run test:e2e -- e2e/frame.spec.ts`
Expected: 20 passed (10 tests × 2 projects). The first run builds the site (≈30–60 s).

If `a crashing game…` fails because the error surfaces as an uncaught page error instead of the boundary, check that the `{#if crashed}{crash()}{/if}` expression is inside the `<svelte:boundary>` subtree. It is, via `<View>`; boundaries catch errors thrown while rendering descendants.

- [ ] **Step 10: Unit tests, type-check, lint, commit**

```bash
npm test && npm run check && npm run lint
git add package.json package-lock.json playwright.config.ts e2e/frame.spec.ts src/lib/platform/frame src/lib/platform/testing/fixture src/lib/platform/registry.ts src/routes/play
git commit -m "feat(frame): add shared game frame, play route and e2e-tested fixture game" -m "Assisted-by: Claude Code (<model>)"
```

---

### Task 11: Home screen

**Files:**
- Create: `src/lib/platform/home/GameTile.svelte`, `src/lib/platform/home/ResumeCard.svelte`, `e2e/home.spec.ts`
- Modify: `src/routes/+page.svelte` (replace the Task 5 showcase)

**Interfaces:**
- Consumes: `games`, `routableGames` (Task 4/10), `groupByCategory`, `latestResume`, `formatMinutes` (Task 4), `browserStore`, `createSaves` (Task 3), `createRng`, `randomSeed` (Task 2), `Wordmark` (Task 5).
- Produces: home page with `<h1>` containing the wordmark, a **Surprise me** button, an optional resume link (accessible name contains the game title, the progress label and "Resume"), and one `<section>` per non-empty category containing tile links named by game title.

- [ ] **Step 1: Write the failing home e2e test**

`e2e/home.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:e2e -- e2e/home.spec.ts`
Expected: FAIL. There is no heading named "tinkster" yet (the showcase renders the wordmark in a span).

- [ ] **Step 3: Write `src/lib/platform/home/GameTile.svelte`**

```svelte
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { AnyGame, Category } from '../types';
	import { formatMinutes } from './home';

	let { game }: { game: AnyGame } = $props();

	const TEXTURE: Record<Category, string> = {
		words: 'tx-dots',
		logic: 'tx-lines',
		arcade: 'tx-grid',
	};
</script>

<a class="tile" href={resolve('/play/[game]', { game: game.id })}>
	<span class="tx {TEXTURE[game.category]}" aria-hidden="true"></span>
	<span class="title">{game.title}</span>
	<span class="pitch">{game.pitch}</span>
	<span class="badge tabular">{formatMinutes(game.minutes)}</span>
	<!-- Icons are our own static SVG files (imported with ?raw), never user content. -->
	<span class="icon" aria-hidden="true">{@html game.icon}</span>
</a>

<style>
	.tile {
		position: relative;
		display: block;
		height: 104px;
		padding: 11px 12px;
		overflow: hidden;
		border: var(--line) solid var(--ink);
		border-radius: var(--radius);
		background: var(--paper);
		box-shadow: var(--shadow);
		color: inherit;
		text-decoration: none;
		transition:
			transform var(--dur-fast) var(--ease-out),
			box-shadow var(--dur-fast) var(--ease-out);
	}
	.tile:active {
		transform: translate(3px, 3px);
		box-shadow: 0 0 0 var(--ink);
	}
	.tile:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}
	.tx {
		position: absolute;
		inset: 0;
		opacity: 0.13;
		pointer-events: none;
	}
	.title {
		position: relative;
		display: block;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 15px;
		line-height: 1.15;
	}
	.pitch {
		position: relative;
		display: block;
		max-width: 92px;
		margin-top: 3px;
		font-size: 11px;
		line-height: 1.25;
		color: var(--ink-soft);
	}
	.badge {
		position: absolute;
		left: 12px;
		bottom: 10px;
		padding: 1px 7px;
		border: 1px solid var(--ink);
		border-radius: 999px;
		background: var(--paper);
		font-size: 10px;
		font-weight: 600;
	}
	.icon {
		position: absolute;
		right: 8px;
		bottom: 8px;
		width: 40px;
		height: 40px;
	}
	.icon :global(svg) {
		width: 100%;
		height: 100%;
		fill: none;
		stroke: var(--ink);
		stroke-width: 2.2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.icon :global(.accent) {
		stroke: var(--accent);
	}
	.icon :global(.fill) {
		fill: var(--ink);
		stroke: none;
	}
</style>
```

- [ ] **Step 4: Write `src/lib/platform/home/ResumeCard.svelte`**

```svelte
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ResumeEntry } from './home';

	let { entry }: { entry: ResumeEntry } = $props();
</script>

<a class="resume" href={resolve('/play/[game]', { game: entry.game.id })}>
	<span class="text">
		<b>{entry.game.title}</b>
		<span>{entry.label}</span>
	</span>
	<span class="go">Resume</span>
</a>

<style>
	.resume {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin: 14px 0 4px;
		padding: 10px 14px;
		border-radius: var(--radius);
		background: var(--ink);
		color: var(--paper);
		text-decoration: none;
		font-size: 12px;
	}
	.resume:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}
	b {
		display: block;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 15px;
	}
	.go {
		padding: 6px 14px;
		border-radius: 999px;
		background: var(--accent);
		color: var(--on-accent);
		font-weight: 700;
	}
</style>
```

- [ ] **Step 5: Replace `src/routes/+page.svelte`**

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import GameTile from '$lib/platform/home/GameTile.svelte';
	import { groupByCategory, latestResume, type ResumeEntry } from '$lib/platform/home/home';
	import ResumeCard from '$lib/platform/home/ResumeCard.svelte';
	import { games, routableGames } from '$lib/platform/registry';
	import { createRng, randomSeed } from '$lib/platform/rng';
	import { browserStore, createSaves } from '$lib/platform/save';
	import Wordmark from '$lib/platform/ui/Wordmark.svelte';

	const sections = groupByCategory(games);
	let resume = $state.raw<ResumeEntry | null>(null);

	onMount(() => {
		resume = latestResume(createSaves(browserStore()).listSlots(), routableGames);
	});

	function surprise(): void {
		if (games.length === 0) return;
		const game = createRng(randomSeed()).pick(games);
		goto(resolve('/play/[game]', { game: game.id }));
	}
</script>

<svelte:head><title>tinkster · tiny games for spare minutes</title></svelte:head>

<header class="top">
	<h1><Wordmark /></h1>
	<button class="surprise" onclick={surprise} disabled={games.length === 0}>
		<svg viewBox="0 0 20 20" aria-hidden="true">
			<rect x="2.5" y="2.5" width="15" height="15" rx="3" />
			<circle cx="7" cy="7" r="1.3" />
			<circle cx="13" cy="13" r="1.3" />
			<circle cx="10" cy="10" r="1.3" />
		</svg>
		Surprise me
	</button>
</header>
<p class="tagline">Tiny games for spare minutes. No sign-up, no tracking, works offline.</p>

{#if resume}<ResumeCard entry={resume} />{/if}

{#each sections as section (section.id)}
	<section aria-labelledby="sec-{section.id}">
		<h2 id="sec-{section.id}">{section.label}</h2>
		<div class="grid">
			{#each section.games as game (game.id)}<GameTile {game} />{/each}
		</div>
	</section>
{/each}

<footer>Open source · nothing you do here leaves your device</footer>

<style>
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding-top: 18px;
	}
	h1 {
		line-height: 1;
	}
	.surprise {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: var(--tap);
		padding: 0 14px;
		border: var(--line) solid var(--ink);
		border-radius: 999px;
		background: var(--paper);
		font-weight: 600;
		font-size: 13px;
		cursor: pointer;
	}
	.surprise:disabled {
		opacity: 0.35;
	}
	.surprise:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.surprise svg {
		width: 18px;
		height: 18px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
	}
	.surprise svg circle {
		fill: currentColor;
		stroke: none;
	}
	.tagline {
		margin: 6px 0 0;
		color: var(--ink-soft);
		font-size: 12px;
	}
	h2 {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 20px 2px 10px;
		font-size: 16px;
	}
	h2::after {
		content: '';
		flex: 1;
		border-top: var(--line) solid var(--ink-faint);
	}
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	footer {
		margin: auto 0 0;
		padding: 28px 0 16px;
		color: var(--ink-soft);
		font-size: 11px;
		text-align: center;
	}
</style>
```

- [ ] **Step 6: Run the e2e tests to verify they pass**

Run: `npm run test:e2e -- e2e/home.spec.ts e2e/frame.spec.ts`
Expected: 24 passed (12 tests × 2 projects).

- [ ] **Step 7: Type-check, lint, commit**

```bash
npm run check && npm run lint
git add src/lib/platform/home src/routes/+page.svelte e2e/home.spec.ts
git commit -m "feat(home): add rich-grid home with resume card and surprise button" -m "Assisted-by: Claude Code (<model>)"
```

---

### Task 12: Break the Code rules

**Files:**
- Create: `src/lib/games/break-the-code/rules.ts`
- Test: `src/lib/games/break-the-code/rules.test.ts`

**Interfaces:**
- Consumes: `Rng`, `createRng` (Task 2).
- Produces:
  ```ts
  export type Difficulty = 'easy' | 'normal' | 'hard';
  export type BtcOptions = { difficulty: Difficulty };
  export interface Config { length: number; repeats: boolean; maxGuesses: number }
  export const CONFIGS: Record<Difficulty, Config>;   // easy 3/no/8, normal 4/no/8, hard 5/yes/10
  export interface Guess { digits: number[]; hits: number; nears: number }
  export interface State { config: Config; secret: number[]; guesses: Guess[]; entry: number[]; status: 'playing' | 'won' | 'lost' }
  export type Action = { type: 'digit'; digit: number } | { type: 'backspace' } | { type: 'submit' };
  export type Rejection = 'too-short' | 'repeat';
  export interface Outcome { state: State; rejected?: Rejection }   // ignored input returns the SAME state object
  export function isDifficulty(value: string): value is Difficulty;
  export function makeSecret(config: Config, rng: Rng): number[];
  export function newGame(difficulty: Difficulty, rng: Rng): State;
  export function score(secret: readonly number[], guess: readonly number[]): { hits: number; nears: number };
  export function reduce(state: State, action: Action): Outcome;
  ```

- [ ] **Step 1: Write the failing tests**

`src/lib/games/break-the-code/rules.test.ts`:

```ts
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRng } from '$lib/platform/rng';
import {
	CONFIGS,
	type Difficulty,
	isDifficulty,
	newGame,
	reduce,
	type State,
	score,
} from './rules';

const code = (length: number) =>
	fc.array(fc.integer({ min: 0, max: 9 }), { minLength: length, maxLength: length });
const anyCode = fc.integer({ min: 1, max: 6 }).chain(code);
const codePair = fc.integer({ min: 1, max: 6 }).chain((n) => fc.tuple(code(n), code(n)));

describe('score', () => {
	it.each([
		[[1, 2, 3, 4], [1, 2, 3, 4], 4, 0],
		[[1, 2, 3, 4], [4, 3, 2, 1], 0, 4],
		[[1, 2, 3, 4], [1, 5, 6, 2], 1, 1],
		[[1, 2, 3, 4], [5, 6, 7, 8], 0, 0],
		[[1, 1, 2, 2, 3], [1, 2, 1, 2, 1], 2, 2],
		[[0, 0, 0], [0, 1, 1], 1, 0],
	])('score(%j, %j) → %i hits, %i nears', (secret, guess, hits, nears) => {
		expect(score(secret, guess)).toEqual({ hits, nears });
	});

	it('0 ≤ hits + nears ≤ length', () => {
		fc.assert(
			fc.property(codePair, ([secret, guess]) => {
				const { hits, nears } = score(secret, guess);
				expect(hits).toBeGreaterThanOrEqual(0);
				expect(nears).toBeGreaterThanOrEqual(0);
				expect(hits + nears).toBeLessThanOrEqual(secret.length);
			}),
		);
	});

	it('a code scored against itself is all hits', () => {
		fc.assert(
			fc.property(anyCode, (c) => {
				expect(score(c, c)).toEqual({ hits: c.length, nears: 0 });
			}),
		);
	});

	it('is symmetric in secret and guess', () => {
		fc.assert(
			fc.property(codePair, ([a, b]) => {
				expect(score(a, b)).toEqual(score(b, a));
			}),
		);
	});
});

describe('newGame', () => {
	const difficulties = Object.keys(CONFIGS) as Difficulty[];

	it('makes a secret of the right length, digits 0–9, distinct unless repeats are allowed', () => {
		fc.assert(
			fc.property(fc.integer(), fc.constantFrom(...difficulties), (seed, difficulty) => {
				const { secret, config, guesses, entry, status } = newGame(difficulty, createRng(seed));
				expect(secret).toHaveLength(config.length);
				for (const d of secret) expect(Number.isInteger(d) && d >= 0 && d <= 9).toBe(true);
				if (!config.repeats) expect(new Set(secret).size).toBe(secret.length);
				expect([guesses, entry, status]).toEqual([[], [], 'playing']);
			}),
		);
	});

	it('is deterministic for a seed', () => {
		expect(newGame('hard', createRng(42))).toEqual(newGame('hard', createRng(42)));
	});

	it('hard mode can produce repeated digits', () => {
		const seeds = Array.from({ length: 200 }, (_, i) => i);
		const withRepeat = seeds.some((s) => {
			const { secret } = newGame('hard', createRng(s));
			return new Set(secret).size < secret.length;
		});
		expect(withRepeat).toBe(true);
	});
});

describe('isDifficulty', () => {
	it('accepts only the three levels', () => {
		expect(isDifficulty('easy')).toBe(true);
		expect(isDifficulty('hard')).toBe(true);
		expect(isDifficulty('toString')).toBe(false);
		expect(isDifficulty('nightmare')).toBe(false);
	});
});

describe('reduce', () => {
	const fixed = (secret: number[], difficulty: Difficulty = 'normal'): State => ({
		config: CONFIGS[difficulty],
		secret,
		guesses: [],
		entry: [],
		status: 'playing',
	});
	const type = (state: State, digits: number[]) =>
		digits.reduce((s, digit) => reduce(s, { type: 'digit', digit }).state, state);
	const submit = (state: State) => reduce(state, { type: 'submit' });

	it('types digits up to the code length and ignores extras', () => {
		expect(type(fixed([1, 2, 3, 4]), [5, 6, 7, 8, 9]).entry).toEqual([5, 6, 7, 8]);
	});

	it('ignores out-of-range digits', () => {
		const s = fixed([1, 2, 3, 4]);
		expect(reduce(s, { type: 'digit', digit: 10 }).state).toBe(s);
		expect(reduce(s, { type: 'digit', digit: 1.5 }).state).toBe(s);
	});

	it('backspace removes the last digit and is a no-op on an empty entry', () => {
		const s = type(fixed([1, 2, 3, 4]), [5, 6]);
		expect(reduce(s, { type: 'backspace' }).state.entry).toEqual([5]);
		const empty = fixed([1, 2, 3, 4]);
		expect(reduce(empty, { type: 'backspace' }).state).toBe(empty);
	});

	it('rejects a short guess without changing state', () => {
		const s = type(fixed([1, 2, 3, 4]), [5, 6]);
		const out = submit(s);
		expect(out.rejected).toBe('too-short');
		expect(out.state).toBe(s);
	});

	it('rejects a repeated digit when repeats are not allowed', () => {
		const s = type(fixed([1, 2, 3, 4]), [7]);
		const out = reduce(s, { type: 'digit', digit: 7 });
		expect(out.rejected).toBe('repeat');
		expect(out.state.entry).toEqual([7]);
	});

	it('allows repeated digits in hard mode', () => {
		expect(type(fixed([1, 1, 2, 2, 3], 'hard'), [7, 7]).entry).toEqual([7, 7]);
	});

	it('scores a submitted guess and clears the entry', () => {
		const out = submit(type(fixed([1, 2, 3, 4]), [1, 5, 6, 2]));
		expect(out.state.guesses).toEqual([{ digits: [1, 5, 6, 2], hits: 1, nears: 1 }]);
		expect(out.state.entry).toEqual([]);
		expect(out.state.status).toBe('playing');
	});

	it('wins on an exact guess', () => {
		expect(submit(type(fixed([1, 2, 3, 4]), [1, 2, 3, 4])).state.status).toBe('won');
	});

	it('loses after the last wrong guess', () => {
		let s = fixed([1, 2, 3, 4]);
		for (let i = 0; i < 8; i++) s = submit(type(s, [5, 6, 7, 8])).state;
		expect(s.status).toBe('lost');
		expect(s.guesses).toHaveLength(8);
	});

	it('ignores all input once the game is over', () => {
		const won = submit(type(fixed([1, 2, 3, 4]), [1, 2, 3, 4])).state;
		expect(reduce(won, { type: 'digit', digit: 5 }).state).toBe(won);
		expect(reduce(won, { type: 'submit' }).state).toBe(won);
	});

	it('never mutates its input', () => {
		const s = type(fixed([1, 2, 3, 4]), [1, 5, 6]);
		const before = structuredClone(s);
		reduce(s, { type: 'digit', digit: 2 });
		reduce(s, { type: 'backspace' });
		submit(reduce(s, { type: 'digit', digit: 2 }).state);
		expect(s).toEqual(before);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/games/break-the-code/rules.test.ts`
Expected: FAIL, `Failed to resolve import "./rules"`.

- [ ] **Step 3: Implement `src/lib/games/break-the-code/rules.ts`**

```ts
import type { Rng } from '$lib/platform/rng';

export type Difficulty = 'easy' | 'normal' | 'hard';
export type BtcOptions = { difficulty: Difficulty };

export interface Config {
	length: number;
	repeats: boolean;
	maxGuesses: number;
}

export const CONFIGS: Record<Difficulty, Config> = {
	easy: { length: 3, repeats: false, maxGuesses: 8 },
	normal: { length: 4, repeats: false, maxGuesses: 8 },
	hard: { length: 5, repeats: true, maxGuesses: 10 },
};

export interface Guess {
	digits: number[];
	/** Right digit, right position. */
	hits: number;
	/** Right digit, wrong position. */
	nears: number;
}

export interface State {
	config: Config;
	secret: number[];
	guesses: Guess[];
	/** The guess being typed. */
	entry: number[];
	status: 'playing' | 'won' | 'lost';
}

export type Action = { type: 'digit'; digit: number } | { type: 'backspace' } | { type: 'submit' };
export type Rejection = 'too-short' | 'repeat';

export interface Outcome {
	/** The same object as the input when the action was ignored or rejected. */
	state: State;
	rejected?: Rejection;
}

export function isDifficulty(value: string): value is Difficulty {
	return Object.hasOwn(CONFIGS, value);
}

export function makeSecret(config: Config, rng: Rng): number[] {
	if (config.repeats) return Array.from({ length: config.length }, () => rng.int(0, 9));
	return rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, config.length);
}

export function newGame(difficulty: Difficulty, rng: Rng): State {
	const config = CONFIGS[difficulty];
	return { config, secret: makeSecret(config, rng), guesses: [], entry: [], status: 'playing' };
}

/** Standard Mastermind scoring: nears = Σ_d min(count_secret(d), count_guess(d)) − hits. */
export function score(
	secret: readonly number[],
	guess: readonly number[],
): { hits: number; nears: number } {
	let hits = 0;
	const inSecret = new Array<number>(10).fill(0);
	const inGuess = new Array<number>(10).fill(0);
	for (let i = 0; i < secret.length; i++) {
		const s = secret[i] as number;
		const g = guess[i] as number;
		if (s === g) hits++;
		inSecret[s] = (inSecret[s] ?? 0) + 1;
		inGuess[g] = (inGuess[g] ?? 0) + 1;
	}
	let common = 0;
	for (let d = 0; d < 10; d++) common += Math.min(inSecret[d] ?? 0, inGuess[d] ?? 0);
	return { hits, nears: common - hits };
}

export function reduce(state: State, action: Action): Outcome {
	if (state.status !== 'playing') return { state };
	const { config, entry } = state;

	switch (action.type) {
		case 'digit': {
			const d = action.digit;
			if (!Number.isInteger(d) || d < 0 || d > 9 || entry.length >= config.length) {
				return { state };
			}
			if (!config.repeats && entry.includes(d)) return { state, rejected: 'repeat' };
			return { state: { ...state, entry: [...entry, d] } };
		}
		case 'backspace':
			return entry.length === 0 ? { state } : { state: { ...state, entry: entry.slice(0, -1) } };
		case 'submit': {
			if (entry.length < config.length) return { state, rejected: 'too-short' };
			const guess: Guess = { digits: [...entry], ...score(state.secret, entry) };
			const guesses = [...state.guesses, guess];
			const status =
				guess.hits === config.length
					? 'won'
					: guesses.length >= config.maxGuesses
						? 'lost'
						: 'playing';
			return { state: { ...state, guesses, entry: [], status } };
		}
	}
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/games/break-the-code/rules.test.ts`
Expected: PASS (24 tests: 6 table rows + 3 score properties + 3 newGame + 1 isDifficulty + 11 reduce).

- [ ] **Step 5: Type-check, lint, commit**

```bash
npm run check && npm run lint
git add src/lib/games/break-the-code/rules.ts src/lib/games/break-the-code/rules.test.ts
git commit -m "feat(break-the-code): add pure rules with Mastermind scoring" -m "Assisted-by: Claude Code (<model>)"
```

---

### Task 13: Break the Code view, registration and e2e

**Files:**
- Create: `src/lib/games/break-the-code/{View.svelte,HowToPlay.svelte,module.ts,index.ts,icon.svg}`
- Create: `e2e/helpers.ts`, `e2e/break-the-code.spec.ts`
- Modify: `src/lib/platform/registry.ts` (one import + one line), `e2e/home.spec.ts` (add two tests)

**Interfaces:**
- Consumes: Task 12 rules; `GameProps`, `GameModule`, `defineGame` (Task 3); frame behavior (Task 10).
- Produces: registered game `break-the-code`. DOM contract used by tests:
  - `<ol aria-label="Guesses">` with one `<li>` per row, labelled `Guess N: d d d d, H right place, N wrong place` / `Current guess: …` / `Guess N: not played`.
  - `role="group"` named `Keypad`, with buttons `0`–`9`, `Delete` and `Enter`.
  - `role="status"` with the rejection reason text.
  - On the end card, `role="group"` named `The code`.
- Produces (`e2e/helpers.ts`): `SEED`, `secretFor(run, difficulty?)`, `wrongCode(secret)`, `startBreakTheCode(page, difficulty?)`, `enterGuess(page, digits)`.

- [ ] **Step 1: Write the e2e helpers and the failing e2e test**

`e2e/helpers.ts`:

```ts
import { expect, type Page } from '@playwright/test';
import { type Difficulty, newGame } from '../src/lib/games/break-the-code/rules';
import { createRng } from '../src/lib/platform/rng';

export const SEED = 7;

/** The secret the app will generate for run `run` of a page opened with ?seed=SEED. */
export function secretFor(run: number, difficulty: Difficulty = 'normal'): number[] {
	return newGame(difficulty, createRng(SEED + run)).secret;
}

/** A valid no-repeat guess sharing no digit with the secret (so: 0 hits, 0 nears). */
export function wrongCode(secret: number[], length = secret.length): number[] {
	return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !secret.includes(d)).slice(0, length);
}

export async function startBreakTheCode(page: Page, difficulty: 'Easy' | 'Normal' | 'Hard' = 'Normal') {
	await page.goto(`play/break-the-code?seed=${SEED}`);
	await page.getByRole('radio', { name: new RegExp(`^${difficulty}`) }).check();
	await page.getByRole('button', { name: 'Start' }).click();
	await expect(page.getByText(/^Guess 1 of \d+$/)).toBeVisible();
}

export async function enterGuess(page: Page, digits: number[]) {
	await page.keyboard.type(digits.join(''));
	await page.keyboard.press('Enter');
}
```

`e2e/break-the-code.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { enterGuess, secretFor, startBreakTheCode, wrongCode } from './helpers';

test('cracking the code shows the end card with the answer', async ({ page }) => {
	await startBreakTheCode(page);
	const secret = secretFor(0);
	await enterGuess(page, wrongCode(secret));
	await expect(page.getByText('Guess 2 of 8')).toBeVisible();
	await enterGuess(page, secret);
	const card = page.getByRole('dialog', { name: 'Cracked!' });
	await expect(card).toBeVisible();
	await expect(card.getByRole('heading', { name: '2 guesses' })).toBeVisible();
	await expect(card.getByRole('group', { name: 'The code' })).toHaveText(
		new RegExp(secret.join('\\s*')),
	);
	await card.getByRole('button', { name: 'Play again' }).click();
	await expect(page.getByText('Guess 1 of 8')).toBeVisible();
});

test('running out of guesses reveals the code', async ({ page }) => {
	await startBreakTheCode(page);
	const secret = secretFor(0);
	for (let i = 0; i < 8; i++) await enterGuess(page, wrongCode(secret));
	const card = page.getByRole('dialog', { name: 'Locked out' });
	await expect(card).toBeVisible();
	await expect(card.getByRole('group', { name: 'The code' })).toHaveText(
		new RegExp(secret.join('\\s*')),
	);
});

test('the keypad types, deletes and explains rejected input', async ({ page }) => {
	await startBreakTheCode(page);
	const pad = page.getByRole('group', { name: 'Keypad' });
	await pad.getByRole('button', { name: '1', exact: true }).click();
	await pad.getByRole('button', { name: '1', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('No repeated digits at this level');
	await pad.getByRole('button', { name: 'Enter' }).click();
	await expect(page.getByRole('status')).toHaveText('Fill every slot first');
	await pad.getByRole('button', { name: 'Delete' }).click();
	await expect(page.getByRole('listitem', { name: 'Current guess: empty' })).toBeVisible();
});

test('feedback pegs are announced per guess', async ({ page }) => {
	await startBreakTheCode(page);
	const secret = secretFor(0);
	const guess = [secret[1], secret[0], ...wrongCode(secret).slice(0, 2)] as number[];
	await enterGuess(page, guess);
	await expect(
		page.getByRole('listitem', {
			name: `Guess 1: ${guess.join(' ')}, 0 right place, 2 wrong place`,
		}),
	).toBeVisible();
});

test('an unfinished game resumes from the home screen', async ({ page }) => {
	await startBreakTheCode(page);
	const wrong = wrongCode(secretFor(0));
	await enterGuess(page, wrong);
	await page.getByRole('button', { name: 'Home' }).click();
	await page.getByRole('link', { name: /Break the Code.*guess 2 of 8.*Resume/ }).click();
	await expect(page.getByText('Guess 2 of 8')).toBeVisible();
	await expect(page.getByRole('listitem', { name: new RegExp(`^Guess 1: ${wrong.join(' ')},`) })).toBeVisible();
});

test('hard mode allows repeated digits and has 10 guesses', async ({ page }) => {
	await startBreakTheCode(page, 'Hard');
	await expect(page.getByText('Guess 1 of 10')).toBeVisible();
	await enterGuess(page, [7, 7, 7, 7, 7]);
	await expect(page.getByText('Guess 2 of 10')).toBeVisible();
});
```

Append to `e2e/home.spec.ts`:

```ts
test('lists Break the Code under Logic', async ({ page }) => {
	await page.goto('./');
	const logic = page.getByRole('region', { name: 'Logic' });
	await logic.getByRole('link', { name: /Break the Code/ }).click();
	await expect(page).toHaveURL(/\/play\/break-the-code$/);
});

test('Surprise me opens a game', async ({ page }) => {
	await page.goto('./');
	await page.getByRole('button', { name: 'Surprise me' }).click();
	await expect(page).toHaveURL(/\/play\/[a-z0-9-]+$/);
	await expect(page.getByTestId('game-frame')).toBeVisible();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:e2e -- e2e/break-the-code.spec.ts`
Expected: FAIL, 404 for `play/break-the-code` (the game is not registered yet).

- [ ] **Step 3: Write `src/lib/games/break-the-code/icon.svg`**

```svg
<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="18" width="24" height="16" rx="3"/><path class="accent" d="M13 18v-5a7 7 0 0 1 14 0v5"/><circle class="fill" cx="20" cy="26" r="2"/></svg>
```

- [ ] **Step 4: Write `src/lib/games/break-the-code/HowToPlay.svelte`**

```svelte
<p>A secret code of digits is hidden. Crack it before you run out of guesses.</p>
<ul>
	<li>Type a guess on the keypad and press <b>Enter</b>.</li>
	<li>A <b>red peg</b> means one digit is right <i>and</i> in the right place.</li>
	<li>A <b>hollow peg</b> means one digit is right but in the wrong place.</li>
	<li>Pegs don't say <i>which</i> digits they mean. Working that out is the puzzle.</li>
</ul>
<p>Easy: 3 digits, 8 guesses. Normal: 4 digits, 8 guesses. Hard: 5 digits, repeats allowed, 10 guesses.</p>

<style>
	ul {
		padding-left: 20px;
	}
	li {
		margin: 6px 0;
	}
</style>
```

- [ ] **Step 5: Write `src/lib/games/break-the-code/View.svelte`**

```svelte
<script lang="ts">
	import { untrack } from 'svelte';
	import type { GameProps } from '$lib/platform/types';
	import {
		type Action,
		type BtcOptions,
		isDifficulty,
		newGame,
		type Rejection,
		reduce,
		type State,
	} from './rules';

	let { options, saved, ctx }: GameProps<State, BtcOptions> = $props();

	let game = $state<State>(
		untrack(
			() =>
				saved ??
				newGame(isDifficulty(options.difficulty) ? options.difficulty : 'normal', ctx.rng),
		),
	);
	let rejection = $state<Rejection | null>(null);
	let nudge = $state(0);

	const REASON: Record<Rejection, string> = {
		'too-short': 'Fill every slot first',
		repeat: 'No repeated digits at this level',
	};
	const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
	const slots = $derived(Array.from({ length: game.config.length }, (_, i) => i));
	const rows = $derived(Array.from({ length: game.config.maxGuesses }, (_, i) => i));

	$effect(() => {
		const { config, guesses } = game;
		ctx.setMeta(
			`Guess ${Math.min(guesses.length + 1, config.maxGuesses)} of ${config.maxGuesses}`,
			`${config.length} digits · ${config.repeats ? 'repeats allowed' : 'no repeats'}`,
		);
	});

	function act(action: Action): void {
		if (ctx.paused || game.status !== 'playing') return;
		const outcome = reduce(game, action);
		if (outcome.rejected) {
			rejection = outcome.rejected;
			nudge += 1;
			ctx.feedback.sound('fail');
			ctx.feedback.haptic('error');
			return;
		}
		if (outcome.state === game) return;
		rejection = null;
		game = outcome.state;

		if (action.type === 'submit') {
			ctx.feedback.sound('pop');
			ctx.feedback.haptic('tap');
		} else {
			ctx.feedback.sound('tick');
		}

		if (game.status === 'playing') {
			ctx.save(game);
			return;
		}
		const n = game.guesses.length;
		ctx.finish(
			game.status === 'won'
				? {
						stamp: 'Cracked!',
						headline: `${n} ${n === 1 ? 'guess' : 'guesses'}`,
						detail: 'The code was',
						reveal: codeReveal,
					}
				: { stamp: 'Locked out', headline: 'Out of guesses', detail: 'The code was', reveal: codeReveal },
		);
	}

	function onkeydown(e: KeyboardEvent): void {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		if (/^[0-9]$/.test(e.key)) act({ type: 'digit', digit: Number(e.key) });
		else if (e.key === 'Backspace') act({ type: 'backspace' });
		else if (e.key === 'Enter') act({ type: 'submit' });
		else return;
		e.preventDefault();
	}

	function rowLabel(i: number): string {
		const guess = game.guesses[i];
		if (guess) {
			return `Guess ${i + 1}: ${guess.digits.join(' ')}, ${guess.hits} right place, ${guess.nears} wrong place`;
		}
		if (i === game.guesses.length && game.status === 'playing') {
			return `Current guess: ${game.entry.length ? game.entry.join(' ') : 'empty'}`;
		}
		return `Guess ${i + 1}: not played`;
	}
</script>

<svelte:window {onkeydown} />

{#snippet codeReveal()}
	<div class="code" role="group" aria-label="The code">
		{#each game.secret as digit, i (i)}<span class="digit solid">{digit}</span>{/each}
	</div>
{/snippet}

<div class="btc">
	<ol class="board" aria-label="Guesses">
		{#each rows as i (i)}
			{@const guess = game.guesses[i]}
			{@const current = i === game.guesses.length && game.status === 'playing'}
			{@const digits = guess ? guess.digits : current ? game.entry : []}
			<li class="row" class:current aria-label={rowLabel(i)}>
				{#each slots as p (p)}
					<span class="digit" class:blank={!guess && !current}>{digits[p] ?? ''}</span>
				{/each}
				<span class="pegs" aria-hidden="true" style:--cols={Math.ceil(game.config.length / 2)}>
					{#each slots as p (p)}
						<i
							class:hit={!!guess && p < guess.hits}
							class:near={!!guess && p >= guess.hits && p < guess.hits + guess.nears}
							style:--delay="{p * 70}ms"
						></i>
					{/each}
				</span>
			</li>
		{/each}
	</ol>

	{#key nudge}
		<p class="reason" class:shake={nudge > 0} role="status">
			{rejection ? REASON[rejection] : ''}
		</p>
	{/key}

	<div class="pad" role="group" aria-label="Keypad">
		<div class="keys">
			{#each KEYS as key (key)}
				<button class="key" onclick={() => act({ type: 'digit', digit: key })}>{key}</button>
			{/each}
		</div>
		<div class="actions">
			<button class="key" aria-label="Delete" onclick={() => act({ type: 'backspace' })}>⌫</button>
			<button class="key enter" onclick={() => act({ type: 'submit' })}>Enter</button>
		</div>
	</div>
</div>

<style>
	.btc {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.board {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		margin: 0;
		padding: 4px 0;
		list-style: none;
	}
	/* Centers the rows when they fit, stays scrollable from the top when they don't. */
	.board > :first-child {
		margin-top: auto;
	}
	.board > :last-child {
		margin-bottom: auto;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.digit {
		width: 34px;
		height: 38px;
		display: grid;
		place-items: center;
		border: var(--line) solid var(--ink);
		border-radius: var(--radius-sm);
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 19px;
	}
	.digit.blank {
		opacity: 0.18;
	}
	.row.current .digit {
		border: 2px solid var(--accent);
	}
	.digit.solid {
		background: var(--ink);
		color: var(--paper);
	}
	.pegs {
		display: grid;
		grid-template-columns: repeat(var(--cols), 9px);
		gap: 3px;
		margin-left: 8px;
	}
	.pegs i {
		width: 9px;
		height: 9px;
		border: var(--line) solid var(--ink);
		border-radius: 50%;
		opacity: 0.22;
	}
	.pegs i.hit,
	.pegs i.near {
		opacity: 1;
		animation: peg 220ms var(--ease-out) var(--delay) both;
	}
	.pegs i.hit {
		background: var(--accent);
		border-color: var(--accent);
	}
	@keyframes peg {
		from {
			transform: scale(0);
		}
	}
	.reason {
		min-height: 20px;
		margin: 6px 0;
		text-align: center;
		font-size: 13px;
		color: var(--accent);
	}
	.shake {
		animation: shake 300ms;
	}
	@keyframes shake {
		20%,
		60% {
			transform: translateX(-6px);
		}
		40%,
		80% {
			transform: translateX(6px);
		}
	}
	.pad {
		display: grid;
		gap: 6px;
	}
	.keys {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 6px;
	}
	.actions {
		display: grid;
		grid-template-columns: 1fr 2fr;
		gap: 6px;
	}
	.key {
		min-height: var(--tap);
		border: var(--line) solid var(--ink);
		border-radius: 10px;
		background: var(--paper);
		box-shadow: var(--shadow-sm);
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 19px;
		cursor: pointer;
		touch-action: manipulation;
	}
	.key:active {
		transform: translate(2px, 2px);
		box-shadow: none;
	}
	.key:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.enter {
		background: var(--ink);
		color: var(--paper);
		font-family: var(--font-ui);
		font-weight: 700;
		font-size: 15px;
	}
	.code {
		display: flex;
		gap: 6px;
	}
</style>
```

- [ ] **Step 6: Write `module.ts` and `index.ts`**

`src/lib/games/break-the-code/module.ts`:

```ts
import type { GameModule } from '$lib/platform/types';
import HowToPlay from './HowToPlay.svelte';
import type { BtcOptions, State } from './rules';
import View from './View.svelte';

const mod: GameModule<State, BtcOptions> = {
	View,
	Rules: HowToPlay,
	progressLabel: (s) => `guess ${s.guesses.length + 1} of ${s.config.maxGuesses}`,
};

export default mod;
```

`src/lib/games/break-the-code/index.ts`:

```ts
import { defineGame } from '$lib/platform/types';
import icon from './icon.svg?raw';
import type { BtcOptions, State } from './rules';

export const breakTheCode = defineGame<State, BtcOptions>({
	id: 'break-the-code',
	title: 'Break the Code',
	pitch: 'Crack the hidden digits',
	category: 'logic',
	pace: 'turn-based',
	minutes: [2, 4],
	icon,
	saveVersion: 1,
	options: [
		{
			key: 'difficulty',
			label: 'Difficulty',
			default: 'normal',
			choices: [
				{ value: 'easy', label: 'Easy', hint: '3 digits · 8 guesses' },
				{ value: 'normal', label: 'Normal', hint: '4 digits · 8 guesses' },
				{ value: 'hard', label: 'Hard', hint: '5 digits · repeats · 10 guesses' },
			],
		},
	],
	load: () => import('./module').then((m) => m.default),
});
```

- [ ] **Step 7: Register the game (the "one line")**

In `src/lib/platform/registry.ts` add the import and the entry:

```ts
import { breakTheCode } from '../games/break-the-code';
```

```ts
export const games: AnyGame[] = [breakTheCode];
```

- [ ] **Step 8: Run all tests**

```bash
npm test
npm run test:e2e
```

Expected: Vitest passes, including the registry contract test, which now runs 4 checks for `break-the-code`. Playwright: 40 passed (20 tests × 2 projects: 10 frame + 4 home + 6 Break the Code).

- [ ] **Step 9: Type-check, lint, commit**

```bash
npm run check && npm run lint
git add src/lib/games/break-the-code src/lib/platform/registry.ts e2e
git commit -m "feat(break-the-code): add playable Break the Code with keypad and peg feedback" -m "Assisted-by: Claude Code (<model>)"
```

---

### Task 14: Offline and installable (service worker, manifest, icons)

**Files:**
- Create: `src/lib/platform/sw-paths.ts`, `src/lib/platform/sw-paths.test.ts`, `src/service-worker.ts`, `static/manifest.webmanifest`, `static/icons/favicon.svg`, `scripts/make-icons.mjs`, `static/icons/{icon-192,icon-512,maskable-512,apple-touch-icon}.png` (generated), `static/.nojekyll`, `e2e/offline.spec.ts`
- Modify: `src/app.html` (manifest and icon links), `svelte.config.js` (service worker file filter), `package.json` (`icons` script)

**Interfaces:**
- Produces: `export function cacheKey(url: URL): string` (drops a trailing slash except for `/`; ignores the query string).

- [ ] **Step 1: Write the failing cache-key test**

`src/lib/platform/sw-paths.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cacheKey } from './sw-paths';

describe('cacheKey', () => {
	it('drops a trailing slash (GitHub Pages redirects /tinkster to /tinkster/)', () => {
		expect(cacheKey(new URL('https://x.io/tinkster/'))).toBe('/tinkster');
	});

	it('ignores the query string', () => {
		expect(cacheKey(new URL('https://x.io/tinkster/play/a?seed=1'))).toBe('/tinkster/play/a');
	});

	it('keeps the root path', () => {
		expect(cacheKey(new URL('https://x.io/'))).toBe('/');
	});
});
```

- [ ] **Step 2: Run to verify failure, then implement `src/lib/platform/sw-paths.ts`**

Run: `npx vitest run src/lib/platform/sw-paths.test.ts`. Expected: FAIL (module missing).

```ts
/** Normalized cache key: path only, no trailing slash (except "/"), no query string. */
export function cacheKey(url: URL): string {
	const path = url.pathname;
	return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}
```

Run again. Expected: PASS (3 tests).

- [ ] **Step 3: Write `src/service-worker.ts`**

```ts
/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, prerendered, version } from '$service-worker';
import { cacheKey } from '$lib/platform/sw-paths';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `tinkster-${version}`;
const PRECACHE = [...build, ...files, ...prerendered];
const KEYS = new Set(PRECACHE.map((path) => cacheKey(new URL(path, sw.location.href))));
const ROOT = cacheKey(new URL(sw.registration.scope));

async function precache(): Promise<void> {
	const cache = await caches.open(CACHE);
	await Promise.all(
		PRECACHE.map(async (path) => {
			const url = new URL(path, sw.location.href);
			const res = await fetch(url, { cache: 'reload' });
			if (!res.ok) throw new Error(`precache failed: ${path} (${res.status})`);
			// A redirected response (e.g. /tinkster → /tinkster/) can't answer a navigation, so re-wrap it.
			const body = res.redirected
				? new Response(await res.blob(), { status: res.status, headers: res.headers })
				: res;
			await cache.put(cacheKey(url), body);
		}),
	);
}

sw.addEventListener('install', (event) => {
	// No skipWaiting(): a new version takes over on the next launch, never mid-game.
	event.waitUntil(precache());
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
			await sw.clients.claim();
		})(),
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;
	const key = cacheKey(url);

	if (KEYS.has(key)) {
		event.respondWith(
			caches
				.open(CACHE)
				.then((cache) => cache.match(key))
				.then((hit) => hit ?? fetch(request)),
		);
	} else if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request).catch(async () => {
				const cache = await caches.open(CACHE);
				return (await cache.match(ROOT)) ?? Response.error();
			}),
		);
	}
});
```

- [ ] **Step 4: Exclude dotfiles from the precache**

In `svelte.config.js`, inside `kit`, add:

```js
serviceWorker: {
	files: (filepath) => !/(^|\/)\./.test(filepath),
},
```

- [ ] **Step 5: Write the manifest, favicon and `.nojekyll`**

`static/manifest.webmanifest`:

```json
{
	"name": "tinkster",
	"short_name": "tinkster",
	"description": "Tiny games for spare minutes. No sign-up, no tracking, works offline.",
	"start_url": "./",
	"scope": "./",
	"display": "standalone",
	"background_color": "#f7f5f0",
	"theme_color": "#f7f5f0",
	"icons": [
		{ "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
		{ "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
		{ "src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
	]
}
```

`static/icons/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#f7f5f0"/><path d="M13 6v17a3 3 0 0 0 3 3h3M9 12h10" fill="none" stroke="#161514" stroke-width="3.2" stroke-linecap="round"/><rect x="21" y="21" width="5" height="5" fill="#c93c25"/></svg>
```

`static/.nojekyll`: an empty file (`touch static/.nojekyll`).

- [ ] **Step 6: Write `scripts/make-icons.mjs` and generate the PNGs**

```js
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
```

Add to `package.json` scripts: `"icons": "node scripts/make-icons.mjs"`. Then run:

```bash
npm run icons
```

Expected: four "wrote static/icons/…" lines. Open `static/icons/icon-512.png` and check that it shows an ink "t" with a small red square on a cream background.

- [ ] **Step 7: Link the manifest and icons in `src/app.html`**

Add inside `<head>`, before `%sveltekit.head%`:

```html
		<link rel="icon" href="%sveltekit.assets%/icons/favicon.svg" type="image/svg+xml" />
		<link rel="apple-touch-icon" href="%sveltekit.assets%/icons/apple-touch-icon.png" />
		<link rel="manifest" href="%sveltekit.assets%/manifest.webmanifest" />
```

- [ ] **Step 8: Write the offline e2e test**

`e2e/offline.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { startBreakTheCode } from './helpers';

test('home and games keep working offline after the first visit', async ({
	page,
	context,
	browserName,
}) => {
	test.skip(browserName !== 'chromium', 'Playwright emulates offline service workers in Chromium only');
	await page.goto('./');
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole('heading', { level: 1, name: 'tinkster' })).toBeVisible();
	await startBreakTheCode(page);
});
```

(`startBreakTheCode` navigates to `play/break-the-code?seed=7`. Offline, that URL is served from the precache: the key ignores the query string.)

- [ ] **Step 9: Run and verify**

```bash
npm test
npm run test:e2e -- e2e/offline.spec.ts
```

Expected: unit tests pass; the offline test passes on `pixel-7` and is skipped on `iphone-se`.

- [ ] **Step 10: Commit**

```bash
npm run check && npm run lint
git add src/lib/platform/sw-paths.ts src/lib/platform/sw-paths.test.ts src/service-worker.ts static scripts/make-icons.mjs src/app.html svelte.config.js package.json e2e/offline.spec.ts
git commit -m "feat(pwa): precache the site for offline play and make it installable" -m "Assisted-by: Claude Code (<model>)"
```

---

### Task 15: Hardening gates (CSP, privacy, accessibility, visual regression, size budget)

**Files:**
- Modify: `svelte.config.js` (CSP), `package.json` (scripts)
- Create: `e2e/privacy.spec.ts`, `e2e/a11y.spec.ts`, `e2e/visual.spec.ts`, `scripts/check-size.mjs`

**Interfaces:**
- Produces npm scripts `size`, `test:visual` and `test:visual:update`.

- [ ] **Step 1: Add the Content-Security-Policy**

In `svelte.config.js`, inside `kit`, add:

```js
csp: {
	mode: 'hash',
	directives: {
		'default-src': ['self'],
		'script-src': ['self'],
		// Svelte's server-rendered style="" attributes need 'unsafe-inline'; no third-party CSS exists.
		'style-src': ['self', 'unsafe-inline'],
		'img-src': ['self', 'data:'],
		'font-src': ['self'],
		'connect-src': ['self'],
		'worker-src': ['self'],
		'manifest-src': ['self'],
		'object-src': ['none'],
		'base-uri': ['self'],
		'form-action': ['self'],
	},
},
```

Prerendered pages receive the policy as `<meta http-equiv="content-security-policy">`, and SvelteKit hashes its own inline bootstrap script.

- [ ] **Step 2: Write the privacy and CSP e2e test**

`e2e/privacy.spec.ts`:

```ts
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
```

- [ ] **Step 3: Write the accessibility e2e test**

`e2e/a11y.spec.ts`:

```ts
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
	expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
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
```

- [ ] **Step 4: Run privacy and a11y; fix real violations**

Run: `npm run test:e2e -- e2e/privacy.spec.ts e2e/a11y.spec.ts`
Expected: 22 passed (11 tests × 2 projects). If axe reports a violation, fix the component. Do not disable the rule. The usual culprit is contrast from a hard-coded opacity on text; use `--ink-soft` instead.

- [ ] **Step 5: Write the visual regression spec and scripts**

`e2e/visual.spec.ts`:

```ts
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
```

(`toHaveScreenshot` disables CSS animations by default, so the shots are stable.)

Add to `package.json` scripts. Replace `v1.63.0` with the installed version from `npx playwright --version`; the image and the package must match:

```json
"test:visual": "docker run --rm --ipc=host -v \"$PWD\":/work -v tinkster-node-modules:/work/node_modules -w /work mcr.microsoft.com/playwright:v1.63.0-noble bash -lc 'npm ci && npx playwright test --project=visual'",
"test:visual:update": "docker run --rm --ipc=host -v \"$PWD\":/work -v tinkster-node-modules:/work/node_modules -w /work mcr.microsoft.com/playwright:v1.63.0-noble bash -lc 'npm ci && npx playwright test --project=visual --update-snapshots'"
```

Baselines are produced in the same Linux container that CI uses, so they match byte-for-byte across machines. The named volume keeps Linux `node_modules` separate from your macOS ones.

- [ ] **Step 6: Generate the baselines and inspect them**

Run: `npm run test:visual:update` (requires Docker).
Expected: six PNGs under `e2e/visual.spec.ts-snapshots/`. **Open each one** and check it against `docs/specs/mockups/visual-style-bw.html` and `game-frame.html`: ink on paper, red only for accents, nothing clipped at 412px width. Then run `npm run test:visual`. Expected: 6 passed.

If Docker is unavailable, stop here and tell the author. The `visual` CI job (Task 16) can create the baselines instead, but a human must review them before they are committed.

- [ ] **Step 7: Write `scripts/check-size.mjs`**

```js
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
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(40)} ${kb(size).padStart(9)} / ${kb(budget)}`);
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
report('home route (JS+CSS, gzip)', homeFiles.reduce((sum, f) => sum + gz(f), 0), BUDGET.home);

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

const gameKeys = Object.keys(manifest).filter((k) => /^src\/lib\/games\/[^/]+\/module\.ts$/.test(k));
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
report('fonts (woff2)', fonts.reduce((sum, f) => sum + statSync(join(assetsDir, f)).size, 0), BUDGET.fonts);

if (failures.length) {
	console.error(`\nSize budget exceeded: ${failures.join(', ')}`);
	process.exit(1);
}
```

Add to `package.json` scripts: `"size": "node scripts/check-size.mjs"`.

- [ ] **Step 8: Run the size gate**

Run: `npm run build && npm run size`
Expected: four `ok` lines (home, game break-the-code, fonts, plus no fixture failure) and exit code 0. If the script cannot find the manifest, run `find . -path ./node_modules -prune -o -name manifest.json -print | grep .vite` and add the real path to `MANIFESTS`.

- [ ] **Step 9: Run everything, then commit**

```bash
npm test && npm run check && npm run lint && npm run test:e2e
git add svelte.config.js package.json e2e scripts/check-size.mjs
git commit -m "test: add CSP, privacy, accessibility, visual and size-budget gates" -m "Assisted-by: Claude Code (<model>)"
```

Expected e2e total: 63 passed, 1 skipped (20 + 1 offline + 1 privacy + 10 a11y = 32 tests × 2 projects; the offline test is skipped on WebKit).

---

### Task 16: CI and GitHub Pages deployment

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: npm scripts `check`, `lint`, `test`, `build`, `build:test`, `size`, `test:e2e`, and Playwright project `visual`.

- [ ] **Step 1: Check the current major versions of the actions**

```bash
for a in actions/checkout actions/setup-node actions/upload-artifact actions/upload-pages-artifact actions/deploy-pages; do
  printf "%-32s %s\n" $a "$(gh api repos/$a/releases/latest --jq .tag_name)"; done
```

Use the major version of each result (e.g. `v5`) in the workflow below, replacing the versions shown if they differ.

- [ ] **Step 2: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run check
      - run: npm run lint
      - run: npm test
      - run: npm run build
      - run: npm run size

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium webkit
      - run: npm run test:e2e
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report
          retention-days: 7

  visual:
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.63.0-noble # keep in sync with @playwright/test and package.json
      options: --ipc=host
    steps:
      - uses: actions/checkout@v5
      - run: npm ci
      - run: npx playwright test --project=visual
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: visual-diffs
          path: test-results
          retention-days: 7

  deploy:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    needs: [checks, e2e, visual]
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v4
        with:
          path: build
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Validate the workflow syntax locally**

Run: `npx --yes @action-validator/cli .github/workflows/ci.yml`
Expected: no output (valid). If the validator is unavailable, at least run `node -e "require('yaml')"` or `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))"` to catch YAML errors.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run all quality gates on PRs and deploy main to GitHub Pages" -m "Assisted-by: Claude Code (<model>)"
```

- [ ] **Step 5: STOP and ask the author before publishing**

Creating the GitHub repository and enabling Pages are outward-facing, hard-to-reverse actions. Ask the author to confirm the repo name (`tinkster`), its visibility (public) and the account. After an explicit yes:

```bash
gh repo create tinkster --public --source . --remote origin
git push -u origin docs/v1-design
git push -u origin feat/v1-foundation
gh api -X POST "repos/{owner}/tinkster/pages" -f build_type=workflow
```

Then open PRs. The first PR is `docs/v1-design` into `main`, which gives `main` its first commit; after the author merges it, retarget or rebase `feat/v1-foundation` onto `main`. Use the PR template from the git-workflow conventions. **Never merge**; the author merges. The first deploy happens when the foundation PR lands on `main`. Verify it by opening `https://<owner>.github.io/tinkster/` on a phone.

---

### Task 17: Documentation

**Files:**
- Create: `README.md`, `AGENTS.md`, `docs/adding-a-game.md`, `THIRD_PARTY.md`

- [ ] **Step 1: Write `docs/adding-a-game.md`**

This document is the contract for Plan 3's acceptance test (Snake gets built from it alone), so it must be complete and exact.

````markdown
# Adding a game

A game is **one folder** under `src/lib/games/<id>/` plus **one line** in
`src/lib/platform/registry.ts`. If you find yourself editing anything under
`src/lib/platform/` or `src/routes/`, stop: the platform contract is missing something.
Raise it as its own change rather than patching around it.

## 1. Files

```
src/lib/games/<id>/
  rules.ts          pure state, actions, scoring
  rules.test.ts     unit + property tests (required by the registry contract test)
  View.svelte       the board and controls
  HowToPlay.svelte  content of the "?" sheet
  module.ts         default-exports the GameModule
  index.ts          exports the GameDefinition
  icon.svg          40×40 line icon
```

`<id>` is a kebab-case slug (`[a-z0-9]+(-[a-z0-9]+)*`) and becomes the URL `/play/<id>`.

## 2. `rules.ts`: pure logic

- Export a `State` type that is **JSON-serializable** (plain objects, arrays, numbers,
  strings, booleans). Resume works by saving it verbatim.
- Export `newGame(options, rng)` and one or more pure transition functions, e.g.
  `reduce(state, action)` or `step(state)`. Return the **same object** when nothing changes.
- No DOM, no timers, no `Math.random()`, no `Date`. Randomness comes in through
  `Rng` (`import type { Rng } from '$lib/platform/rng'`): `rng.int(min, max)`,
  `rng.pick(items)`, `rng.shuffle(items)`, `rng.next()`.
- Options arrive as strings. Validate them (`Object.hasOwn(TABLE, value)`) and fall back to a default.

## 3. `rules.test.ts`

Unit tests for concrete cases, plus **property tests** (`fast-check`) for invariants.
Examples: a score is within bounds, the state never mutates, the same seed gives the
same game. Use `createRng(seed)` from `$lib/platform/rng` for deterministic setups.

## 4. `View.svelte`

```svelte
<script lang="ts">
  import { untrack } from 'svelte';
  import type { GameProps } from '$lib/platform/types';
  import { newGame, type MyOptions, type State } from './rules';

  let { options, saved, ctx }: GameProps<State, MyOptions> = $props();
  let game = $state<State>(untrack(() => saved ?? newGame(options, ctx.rng)));

  $effect(() => ctx.setMeta(`Score ${game.score}`, 'one life'));
</script>
```

The `GameContext` (`ctx`) is your only connection to the platform:

| Call | When |
|---|---|
| `ctx.save(state)` | after **every** state change; it's debounced, and the frame flushes it when the player leaves |
| `ctx.finish({ stamp, headline, detail?, reveal? })` | once, when the game ends; shows the end card and clears the save |
| `ctx.setMeta(left, right?)` | status line under the top bar |
| `ctx.paused` | reactive; while true, ignore input and don't advance |
| `ctx.timer(ms, onExpire)` | a countdown that freezes while paused; the frame draws the red strip |
| `ctx.rng` | seeded randomness (deterministic in e2e tests) |
| `ctx.feedback.sound('tick' \| 'pop' \| 'stamp' \| 'fail')`, `.haptic('tap' \| 'success' \| 'error')` | game feel; both respect user settings |

`reveal` is a snippet shown on the end card. Declare it at the top level of your template
(`{#snippet answer()}…{/snippet}`) and pass `reveal: answer`.

### Turn-based input
Buttons in the bottom third of the screen, plus `<svelte:window onkeydown={…} />` for
desktop keys. Call `e.preventDefault()` for keys you handle.

### Real-time games
Use the fixed-step loop and swipe input from the platform:

```ts
import { onMount } from 'svelte';
import { startLoop } from '$lib/platform/loop';
import { attachSwipe, keyToDirection, TurnBuffer } from '$lib/platform/input/swipe';

let canvas = $state<HTMLCanvasElement>();
const turns = new TurnBuffer(2);

onMount(() => {
  const detachSwipe = attachSwipe(document.body, (dir) => {
    if (!ctx.paused) turns.push(dir, game.heading);
  });
  const stop = startLoop({
    stepMs: () => game.stepMs,
    step: () => {
      game = step(game, turns.next(game.heading));
      ctx.save(game);
      if (game.over) ctx.finish({ stamp: 'Game over', headline: `Score ${game.score}` });
    },
    render: () => draw(canvas, game),
    isPaused: () => ctx.paused,
  });
  return () => { stop(); detachSwipe(); };
});
```

- `startLoop` never steps while `ctx.paused` is true and never "catches up" afterwards.
  The frame shows a 3-2-1 countdown on resume for `pace: 'realtime'` and `'timed'` games.
- Canvas colors: read tokens at draw time so dark mode works:
  `getComputedStyle(canvas).getPropertyValue('--ink')`, likewise `--paper` and `--accent`.
- Size the canvas backing store by `devicePixelRatio`, and keep cells ≥ 16 CSS px.

### Style rules
- Colors only via tokens: `var(--ink)`, `var(--paper)`, `var(--accent)`, `var(--on-accent)`,
  `var(--ink-soft)`, `var(--ink-faint)`. Never hex values.
- Fonts: `var(--font-display)` (Fraunces) for big glyphs, `var(--font-ui)` (Inter) otherwise.
- Tap targets ≥ `var(--tap)` (44px). No emoji in UI.
- Give meaningful regions accessible names (`aria-label`, `role="group"`), and make sure
  state is readable without color (fill vs outline vs hatching).

## 5. `HowToPlay.svelte`
Three to six short lines. Plain markup; it renders inside the rules sheet.

## 6. `module.ts`

```ts
import type { GameModule } from '$lib/platform/types';
import HowToPlay from './HowToPlay.svelte';
import type { MyOptions, State } from './rules';
import View from './View.svelte';

const mod: GameModule<State, MyOptions> = {
  View,
  Rules: HowToPlay,
  progressLabel: (s) => `score ${s.score}`, // shown on the home resume card
};
export default mod;
```

## 7. `icon.svg`
`viewBox="0 0 40 40"`, strokes only (the tile applies the stroke color and width). Add
`class="accent"` to the one element that should be red, and `class="fill"` to solid ink
shapes. No `fill`/`stroke` colors inline.

## 8. `index.ts`

```ts
import { defineGame } from '$lib/platform/types';
import icon from './icon.svg?raw';
import type { MyOptions, State } from './rules';

export const myGame = defineGame<State, MyOptions>({
  id: 'my-game',
  title: 'My Game',
  pitch: 'One line, ≤ 40 characters',
  category: 'arcade',          // 'words' | 'logic' | 'arcade'
  pace: 'realtime',            // 'turn-based' | 'timed' | 'realtime'
  minutes: [1, 5],
  icon,
  saveVersion: 1,              // bump whenever State's shape changes
  options: [/* optional: { key, label, default, choices: [{ value, label, hint? }] } */],
  load: () => import('./module').then((m) => m.default),
});
```

## 9. Register it (the one line)
In `src/lib/platform/registry.ts`: import your definition and add it to `games`.
Its position within its category is its position on the home screen.

## 10. End-to-end test
Create `e2e/<id>.spec.ts`. Open `play/<id>?seed=N`, and the game's RNG is seeded with `N`
(`N + 1` after one "Play again", and so on). Compute the expected setup in the test by
importing your `rules.ts` and `createRng` from `src/lib/platform/rng`, as
`e2e/helpers.ts` does for Break the Code. Cover: start → a deterministic win or end →
end card → Play again, plus resume from the home screen.

## 11. Before opening the PR

```bash
npm test && npm run check && npm run lint
npm run test:e2e
npm run build && npm run size
npm run test:visual   # add screenshots for your game if its look matters
```

Then check `git diff --stat main -- src/lib/platform src/routes`. It should show only the
one-line registry change.
````

- [ ] **Step 2: Write `AGENTS.md`**

```markdown
# AGENTS.md: working on tinkster

tinkster is a static, offline, no-tracking mini-games site. SvelteKit (Svelte 5 runes) +
TypeScript, prerendered with adapter-static, deployed to GitHub Pages.

## Read first
- Design spec: `docs/specs/2026-09-27-tinkster-v1-design.md`
- Plans: `docs/plans/`
- Adding a game: `docs/adding-a-game.md`

## Architecture in one breath
`src/lib/platform/` is the foundation: registry, game frame, saves, RNG, timer, loop,
input, feedback, UI tokens. `src/lib/games/<id>/` holds one game each: pure `rules.ts`
plus a `View.svelte` that talks to the platform only through `GameContext`. The frame owns
chrome, pause, resume slots, the end card and error recovery.

## Commands
| Task | Command |
|---|---|
| Dev server (also reachable from your phone on the LAN) | `npm run dev -- --host` |
| Unit + property tests | `npm test` |
| Types (strict, warnings fail) | `npm run check` |
| Lint/format | `npm run lint` / `npm run format` |
| E2E (iPhone SE + Pixel 7) | `npm run test:e2e` |
| Visual regression (Docker) | `npm run test:visual` |
| Size budget | `npm run build && npm run size` |

## Rules
- Svelte 5 runes only. TypeScript `^6` (not 7; the Svelte tooling peers stop at 6).
- No runtime dependencies. Colors only via tokens in `src/lib/platform/ui/tokens.css`.
- `rules.ts` files are pure: no DOM, timers, `Math.random`, `Date`.
- Every game passes the registry contract test and has `rules.test.ts` and an e2e spec.
- Nothing may contact another origin (a test enforces this).
- Git: feature branches, Conventional Commits, `Assisted-by: <agent> (<model>)` trailer,
  no `Co-Authored-By`. Never commit `CLAUDE.md`. Never merge; the maintainer merges.
```

- [ ] **Step 3: Write `README.md`**

```markdown
# tink*ster*

Tiny games for spare minutes: the checkout line, the waiting room.
Open it, play for two to fifteen minutes, forget about it.

- **No sign-up, no tracking, no ads.** Nothing you do leaves your device, and a test fails
  the build if the site ever contacts another server.
- **Works offline** after the first visit, and installs to your home screen.
- **One thumb.** Built for phones first; keyboard works on desktop.

Play: https://&lt;owner&gt;.github.io/tinkster/

## Games
| Game | What it is |
|---|---|
| Break the Code | Crack a hidden digit code from peg feedback (Mastermind with numbers). |

More are on the way: Letters & Numbers, Snake, Honeycomb, Emojigrams, Brick Breaker, Alien
Wave, Road Hop.

## Run it
```bash
nvm use            # Node 22
npm ci
npm run dev -- --host
```

## How it's built
SvelteKit (Svelte 5) + TypeScript, prerendered to static files. Each game is one folder
that plugs into a shared game frame through a small typed contract. See
[docs/adding-a-game.md](docs/adding-a-game.md).

Quality is enforced by CI on every PR: strict types, lint, unit and property tests,
end-to-end tests on two phone sizes, accessibility (axe), visual regression, an offline
test, a privacy test and a size budget.

### Built with AI assistance
This project is developed with AI coding agents under human direction. Every feature goes
spec → plan → reviewed PR; the documents are in [docs/specs](docs/specs) and
[docs/plans](docs/plans), and every AI-assisted commit carries an `Assisted-by:` trailer.

## License
Code: MIT. Fonts and other third-party material: see [THIRD_PARTY.md](THIRD_PARTY.md).
```

(Replace `<owner>` with the GitHub account once the repo exists.)

- [ ] **Step 4: Write `THIRD_PARTY.md`**

Fill in the Fontsource package versions you recorded in Task 5, Step 1.

```markdown
# Third-party material

## Fonts
Both fonts are licensed under the SIL Open Font License 1.1; license texts are in
`src/lib/platform/ui/fonts/`. Latin subsets were taken from Fontsource packages:

| Font | Author | Package | Files |
|---|---|---|---|
| Fraunces | Undercase Type (Phaedra Charles, Flavia Zimbardi) | `@fontsource-variable/fraunces@<version>`, `@fontsource/fraunces@<version>` | `fraunces-wght.woff2`, `fraunces-700-italic.woff2` |
| Inter | Rasmus Andersson | `@fontsource-variable/inter@<version>` | `inter-wght.woff2` |
```

- [ ] **Step 5: Commit**

```bash
npm run lint
git add README.md AGENTS.md THIRD_PARTY.md docs/adding-a-game.md
git commit -m "docs: add README, agent guide, add-a-game contract and third-party notices" -m "Assisted-by: Claude Code (<model>)"
```

---

## Final verification (after Task 17)

- [ ] `npm test && npm run check && npm run lint && npm run build && npm run size && npm run test:e2e && npm run test:visual`. All green.
- [ ] Human check on a real phone (`npm run dev -- --host`): home → Break the Code → play a game → leave mid-game → resume from home → finish → Play again. Toggle the phone's dark mode. Turn on airplane mode after one visit to the built site (`npm run build && npx vite preview --host`) and reload.
- [ ] `git log --oneline` shows one Conventional Commit per task, each with the `Assisted-by` trailer.

## Next plans
- **Plan 2: Letters & Numbers + word list pipeline** (spec §8.2, §9). Adds `src/lib/platform/words/` (the one platform change Plan 2 is allowed to make), `scripts/build-words.ts`, and the game.
- **Plan 3: Snake** (spec §8.3). Written from `docs/adding-a-game.md` only; acceptance = zero diff under `src/lib/platform/` and `src/routes/` apart from the registry line.

