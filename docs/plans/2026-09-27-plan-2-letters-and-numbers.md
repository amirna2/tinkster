# tinkster Plan 2: Letters & Numbers + Word List, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Letters & Numbers (letters, numbers and conundrum rounds, and a six-round mini match) with its offline English word list and a "dictionary corner" solver running in a Web Worker.

**Architecture:** The pure round logic lives in small, focused files inside `src/lib/games/letters-and-numbers/` (`letters.ts`, `numbers.ts`, `conundrum.ts`, composed by `rules.ts`). A Web Worker (`solver.worker.ts`) loads the word list once and answers word checks, best-word searches and the numbers solver. The word list is built offline from a pinned SCOWL release by `scripts/build-words.mjs`, committed under `src/lib/platform/words/`, and content-hashed by Vite at build time, so the service worker precaches it with the rest of the build. The platform gains two small things the first timed game needs: a timer that can resume part-way through, and a timer strip whose space is reserved from the start.

**Tech Stack:** The Plan 1 stack is unchanged: SvelteKit 2, Svelte 5 runes, TypeScript 6, Vite 8, Vitest 5 + fast-check 4, Playwright 1.63 + axe, Biome 2. Also a module Web Worker, and Node 22 for the word-list script.

**Spec:** [`docs/specs/2026-09-27-tinkster-v1-design.md`](../specs/2026-09-27-tinkster-v1-design.md). This plan implements §8.2 and §9. It also covers the parts of §10 that belong to this game: the word-list gate, the Numbers, Letters and Conundrum property tests, and the game's place in the e2e, a11y, offline, privacy, visual and size gates. Read `docs/HANDOFF.md` §11 for what Plan 1 decided and deferred.

**Out of scope:** Snake (Plan 3). Deferred Plan 1 items (HANDOFF §11 "Known and deferred").

## Decisions this plan makes (author: please review)

Where the spec is silent, or the real code or data forced a choice:

| # | Decision | Why |
|---|---|---|
| D1 | `ctx.timer(ms, onExpire, elapsedMs?)`: a third, optional argument starts the countdown part-way through. | A resumed round must show its true time left on the strip. Without it, the strip would read full with 12 s left. |
| D2 | Timed games get the timer strip's space as soon as play starts, shown empty until a clock runs. | A letters round's clock starts only after nine letters are drawn. Without this, the strip would push the board down 14 px mid-draw. |
| D3 | Word files live in `src/lib/platform/words/` and are imported with `?url`, not placed at `static/words/en.<hash>.txt` behind a hand-made manifest lookup. | Vite content-hashes them, which is the spec's intent, with no custom hashing and no lookup at runtime. The service worker precaches everything in `build`, so they are available offline. |
| D4 | The build script is `scripts/build-words.mjs`, not `.ts`. | Node 22.16 doesn't run `.ts` without a flag, and the repo's other scripts are `.mjs`. |
| D5 | SCOWL is pinned to **2020.12.07**, with its sha256 checked. | This is the last release that ships sized word lists. The 2026.02.25 release contains only hunspell and aspell dictionaries. |
| D6 | Conundrum answers come from SCOWL sizes ≤ 50 (about 8,500 words). The one-anagram rule is checked against the full list, and **before** the blocklist is applied. | Size-70 answers include very obscure words. Checking before the blocklist means a scramble can never spell a removed slur. |
| D7 | The curated lists name every form explicitly; there is no automatic plural expansion. | Automatic expansion goes wrong: `jap` + `es` = `japes`. |
| D8 | Conundrum allows repeated guesses within the 30 s. A wrong guess shakes and says "Not the word". | Spec §8.2 says only "10 points if correct within 30 s". Retries suit family play. |
| D9 | Lock in is allowed with fewer than 3 letters, or with none, and scores 0 without asking the dictionary. | It matches declaring nothing on TV, and needs no special case. |
| D10 | Subtraction is first tile minus second tile. A non-positive result is rejected ("Results must stay above zero"); the tiles are not swapped automatically. | Spec §8.2: subtraction must be positive. |
| D11 | Word checks also run in the worker, where the list is loaded once. The small conundrum list is fetched on the main thread. | The main thread never parses the 1.1 MB list, and a conundrum round needs its answer before it starts. |
| D12 | A round's "best" score is `max(solver's best, your score)`. | A player may use a never-suggest word that the solver won't offer. |
| D13 | End card stamp: **Perfect!** when your total equals the best total (and is above 0). Otherwise **Match over** or **Round over**. Headline `N / M`, detail "yours / best possible". Reveal: a table of each round, your answer against the best. | Spec §8.2 "Match result". |
| D14 | e2e helpers import only game files that have no runtime `$lib` imports (`numbers.ts`, `labels.ts`, `platform/words`). The word oracles read the committed files. | Playwright doesn't resolve SvelteKit's `$lib` alias, and the oracles stay independent of the game's solver. |
| D15 | The word list keeps spec §9's 3–15 letters, although this game uses at most 9. It is 313 KB gzipped, and the service worker precaches it on the first visit. | Honeycomb will need the longer words. Offline play of every game after one visit is a v1 success criterion (§4). |
| D16 | After Lock in, the strip freezes where the clock stopped, until the next round's clock starts. | No contract change is needed to reset it, and it shows how fast you were. |
| D17 | A small `Burst.svelte` in `platform/ui` gives the red ink burst on a round where you matched the best. | Spec §6.4. HANDOFF §5 deferred it to this plan. |

## Global Constraints

- Node 22 LTS (`.nvmrc`), npm with the committed lockfile. **No new dependencies**, dev or runtime.
- **TypeScript `^6`**; Svelte 5 **runes only**. `svelte-check --fail-on-warnings`: fix warnings, don't suppress them.
- Colors only through the tokens in `src/lib/platform/ui/tokens.css`. Emoji never appear in UI chrome.
- A game imports only from `$lib/platform/…` and its own folder. Pure logic files (`rules.ts`, `letters.ts`, `numbers.ts`, `conundrum.ts`, `board.ts`) contain no DOM, no timers, no `Math.random` and no `Date`; randomness comes in through `Rng`.
- Game state is JSON-serializable. Keep it in `$state.raw`: it is replaced whole on every change and posted to a Worker, and a deep `$state` proxy cannot be structured-cloned.
- `numbers.ts`, `round.ts`, `labels.ts` and `src/lib/platform/words/index.ts` have **no runtime `$lib` imports**; `import type` is fine. `e2e/helpers.ts` imports them.
- Nothing contacts another origin at runtime. The word files are fetched from the site itself.
- Tap targets ≥ 44 px. State never relies on color alone.
- Budgets: home ≤ 100 KB, each game chunk ≤ 50 KB (the word list is excluded), fonts ≤ 110 KB.
- Word list (spec §9): lowercase `a–z`, 3–15 letters; blocklisted words are removed entirely; never-suggest words are accepted when typed, but never suggested and never used as conundrums.
- **Never run `biome migrate`**: it silently disables the recommended rules. Run `npm run format` before each commit.
- Git: branch `feat/letters-and-numbers` off `main`. Conventional Commits. End every commit with `Assisted-by: Claude Code (<model you are running as>)`. **Never** add `Co-Authored-By`. **Never** commit `CLAUDE.md`, `AI_DEVELOPER.md` or `CONTEXT.md`. Never merge; the author merges.

## Branch setup (before Task 1)

- [ ] `git fetch origin && git checkout -b feat/letters-and-numbers origin/main`. If the Plan 2 docs PR isn't merged yet, branch from `docs/plan-2-letters-numbers` instead.
- [ ] Baseline: `npm ci && npm test && npm run check`. Expected: all tests pass (112 at the end of Plan 1), 0 errors and 0 warnings.

## File map

```
src/lib/platform/
  timer.ts  timer.svelte.ts  types.ts  frame/session.svelte.ts   (T1: elapsedMs)
  frame/GameFrame.svelte  frame/TimerStrip.svelte                  (T1: reserved strip)
  words/index.ts        WordList, signature, parse + load helpers    (T2)
  words/words.test.ts   parser tests (T2) + word-list gate (T3)
  words/en.txt  en-conundrums.txt  en.manifest.json  LICENSE-SCOWL.txt   (T3, generated)
  words/urls.ts         content-hashed URLs of the two word files   (T7)
  ui/Burst.svelte       red ink burst                                (T8)
  registry.ts           + lettersAndNumbers                          (T8)
scripts/
  build-words.mjs       the spec §9 pipeline                         (T3)
  wordlist/scowl.mjs    pinned SCOWL download + reader               (T3)
  wordlist/curated.mjs  reads the curated lists                      (T3)
  wordlist/candidates.mjs  prints curation candidates from LDNOOBW   (T3)
  wordlist/blocklist.txt  wordlist/never-suggest.txt  (curated)      (T3)
src/lib/games/letters-and-numbers/
  round.ts              shared vocabulary: phases, actions, steps    (T4)
  board.ts              the letter-tile board (letters + conundrum)  (T4)
  letters.ts  letters.test.ts                                        (T4)
  numbers.ts  numbers.test.ts   includes the numbers solver          (T5)
  conundrum.ts  rules.ts  rules.test.ts                              (T6)
  solver.ts  solver.test.ts  solver.worker.ts  dictionary.ts          (T7)
  labels.ts  TileRow.svelte  Draw.svelte  WordBoard.svelte            (T8)
  NumbersBoard.svelte  Corner.svelte  View.svelte  HowToPlay.svelte   (T8)
  module.ts  index.ts  icon.svg                                      (T8)
e2e/helpers.ts  letters-and-numbers.spec.ts  home.spec.ts            (T9)
e2e/a11y.spec.ts  offline.spec.ts  privacy.spec.ts  visual.spec.ts   (T10)
docs/adding-a-game.md  AGENTS.md  README.md  THIRD_PARTY.md  docs/specs/…  docs/HANDOFF.md
```

---

### Task 1: A timer that resumes part-way, and a reserved timer strip

**Files:**
- Modify: `src/lib/platform/timer.ts`, `src/lib/platform/timer.svelte.ts`, `src/lib/platform/types.ts`, `src/lib/platform/frame/session.svelte.ts`, `src/lib/platform/frame/TimerStrip.svelte`, `src/lib/platform/frame/GameFrame.svelte`, `docs/adding-a-game.md`
- Test: `src/lib/platform/timer.test.ts`, `src/lib/platform/frame/session.test.ts`

**Interfaces:**
- Produces:
  - `createCountdown(durationMs: number, elapsedMs = 0): Countdown`.
  - `new RafTimer(durationMs, onExpire, isPaused, frames = browserFrames, elapsedMs = 0)`.
  - `createRafTimer(durationMs, onExpire, isPaused, elapsedMs = 0, frames?)`.
  - `TimerFactory = (durationMs, onExpire, isPaused, elapsedMs: number) => SyncedTimer`.
  - `GameContext.timer(durationMs: number, onExpire: () => void, elapsedMs?: number): PausableTimer`.
  - `TimerStrip` takes `timer: PausableTimer | null`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/platform/timer.test.ts`, add to `describe('countdown (pure)', …)`:

```ts
	it('can start part-way through, clamped to the duration', () => {
		expect(remainingMs(createCountdown(1000, 400), 0)).toBe(600);
		expect(remainingMs(createCountdown(1000, -50), 0)).toBe(1000);
		expect(remainingMs(createCountdown(1000, 5000), 0)).toBe(0);
	});
```

and to `describe('RafTimer', …)`:

```ts
	it('starts part-way through when given elapsedMs', () => {
		const frames = fakeFrames();
		const timer = new RafTimer(30_000, () => {}, () => false, frames, 12_000);
		expect(timer.durationMs).toBe(30_000);
		expect(timer.remainingMs).toBe(18_000);
		frames.advance(1000);
		expect(timer.remainingMs).toBe(17_000);
	});
```

In `src/lib/platform/frame/session.test.ts`, add to `describe('GameSession timers', …)`:

```ts
	it('passes elapsedMs through, so a resumed round keeps its time', () => {
		const frames = fakeFrames();
		const { session } = setup({
			createTimer: (ms, onExpire, isPaused, elapsedMs) =>
				new RafTimer(ms, onExpire, isPaused, frames, elapsedMs),
		});
		const timer = session.ctx.timer(30_000, () => {}, 12_000);
		expect(session.timer).toBe(timer);
		expect(timer.remainingMs).toBe(18_000);
	});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/platform/timer.test.ts src/lib/platform/frame/session.test.ts`
Expected: the 3 new tests FAIL (e.g. `expected 1000 to be 600`, `expected 30000 to be 18000`).

- [ ] **Step 3: Implement**

`src/lib/platform/timer.ts`: replace `createCountdown`:

```ts
/** A stopped countdown. `elapsedMs` starts it part-way through, clamped to the duration. */
export function createCountdown(durationMs: number, elapsedMs = 0): Countdown {
	return {
		durationMs,
		elapsedMs: Math.min(Math.max(elapsedMs, 0), durationMs),
		runningSince: null,
	};
}
```

`src/lib/platform/timer.svelte.ts`: in the `RafTimer` constructor, add the parameter after `frames`, and use it:

```ts
	constructor(
		durationMs: number,
		onExpire: () => void,
		isPaused: () => boolean,
		frames: FrameDeps = browserFrames,
		elapsedMs = 0,
	) {
		this.durationMs = durationMs;
		this.remainingMs = durationMs;
		this.#countdown = createCountdown(durationMs, elapsedMs);
		this.#onExpire = onExpire;
		this.#isPaused = isPaused;
		this.#frames = frames;
		this.#tick();
	}
```

and replace `createRafTimer`:

```ts
export function createRafTimer(
	durationMs: number,
	onExpire: () => void,
	isPaused: () => boolean,
	elapsedMs = 0,
	frames?: FrameDeps,
): SyncedTimer {
	return new RafTimer(durationMs, onExpire, isPaused, frames, elapsedMs);
}
```

`src/lib/platform/types.ts`: replace the `timer` member of `GameContext`:

```ts
	/**
	 * A countdown that freezes while paused; the frame shows it as the red timer strip. Pass
	 * `elapsedMs` to start part-way through, e.g. when resuming a saved round.
	 */
	timer(durationMs: number, onExpire: () => void, elapsedMs?: number): PausableTimer;
```

`src/lib/platform/frame/session.svelte.ts`: update the factory type:

```ts
export type TimerFactory = (
	durationMs: number,
	onExpire: () => void,
	isPaused: () => boolean,
	elapsedMs: number,
) => SyncedTimer;
```

and in the constructor's `ctx`, change the `timer` entry's signature and factory call:

```ts
			timer: (durationMs, onExpire, elapsedMs = 0) => {
				this.timer?.stop();
				// onExpire runs from an animation frame, outside the frame's error boundary.
				const expire = () => {
					try {
						onExpire();
					} catch (error) {
						deps.onError(error);
					}
				};
				const timer = (deps.createTimer ?? createRafTimer)(
					durationMs,
					expire,
					() => this.paused,
					elapsedMs,
				);
				this.timer = timer;
				return timer;
			},
```

- [ ] **Step 4: Reserve the strip for timed games**

Replace `src/lib/platform/frame/TimerStrip.svelte`'s script and markup (keep its `<style>` block):

```svelte
<script lang="ts">
	import type { PausableTimer } from '../types';

	/** null: a timed game whose clock hasn't started yet; the strip shows empty. */
	let { timer }: { timer: PausableTimer | null } = $props();
	const fraction = $derived(
		timer && timer.durationMs > 0 ? timer.remainingMs / timer.durationMs : 0,
	);
	const label = $derived(
		timer ? `${Math.ceil(timer.remainingMs / 1000)} seconds left` : 'Clock not started',
	);
</script>

<div class="strip" role="timer" aria-label={label}>
	<i style:transform="scaleX({fraction})"></i>
</div>
```

In `src/lib/platform/frame/GameFrame.svelte`, replace
`{#if session?.timer}<TimerStrip timer={session.timer} />{/if}` with:

```svelte
		<!-- Timed games keep the strip's place once play starts, so it never pushes the board down. -->
		{#if session?.timer || (game.pace === 'timed' && phase === 'playing')}
			<TimerStrip timer={session?.timer ?? null} />
		{/if}
```

- [ ] **Step 5: Document the new argument**

In `docs/adding-a-game.md`, replace the `ctx.timer` table row with:

```md
| `ctx.timer(ms, onExpire, elapsedMs?)` | a countdown that freezes while paused; the frame draws the red strip (timed games get the strip's space from the start), and an error thrown by `onExpire` shows the frame's error screen. Pass `elapsedMs` to resume a saved clock part-way |
```

- [ ] **Step 6: Run the gates**

Run: `npx vitest run src/lib/platform && npm run check && npx playwright test e2e/frame.spec.ts --project=pixel-7`
Expected: all unit tests pass, and check reports 0 errors and 0 warnings. `frame.spec.ts` passes; the fixture's timer strip is unchanged.

- [ ] **Step 7: Commit**

```bash
npm run format
git add src/lib/platform docs/adding-a-game.md
git commit -m "feat(platform): resume timers part-way and reserve the timed strip

Assisted-by: Claude Code (<model>)"
```

---

### Task 2: Word-list reader

**Files:**
- Create: `src/lib/platform/words/index.ts`
- Test: `src/lib/platform/words/words.test.ts`

**Interfaces:**
- Produces:
  - `interface WordList { words: ReadonlySet<string>; neverSuggest: ReadonlySet<string>; bySignature: ReadonlyMap<string, readonly string[]> }`
  - `signature(word): string`, `parseLines(text): string[]`, `parseWordList(text): WordList`
  - `loadWordList(url): Promise<WordList>`, `loadLines(url): Promise<string[]>`
  - File format: one lowercase word per line; never-suggest words are prefixed with `!`.
  - This file has no imports at all. `e2e/helpers.ts` imports it.

- [ ] **Step 1: Write the failing test**

`src/lib/platform/words/words.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseLines, parseWordList, signature } from './index';

describe('signature', () => {
	it('sorts the letters, so anagrams share one', () => {
		expect(signature('listen')).toBe('eilnst');
		expect(signature('silent')).toBe(signature('listen'));
	});
});

describe('parseLines', () => {
	it('drops blank lines and surrounding whitespace', () => {
		expect(parseLines('cat\n\n dog \r\n')).toEqual(['cat', 'dog']);
	});
});

describe('parseWordList', () => {
	const list = parseWordList('act\ncat\n!damn\nlisten\nsilent\ntac\n');

	it('accepts every word, never-suggest ones included', () => {
		expect([...list.words]).toEqual(['act', 'cat', 'damn', 'listen', 'silent', 'tac']);
	});

	it('marks never-suggest words', () => {
		expect([...list.neverSuggest]).toEqual(['damn']);
	});

	it('groups only suggestible words by signature', () => {
		expect(list.bySignature.get('act')).toEqual(['act', 'cat', 'tac']);
		expect(list.bySignature.get('eilnst')).toEqual(['listen', 'silent']);
		expect(list.bySignature.get(signature('damn'))).toBeUndefined();
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/platform/words`
Expected: FAIL, because `./index` can't be resolved.

- [ ] **Step 3: Implement**

`src/lib/platform/words/index.ts`:

```ts
// Word lists shared by word games (spec §9). No imports: e2e/helpers.ts loads this file directly.

/** A parsed word list: the build script writes one lowercase word per line, `!` marking never-suggest. */
export interface WordList {
	/** Every accepted word, never-suggest ones included. */
	readonly words: ReadonlySet<string>;
	/** Vulgar but legitimate: accepted when a player enters one, never offered by a solver. */
	readonly neverSuggest: ReadonlySet<string>;
	/** Suggestible words grouped by signature, for anagram and solver queries. */
	readonly bySignature: ReadonlyMap<string, readonly string[]>;
}

/** The word's letters in alphabetical order: anagrams share a signature. */
export function signature(word: string): string {
	return [...word].sort().join('');
}

export function parseLines(text: string): string[] {
	return text
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line !== '');
}

export function parseWordList(text: string): WordList {
	const words = new Set<string>();
	const neverSuggest = new Set<string>();
	const bySignature = new Map<string, string[]>();
	for (const line of parseLines(text)) {
		const hidden = line.startsWith('!');
		const word = hidden ? line.slice(1) : line;
		words.add(word);
		if (hidden) {
			neverSuggest.add(word);
			continue;
		}
		const key = signature(word);
		const group = bySignature.get(key);
		if (group) group.push(word);
		else bySignature.set(key, [word]);
	}
	return { words, neverSuggest, bySignature };
}

async function fetchText(url: string): Promise<string> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
	return res.text();
}

export async function loadWordList(url: string): Promise<WordList> {
	return parseWordList(await fetchText(url));
}

export async function loadLines(url: string): Promise<string[]> {
	return parseLines(await fetchText(url));
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/platform/words && npm run check`
Expected: 6 tests pass, and check reports 0 errors and 0 warnings.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/lib/platform/words
git commit -m "feat(words): add the word-list reader

Assisted-by: Claude Code (<model>)"
```

---

### Task 3: Word-list pipeline, curated lists and the committed English list

**Files:**
- Create: `scripts/wordlist/scowl.mjs`, `scripts/wordlist/curated.mjs`, `scripts/wordlist/candidates.mjs`, `scripts/wordlist/blocklist.txt`, `scripts/wordlist/never-suggest.txt`, `scripts/build-words.mjs`
- Generate and commit: `src/lib/platform/words/en.txt`, `src/lib/platform/words/en-conundrums.txt`, `src/lib/platform/words/en.manifest.json`, `src/lib/platform/words/LICENSE-SCOWL.txt`
- Modify: `package.json` (scripts), `THIRD_PARTY.md`
- Test: `src/lib/platform/words/words.test.ts` (append the gate)

**Interfaces:**
- Consumes: `parseLines`, `parseWordList` and `signature` from Task 2.
- Produces:
  - Committed `en.txt`: sorted, one word per line, `!` marks never-suggest.
  - Committed `en-conundrums.txt`: sorted 9-letter answers.
  - `en.manifest.json` with `counts.{words, neverSuggest, conundrums, blocked}`.
  - `readCurated(path): Set<string>`.
  - npm scripts `words` and `words:candidates`.

This task needs network access (SourceForge and GitHub) and judgment (Step 3). The resulting word list is about 114,000 words, 1.1 MB raw and 313 KB gzipped, with about 8,500 conundrums.

- [ ] **Step 1: The SCOWL reader and the curated-list reader**

`scripts/wordlist/scowl.mjs`:

```js
// The pinned SCOWL release (spec §9), downloaded once into the OS temp directory and verified.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The last SCOWL release that ships the sized word lists (later releases are dictionaries only). */
export const SCOWL = {
	version: '2020.12.07',
	url: 'https://downloads.sourceforge.net/wordlist/scowl-2020.12.07.tar.gz',
	sha256: '5587667caa20c4891390c2d42dbb4d5c4c3f41bee77af1457ece3ba23fb859cc',
};
/** SCOWL "english" words are shared by all spellings; add the American and British variants. */
export const SPELLINGS = ['english', 'american', 'british'];
const WORD = /^[a-z]{3,15}$/;

let unpacked;

/** Downloads (once), verifies and unpacks SCOWL; resolves to the unpacked release directory. */
async function scowlDir() {
	unpacked ??= (async () => {
		const cache = join(tmpdir(), 'tinkster-scowl');
		const tarball = join(cache, `scowl-${SCOWL.version}.tar.gz`);
		mkdirSync(cache, { recursive: true });
		if (!existsSync(tarball)) {
			const res = await fetch(SCOWL.url);
			if (!res.ok) throw new Error(`SCOWL download failed: HTTP ${res.status}`);
			writeFileSync(tarball, Buffer.from(await res.arrayBuffer()));
		}
		const digest = createHash('sha256').update(readFileSync(tarball)).digest('hex');
		if (digest !== SCOWL.sha256) throw new Error(`SCOWL checksum mismatch: ${digest}`);
		execFileSync('tar', ['-xzf', tarball, '-C', cache]);
		return join(cache, `scowl-${SCOWL.version}`);
	})();
	return unpacked;
}

/**
 * Lowercase a–z words of 3–15 letters from SCOWL sizes up to `maxSize` (10 = most common,
 * 95 = most obscure). Proper nouns, abbreviations, apostrophes, hyphens and accented words all
 * fall out of the a–z filter.
 * @param {number} maxSize
 * @returns {Promise<Set<string>>}
 */
export async function scowlWords(maxSize) {
	const final = join(await scowlDir(), 'final');
	const out = new Set();
	for (const file of readdirSync(final)) {
		const m = /^([a-z]+)-words\.(\d+)$/.exec(file);
		if (!m || !SPELLINGS.includes(m[1]) || Number(m[2]) > maxSize) continue;
		for (const line of readFileSync(join(final, file), 'latin1').split('\n')) {
			if (WORD.test(line)) out.add(line);
		}
	}
	return out;
}

/** SCOWL's copyright and permission notice, which must travel with every copy of the lists. */
export async function scowlNotice() {
	return readFileSync(join(await scowlDir(), 'Copyright'), 'utf8');
}
```

`scripts/wordlist/curated.mjs`:

```js
import { readFileSync } from 'node:fs';

/**
 * Reads a curated list: one lowercase word per line, `#` starts a comment. Every form is listed
 * explicitly; nothing is expanded, because naive plurals go wrong ("jap" + "es" = "japes").
 * @param {string} path
 * @returns {Set<string>}
 */
export function readCurated(path) {
	const out = new Set();
	for (const raw of readFileSync(path, 'utf8').split('\n')) {
		const word = raw.replace(/#.*/, '').trim();
		if (word !== '') out.add(word);
	}
	return out;
}
```

- [ ] **Step 2: The candidates helper and empty curated lists**

`scripts/wordlist/candidates.mjs`:

```js
// Prints curation candidates for blocklist.txt and never-suggest.txt. For every single-word entry
// of the LDNOOBW English list: the SCOWL words built on it (plurals and other inflections), each
// tagged [B] blocklist, [N] never-suggest or [?] not yet on either list.
// Run: npm run words:candidates
import { readCurated } from './curated.mjs';
import { scowlWords } from './scowl.mjs';

const LDNOOBW =
	'https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/5faf2ba42d7b1c0977169ec3611df25a3c08eb13/en';

const res = await fetch(LDNOOBW);
if (!res.ok) throw new Error(`LDNOOBW download failed: HTTP ${res.status}`);
const seeds = (await res.text())
	.split('\n')
	.map((line) => line.trim().toLowerCase())
	.filter((word) => /^[a-z]+$/.test(word));
const scowl = [...(await scowlWords(70))].sort();
const blocked = readCurated('scripts/wordlist/blocklist.txt');
const hidden = readCurated('scripts/wordlist/never-suggest.txt');
const tag = (w) => (blocked.has(w) ? 'B' : hidden.has(w) ? 'N' : '?');

for (const seed of seeds) {
	const forms = scowl.filter((w) => w.startsWith(seed) && w.length <= seed.length + 3);
	if (forms.length > 0) console.log(`${seed}: ${forms.map((w) => `${w}[${tag(w)}]`).join(' ')}`);
}
```

Create both lists with only this header for now (change the first comment line in each):

`scripts/wordlist/blocklist.txt`:

```
# Removed from the word list entirely: slurs (spec §9). One lowercase word per line, every
# form listed explicitly. Seeded from LDNOOBW (commit 5faf2ba, CC BY 4.0; see THIRD_PARTY.md)
# with `npm run words:candidates`, then reviewed by hand.
```

`scripts/wordlist/never-suggest.txt`:

```
# Accepted when a player enters them, never suggested and never a conundrum: vulgar but
# legitimate words (spec §9). One lowercase word per line, every form listed explicitly.
# Seeded from LDNOOBW (commit 5faf2ba, CC BY 4.0; see THIRD_PARTY.md) with
# `npm run words:candidates`, then reviewed by hand.
```

Add to `package.json` `scripts`:

```json
		"words": "node scripts/build-words.mjs",
		"words:candidates": "node scripts/wordlist/candidates.mjs"
```

- [ ] **Step 3: Curate the lists (judgment)**

Run `npm run words:candidates`. It downloads SCOWL (2.5 MB) on the first run. Then fill the two lists, sorted alphabetically, below their headers:

- **`blocklist.txt`**: slurs, meaning words whose ordinary use is to demean people for their race, ethnicity, nationality, religion, sexuality, gender identity or disability. Include every inflected form that SCOWL has (plurals, `-ed`, `-ing`, …).
  - Also search the SCOWL output for common slurs that LDNOOBW misses. For example, check `grep -x` against `scowlWords(70)` by writing a throwaway script, and add any you find.
- **`never-suggest.txt`**: every other LDNOOBW-derived word that SCOWL contains, with its forms. This covers vulgar, sexual, profane and scatological words, and anatomy terms. When in doubt, never-suggest: players can still enter these words.
- **Words with a slur sense and an ordinary sense** go on never-suggest, not the blocklist, so players can still use them. Examples: "a chink in the armour", "a faggot of sticks".
- **Leave out prefix noise** that the helper prints but that is unrelated. For example, under `ass` it prints `assay`, `asset` and `assign`.

Re-run `npm run words:candidates` until no line has a `[?]` that should be on a list. **The author reviews both lists in the PR**: list them under the PR's "Test Not Performed" heading as "curated word lists need the author's review".

- [ ] **Step 4: Write the failing gate test**

Add these imports at the top of `src/lib/platform/words/words.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { readCurated } from '../../../../scripts/wordlist/curated.mjs';
import manifest from './en.manifest.json';
```

Then append:

```ts
const read = (file: string) => readFileSync(`src/lib/platform/words/${file}`, 'utf8');

describe('English word list (spec §9 gate)', () => {
	const lines = parseLines(read('en.txt'));
	const list = parseWordList(read('en.txt'));
	const conundrums = parseLines(read('en-conundrums.txt'));
	const blocked = readCurated('scripts/wordlist/blocklist.txt');
	const neverSuggest = readCurated('scripts/wordlist/never-suggest.txt');

	it('holds sorted, unique, lowercase a–z words of 3–15 letters', () => {
		expect(lines.filter((line) => !/^!?[a-z]{3,15}$/.test(line))).toEqual([]);
		const words = lines.map((line) => line.replace(/^!/, ''));
		expect(words).toEqual([...new Set(words)].sort());
	});

	it('contains no blocklisted word', () => {
		expect([...blocked].filter((word) => list.words.has(word))).toEqual([]);
	});

	it('marks exactly the never-suggest words it contains', () => {
		const expected = [...neverSuggest].filter((word) => list.words.has(word)).sort();
		expect([...list.neverSuggest].sort()).toEqual(expected);
	});

	it('offers only listed, suggestible 9-letter conundrums with a unique anagram', () => {
		const groups = new Map<string, number>();
		for (const word of list.words) {
			if (word.length === 9) groups.set(signature(word), (groups.get(signature(word)) ?? 0) + 1);
		}
		const bad = conundrums.filter(
			(w) => w.length !== 9 || !list.words.has(w) || list.neverSuggest.has(w),
		);
		expect(bad).toEqual([]);
		expect(conundrums.filter((w) => groups.get(signature(w)) !== 1)).toEqual([]);
		expect(conundrums).toEqual([...conundrums].sort());
	});

	it('matches its manifest counts', () => {
		expect(manifest.counts.words).toBe(list.words.size);
		expect(manifest.counts.neverSuggest).toBe(list.neverSuggest.size);
		expect(manifest.counts.conundrums).toBe(conundrums.length);
	});
});
```

Run: `npx vitest run src/lib/platform/words`
Expected: FAIL, because `en.manifest.json` and `en.txt` don't exist yet.

- [ ] **Step 5: The build script**

`scripts/build-words.mjs`:

```js
// Builds the English word lists from SCOWL (spec §9). Run it by hand after changing the pinned
// release or a curated list: `npm run words`. The output is committed; CI only checks it
// (src/lib/platform/words/words.test.ts).
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readCurated } from './wordlist/curated.mjs';
import { SCOWL, SPELLINGS, scowlNotice, scowlWords } from './wordlist/scowl.mjs';

const MAX_SIZE = 70;
/** Conundrum answers come from commoner words, so the answer is one a player can know. */
const CONUNDRUM_MAX_SIZE = 50;
const CONUNDRUM_LENGTH = 9;
const OUT = 'src/lib/platform/words';

const signature = (word) => [...word].sort().join('');
const blocked = readCurated('scripts/wordlist/blocklist.txt');
const neverSuggest = readCurated('scripts/wordlist/never-suggest.txt');
const all = await scowlWords(MAX_SIZE);
const common = await scowlWords(CONUNDRUM_MAX_SIZE);

// Anagram groups are counted before the blocklist, so no scramble can spell a removed word.
const groups = new Map();
for (const word of all) {
	if (word.length !== CONUNDRUM_LENGTH) continue;
	const key = signature(word);
	groups.set(key, (groups.get(key) ?? 0) + 1);
}

const words = [...all].filter((word) => !blocked.has(word)).sort();
const hidden = words.filter((word) => neverSuggest.has(word)).length;
const conundrums = words.filter(
	(word) =>
		word.length === CONUNDRUM_LENGTH &&
		common.has(word) &&
		!neverSuggest.has(word) &&
		groups.get(signature(word)) === 1,
);

writeFileSync(
	join(OUT, 'en.txt'),
	`${words.map((word) => (neverSuggest.has(word) ? `!${word}` : word)).join('\n')}\n`,
);
writeFileSync(join(OUT, 'en-conundrums.txt'), `${conundrums.join('\n')}\n`);
writeFileSync(join(OUT, 'LICENSE-SCOWL.txt'), await scowlNotice());

const manifestPath = join(OUT, 'en.manifest.json');
const manifest = {
	source: `SCOWL ${SCOWL.version}`,
	url: SCOWL.url,
	sha256: SCOWL.sha256,
	spellings: SPELLINGS.join(', '),
	maxSize: MAX_SIZE,
	conundrumMaxSize: CONUNDRUM_MAX_SIZE,
	lengths: '3-15',
	counts: {
		words: words.length,
		neverSuggest: hidden,
		conundrums: conundrums.length,
		blocked: all.size - words.length,
	},
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, '\t')}\n`);
execFileSync('npx', ['biome', 'format', '--write', manifestPath], { stdio: 'inherit' });

console.log(
	`${words.length} words (${hidden} never-suggest, ${all.size - words.length} blocked), ` +
		`${conundrums.length} conundrums`,
);
```

- [ ] **Step 6: Build, then run the gate**

Run: `npm run words`
Expected: prints roughly `114000 words (… never-suggest, … blocked), 8500 conundrums`. The exact counts depend on the curated lists. The four files in `src/lib/platform/words/` are written.

Run: `npx vitest run src/lib/platform/words && npm run check && npm run lint`
Expected: all words tests pass. Check reports 0 errors and 0 warnings (it type-checks `curated.mjs` through the test's import). Lint is clean.

- [ ] **Step 7: Credit the sources**

Append to `THIRD_PARTY.md`:

```md

## Word list
`src/lib/platform/words/en.txt` and `en-conundrums.txt` are built by `scripts/build-words.mjs`
from [SCOWL](http://wordlist.aspell.net/) 2020.12.07 (sizes 10–70; English, American and
British spellings) by Kevin Atkinson and contributors. SCOWL's copyright and permission notice
is reproduced in full in `src/lib/platform/words/LICENSE-SCOWL.txt`.

## Word-list curation seed
`scripts/wordlist/blocklist.txt` and `scripts/wordlist/never-suggest.txt` were seeded from the
English list of
[List of Dirty, Naughty, Obscene, and Otherwise Bad Words](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words)
(commit `5faf2ba`), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), and
then curated by hand.
```

- [ ] **Step 8: Commit**

```bash
npm run format
git add scripts package.json THIRD_PARTY.md src/lib/platform/words
git commit -m "feat(words): build the English word list from SCOWL

Pinned SCOWL 2020.12.07 (sha256-checked), sizes 10-70. Slurs are removed;
vulgar words are kept but never suggested. Conundrums are unique-anagram
9-letter words from sizes up to 50.

Assisted-by: Claude Code (<model>)"
```

---
### Task 4: Round vocabulary, the letter board and the Letters round

**Files:**
- Create: `src/lib/games/letters-and-numbers/round.ts`, `src/lib/games/letters-and-numbers/board.ts`, `src/lib/games/letters-and-numbers/letters.ts`
- Test: `src/lib/games/letters-and-numbers/letters.test.ts`

**Interfaces:**
- Consumes: `Rng` (`$lib/platform/rng`); `WordList` and `parseWordList` (`$lib/platform/words`, Task 2); the committed `en.txt` (Task 3).
- Produces:
  - `round.ts`:
    - `ROUND_MS = 30_000`
    - `Phase = 'setup' | 'play' | 'review'`
    - `RoundKind`, `Pile`, `Op`, `Step`, `Solution`, `Rejection`, `Scored`
    - `RoundOutcome<R>`
    - the `Action` union
  - `board.ts`:
    - `Board { letters; order; entry }`
    - `entryWord`, `addTile`, `removeTile`, `shuffleTiles`, `freeTile`
  - `letters.ts`:
    - `LettersRound`, `VOWEL_COUNTS`, `CONSONANT_COUNTS`
    - `LETTER_COUNT = 9`, `MIN_VOWELS = 3`, `MIN_CONSONANTS = 4`, `MIN_WORD = 3`
    - `pile`, `newLettersRound(rng)`, `isVowel`, `canDraw(round, pile)`
    - `reduceLetters(round, action, rng): LettersRound`
    - `scoreWord(word, valid)`, `bestWords(letters, list, limit = 3)`
    - `lettersResult(round): Scored | null`

- [ ] **Step 1: Shared vocabulary**

`src/lib/games/letters-and-numbers/round.ts`:

```ts
// Vocabulary shared by the three round kinds. No runtime imports: e2e/helpers.ts loads files
// that import this one.

export const ROUND_MS = 30_000;

/** setup: drawing letters or choosing numbers · play: the clock runs · review: dictionary corner. */
export type Phase = 'setup' | 'play' | 'review';
export type RoundKind = 'letters' | 'numbers' | 'conundrum';
export type Pile = 'vowel' | 'consonant';
export type Op = '+' | '-' | '*' | '/';

/** One arithmetic step, `a op b = value`. */
export interface Step {
	a: number;
	op: Op;
	b: number;
	value: number;
}

/** A numbers answer: the value reached and the steps that reach it (none: a tile as drawn). */
export interface Solution {
	value: number;
	steps: Step[];
}

export type Rejection = 'negative' | 'fraction' | 'incomplete' | 'wrong';

export type Action =
	| { type: 'draw'; pile: Pile }
	| { type: 'large'; count: number }
	| { type: 'tile'; index: number }
	| { type: 'backspace' }
	| { type: 'shuffle' }
	| { type: 'combine'; a: number; op: Op; b: number }
	| { type: 'undo' }
	| { type: 'reset' }
	| { type: 'lock' }
	| { type: 'timeout' }
	| { type: 'tick'; msLeft: number }
	| { type: 'judged'; valid: boolean }
	| { type: 'best-words'; words: string[] }
	| { type: 'best-numbers'; solution: Solution }
	| { type: 'next' };

/** A finished round, as the review and the end card show it. */
export interface Scored {
	yours: string;
	score: number;
	best: string;
	bestScore: number;
}

export interface RoundOutcome<R> {
	/** The same object as the input when the action was ignored or rejected. */
	round: R;
	rejected?: Rejection;
}
```

- [ ] **Step 2: Write the failing tests**

`src/lib/games/letters-and-numbers/letters.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRng } from '$lib/platform/rng';
import { parseWordList } from '$lib/platform/words';
import { entryWord, freeTile } from './board';
import {
	bestWords,
	CONSONANT_COUNTS,
	canDraw,
	isVowel,
	LETTER_COUNT,
	type LettersRound,
	lettersResult,
	newLettersRound,
	pile,
	reduceLetters,
	scoreWord,
	VOWEL_COUNTS,
} from './letters';
import type { Action, Pile } from './round';

const rng = createRng(1);
const act = (round: LettersRound, ...actions: Action[]) =>
	actions.reduce((r, a) => reduceLetters(r, a, rng), round);
const draws = (...piles: Pile[]): Action[] => piles.map((p) => ({ type: 'draw', pile: p }));
/** Four vowels and five consonants. */
const FULL: Pile[] = [
	'consonant',
	'vowel',
	'consonant',
	'consonant',
	'vowel',
	'consonant',
	'vowel',
	'consonant',
	'vowel',
];
const playing = (seed = 5) => act(newLettersRound(createRng(seed)), ...draws(...FULL));
const sorted = (xs: readonly string[]) => [...xs].sort();
const tiles = (...indexes: number[]): Action[] => indexes.map((index) => ({ type: 'tile', index }));

/** Can `word` be spelled from `letters`, each used at most as often as drawn? */
function canMake(word: string, letters: readonly string[]): boolean {
	const left = [...letters];
	for (const ch of word) {
		const i = left.indexOf(ch);
		if (i < 0) return false;
		left.splice(i, 1);
	}
	return true;
}

describe('piles', () => {
	it('hold the documented 67 vowels and 74 consonants', () => {
		expect(pile(VOWEL_COUNTS)).toHaveLength(67);
		expect(pile(CONSONANT_COUNTS)).toHaveLength(74);
	});

	it('are shuffled afresh for each round, which starts by drawing', () => {
		const round = newLettersRound(createRng(3));
		expect(sorted(round.vowels)).toEqual(sorted(pile(VOWEL_COUNTS)));
		expect(sorted(round.consonants)).toEqual(sorted(pile(CONSONANT_COUNTS)));
		expect(round.phase).toBe('setup');
		expect(round.letters).toEqual([]);
	});
});

describe('drawing', () => {
	it('takes letters from the chosen pile and starts play at nine', () => {
		const round = playing(3);
		expect(round.letters).toHaveLength(LETTER_COUNT);
		expect(round.letters.filter(isVowel)).toHaveLength(4);
		expect(round.vowels).toHaveLength(67 - 4);
		expect(round.phase).toBe('play');
		expect(round.order).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
	});

	it('stops vowels at five and consonants at six', () => {
		const start = newLettersRound(createRng(3));
		const vowels = act(start, ...draws('vowel', 'vowel', 'vowel', 'vowel', 'vowel'));
		expect(canDraw(vowels, 'vowel')).toBe(false);
		expect(act(vowels, ...draws('vowel'))).toBe(vowels);
		const consonants = act(start, ...draws(...Array<Pile>(6).fill('consonant')));
		expect(canDraw(consonants, 'consonant')).toBe(false);
		expect(canDraw(consonants, 'vowel')).toBe(true);
	});

	it('always ends with ≥ 3 vowels and ≥ 4 consonants, drawn without replacement', () => {
		const wish = fc.constantFrom<Pile>('vowel', 'consonant');
		fc.assert(
			fc.property(fc.integer(), fc.array(wish, { minLength: 9, maxLength: 9 }), (seed, wishes) => {
				let round = newLettersRound(createRng(seed));
				for (const want of wishes) {
					const from = canDraw(round, want) ? want : want === 'vowel' ? 'consonant' : 'vowel';
					round = act(round, { type: 'draw', pile: from });
				}
				expect(round.phase).toBe('play');
				const vowels = round.letters.filter(isVowel).length;
				expect(vowels).toBeGreaterThanOrEqual(3);
				expect(LETTER_COUNT - vowels).toBeGreaterThanOrEqual(4);
				expect(sorted([...round.letters, ...round.vowels, ...round.consonants])).toEqual(
					sorted([...pile(VOWEL_COUNTS), ...pile(CONSONANT_COUNTS)]),
				);
			}),
		);
	});
});

describe('the tile board', () => {
	it('builds a word from unused tiles only', () => {
		const round = act(playing(), ...tiles(2, 2, 0, 9));
		expect(round.entry).toEqual([2, 0]);
		expect(entryWord(round)).toBe(`${round.letters[2]}${round.letters[0]}`);
		expect(act(round, { type: 'backspace' }).entry).toEqual([2]);
	});

	it('shuffles the tiles and keeps the word', () => {
		const round = act(playing(), ...tiles(4));
		const shuffled = act(round, { type: 'shuffle' });
		expect([...shuffled.order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
		expect(shuffled.entry).toEqual([4]);
	});

	it('finds the first unused tile showing a letter, in display order', () => {
		const board = { letters: ['a', 'b', 'a'], order: [2, 1, 0], entry: [] as number[] };
		expect(freeTile(board, 'a')).toBe(2);
		expect(freeTile({ ...board, entry: [2] }, 'a')).toBe(0);
		expect(freeTile({ ...board, entry: [2, 0] }, 'a')).toBeNull();
		expect(freeTile(board, 'z')).toBeNull();
	});

	it('ignores tiles before play', () => {
		const setup = newLettersRound(createRng(5));
		expect(act(setup, ...tiles(0))).toBe(setup);
	});
});

describe('locking in', () => {
	it('locks the board; a word under three letters needs no dictionary', () => {
		const round = act(playing(), ...tiles(0), { type: 'lock' });
		expect(round.phase).toBe('review');
		expect(round.locked).toBe(round.letters[0]);
		expect(round.valid).toBe(false);
	});

	it('a timeout locks whatever is on the board and waits for the dictionary', () => {
		const round = act(playing(), ...tiles(0, 1, 2), { type: 'timeout' });
		expect(round.locked).toHaveLength(3);
		expect(round.valid).toBeNull();
	});

	it('takes the verdict and the best words once each', () => {
		const locked = act(playing(), ...tiles(0, 1, 2), { type: 'lock' });
		const judged = act(locked, { type: 'judged', valid: true });
		expect(judged.valid).toBe(true);
		expect(act(judged, { type: 'judged', valid: false })).toBe(judged);
		const best = act(judged, { type: 'best-words', words: ['planets'] });
		expect(act(best, { type: 'best-words', words: ['other'] }).best).toEqual(['planets']);
	});

	it('ticks the clock only during play', () => {
		const round = playing();
		expect(act(round, { type: 'tick', msLeft: 12_000 }).msLeft).toBe(12_000);
		const locked = act(round, { type: 'lock' });
		expect(act(locked, { type: 'tick', msLeft: 1000 })).toBe(locked);
	});
});

describe('scoring', () => {
	it.each([
		['cat', true, 3],
		['planets', true, 7],
		['relations', true, 18],
		['cat', false, 0],
		['at', true, 0],
		['', true, 0],
	])('scoreWord(%j, %s) = %i', (word, valid, points) => {
		expect(scoreWord(word, valid)).toBe(points);
	});

	it('scores the round against dictionary corner once both answers are in', () => {
		const round: LettersRound = {
			...playing(),
			phase: 'review',
			locked: 'cat',
			valid: true,
			best: ['planets', 'plane'],
		};
		expect(lettersResult(round)).toEqual({ yours: 'CAT', score: 3, best: 'PLANETS', bestScore: 7 });
		expect(lettersResult({ ...round, valid: null })).toBeNull();
		expect(lettersResult({ ...round, best: null })).toBeNull();
		expect(lettersResult({ ...round, locked: '', valid: false })?.yours).toBe('—');
	});

	it('never rates the best below the player', () => {
		const round: LettersRound = {
			...playing(),
			phase: 'review',
			locked: 'relations',
			valid: true,
			best: ['planets'],
		};
		expect(lettersResult(round)?.bestScore).toBe(18);
	});
});

describe('bestWords', () => {
	const small = parseWordList('act\ncat\n!damn\nplane\nplanet\nplanets\nplant\nstain\n');

	it('returns up to three longest words, longest first, then alphabetical', () => {
		expect(bestWords([...'planetsxc'], small)).toEqual(['planets', 'planet', 'plane']);
		expect(bestWords([...'planetsxc'], small, 10)).toEqual([
			'planets',
			'planet',
			'plane',
			'plant',
			'act',
			'cat',
		]);
	});

	it('never offers a never-suggest word', () => {
		expect(bestWords([...'damnxxxxx'], small)).toEqual([]);
	});

	it('on the real list: every word is listed, suggestible and spelled from the letters', () => {
		const list = parseWordList(readFileSync('src/lib/platform/words/en.txt', 'utf8'));
		fc.assert(
			fc.property(fc.integer(), (seed) => {
				const r = createRng(seed);
				let round = newLettersRound(r);
				while (round.phase === 'setup') {
					const want: Pile = r.next() < 0.45 ? 'vowel' : 'consonant';
					const from = canDraw(round, want) ? want : want === 'vowel' ? 'consonant' : 'vowel';
					round = act(round, { type: 'draw', pile: from });
				}
				for (const word of bestWords(round.letters, list)) {
					expect(list.words.has(word)).toBe(true);
					expect(list.neverSuggest.has(word)).toBe(false);
					expect(canMake(word, round.letters)).toBe(true);
				}
			}),
			{ numRuns: 50 },
		);
	});
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run src/lib/games/letters-and-numbers`
Expected: FAIL, because `./board` and `./letters` can't be resolved.

- [ ] **Step 4: Implement the board**

`src/lib/games/letters-and-numbers/board.ts`:

```ts
import type { Rng } from '$lib/platform/rng';

/** The letter tiles of a letters or conundrum round. */
export interface Board {
	letters: string[];
	/** Display order of the tiles: a permutation of letter indices. */
	order: number[];
	/** The word being built, as letter indices. */
	entry: number[];
}

export function entryWord(board: Board): string {
	return board.entry.map((i) => board.letters[i]).join('');
}

export function addTile<B extends Board>(board: B, index: number): B {
	const known = Number.isInteger(index) && index >= 0 && index < board.letters.length;
	return known && !board.entry.includes(index) ? { ...board, entry: [...board.entry, index] } : board;
}

export function removeTile<B extends Board>(board: B): B {
	return board.entry.length === 0 ? board : { ...board, entry: board.entry.slice(0, -1) };
}

export function shuffleTiles<B extends Board>(board: B, rng: Rng): B {
	return { ...board, order: rng.shuffle(board.order) };
}

/** The first unused tile showing `letter`, in display order, or null. For typing on a keyboard. */
export function freeTile(board: Board, letter: string): number | null {
	for (const i of board.order) {
		if (board.letters[i] === letter && !board.entry.includes(i)) return i;
	}
	return null;
}
```

- [ ] **Step 5: Implement the Letters round**

`src/lib/games/letters-and-numbers/letters.ts`:

```ts
import type { Rng } from '$lib/platform/rng';
import type { WordList } from '$lib/platform/words';
import { addTile, type Board, entryWord, removeTile, shuffleTiles } from './board';
import { type Action, type Phase, type Pile, ROUND_MS, type Scored } from './round';

/**
 * The letter piles, drawn without replacement and refilled each round. These are the modern
 * Countdown counts as published at
 * https://incoherency.co.uk/countdown/pages/countdown-letter-frequencies (the show retunes them
 * from time to time): 67 vowels and 74 consonants.
 */
export const VOWEL_COUNTS: Readonly<Record<string, number>> = { a: 15, e: 21, i: 13, o: 13, u: 5 };
export const CONSONANT_COUNTS: Readonly<Record<string, number>> = {
	b: 2,
	c: 3,
	d: 6,
	f: 2,
	g: 3,
	h: 2,
	j: 1,
	k: 1,
	l: 5,
	m: 4,
	n: 8,
	p: 4,
	q: 1,
	r: 9,
	s: 9,
	t: 9,
	v: 1,
	w: 1,
	x: 1,
	y: 1,
	z: 1,
};

export const LETTER_COUNT = 9;
export const MIN_VOWELS = 3;
export const MIN_CONSONANTS = 4;
export const MIN_WORD = 3;

export interface LettersRound extends Board {
	kind: 'letters';
	phase: Phase;
	/** The shuffled piles; each draw takes the last letter. */
	vowels: string[];
	consonants: string[];
	/** Clock left when last saved, so a resumed round keeps its time. */
	msLeft: number;
	/** The word locked in ('' for none); null until the round is locked. */
	locked: string | null;
	/** The dictionary's verdict on `locked`; null until known. */
	valid: boolean | null;
	/** Dictionary corner's longest words; null until the solver answers. */
	best: string[] | null;
}

export function pile(counts: Readonly<Record<string, number>>): string[] {
	return Object.entries(counts).flatMap(([letter, n]) => Array<string>(n).fill(letter));
}

export function newLettersRound(rng: Rng): LettersRound {
	return {
		kind: 'letters',
		phase: 'setup',
		vowels: rng.shuffle(pile(VOWEL_COUNTS)),
		consonants: rng.shuffle(pile(CONSONANT_COUNTS)),
		letters: [],
		order: [],
		entry: [],
		msLeft: ROUND_MS,
		locked: null,
		valid: null,
		best: null,
	};
}

export function isVowel(letter: string): boolean {
	return Object.hasOwn(VOWEL_COUNTS, letter);
}

/** False once the board is full, or when drawing from `from` would starve the other pile's minimum. */
export function canDraw(round: LettersRound, from: Pile): boolean {
	if (round.phase !== 'setup' || round.letters.length >= LETTER_COUNT) return false;
	const vowels = round.letters.filter(isVowel).length;
	const consonants = round.letters.length - vowels;
	return from === 'vowel'
		? vowels < LETTER_COUNT - MIN_CONSONANTS
		: consonants < LETTER_COUNT - MIN_VOWELS;
}

function draw(round: LettersRound, from: Pile): LettersRound {
	if (!canDraw(round, from)) return round;
	const source = from === 'vowel' ? round.vowels : round.consonants;
	const letters = [...round.letters, source[source.length - 1]];
	const rest = source.slice(0, -1);
	const full = letters.length === LETTER_COUNT;
	return {
		...round,
		...(from === 'vowel' ? { vowels: rest } : { consonants: rest }),
		letters,
		order: full ? letters.map((_, i) => i) : [],
		phase: full ? 'play' : 'setup',
	};
}

function lock(round: LettersRound): LettersRound {
	if (round.phase !== 'play') return round;
	const word = entryWord(round);
	return { ...round, phase: 'review', locked: word, valid: word.length >= MIN_WORD ? null : false };
}

export function reduceLetters(round: LettersRound, action: Action, rng: Rng): LettersRound {
	switch (action.type) {
		case 'draw':
			return draw(round, action.pile);
		case 'tile':
			return round.phase === 'play' ? addTile(round, action.index) : round;
		case 'backspace':
			return round.phase === 'play' ? removeTile(round) : round;
		case 'shuffle':
			return round.phase === 'play' ? shuffleTiles(round, rng) : round;
		case 'lock':
		case 'timeout':
			return lock(round);
		case 'tick':
			return round.phase === 'play' && action.msLeft !== round.msLeft
				? { ...round, msLeft: action.msLeft }
				: round;
		case 'judged':
			return round.locked !== null && round.valid === null ? { ...round, valid: action.valid } : round;
		case 'best-words':
			return round.phase !== 'setup' && round.best === null ? { ...round, best: action.words } : round;
		default:
			return round;
	}
}

/** Spec §8.2: a valid word scores its length, 18 for all nine letters. */
export function scoreWord(word: string, valid: boolean): number {
	if (!valid || word.length < MIN_WORD) return 0;
	return word.length === LETTER_COUNT ? 18 : word.length;
}

/**
 * Dictionary corner for letters: the longest suggestible words the letters spell, longest first,
 * then alphabetical. Looks up each distinct sub-multiset of the letters (at most 2^9 = 512).
 */
export function bestWords(letters: readonly string[], list: WordList, limit = 3): string[] {
	const sorted = [...letters].sort();
	const found = new Set<string>();
	const seen = new Set<string>();
	for (let mask = 1; mask < 1 << sorted.length; mask++) {
		let key = '';
		for (let i = 0; i < sorted.length; i++) if (mask & (1 << i)) key += sorted[i];
		if (key.length < MIN_WORD || seen.has(key)) continue;
		seen.add(key);
		for (const word of list.bySignature.get(key) ?? []) found.add(word);
	}
	return [...found]
		.sort((a, b) => b.length - a.length || (a < b ? -1 : 1))
		.slice(0, limit);
}

export function lettersResult(round: LettersRound): Scored | null {
	if (round.locked === null || round.valid === null || round.best === null) return null;
	const score = scoreWord(round.locked, round.valid);
	const top = round.best[0] ?? '';
	return {
		yours: round.locked === '' ? '—' : round.locked.toUpperCase(),
		score,
		best: top === '' ? '—' : top.toUpperCase(),
		bestScore: Math.max(score, scoreWord(top, true)),
	};
}
```

- [ ] **Step 6: Run them to verify they pass**

Run: `npx vitest run src/lib/games/letters-and-numbers && npm run check && npm run lint`
Expected: all letters tests pass (the real-list property takes a second or two), check reports 0 errors and 0 warnings, and lint is clean.

- [ ] **Step 7: Commit**

```bash
npm run format
git add src/lib/games/letters-and-numbers
git commit -m "feat(letters-and-numbers): add the letters round and its solver

Assisted-by: Claude Code (<model>)"
```

---

### Task 5: The Numbers round and its solver

**Files:**
- Create: `src/lib/games/letters-and-numbers/numbers.ts`
- Test: `src/lib/games/letters-and-numbers/numbers.test.ts`

**Interfaces:**
- Consumes: `round.ts` (Task 4); `Rng`.
- Produces:
  - Constants: `LARGE`, `SMALL`, `TILE_COUNT = 6`, `MIN_TARGET = 101`, `MAX_TARGET = 999`.
  - Types: `Tile { id; value }`, `NumbersRound`.
  - `newNumbersRound(rng)`.
  - `operate(a, op, b): number | Rejection`.
  - `closest(values, target)`, `scoreNumbers(value, target)`.
  - `reduceNumbers(round, action): RoundOutcome<NumbersRound>`.
  - `numbersResult(round): Scored | null`.
  - `solveNumbers(tiles, target): Solution`.
  - `numbers.ts` has no runtime `$lib` imports; `e2e/helpers.ts` imports it.

- [ ] **Step 1: Write the failing tests**

`src/lib/games/letters-and-numbers/numbers.test.ts`:

```ts
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRng } from '$lib/platform/rng';
import {
	closest,
	LARGE,
	type NumbersRound,
	newNumbersRound,
	numbersResult,
	operate,
	reduceNumbers,
	SMALL,
	scoreNumbers,
	solveNumbers,
} from './numbers';
import type { Action, Op, Solution } from './round';

const act = (round: NumbersRound, ...actions: Action[]) =>
	actions.reduce((r, a) => reduceNumbers(r, a).round, round);
const playing = (count = 2, seed = 4) =>
	act(newNumbersRound(createRng(seed)), { type: 'large', count });
const values = (round: NumbersRound) => round.pool.map((t) => t.value);
const ascending = (xs: readonly number[]) => [...xs].sort((a, b) => a - b);

/** Replays a solution from its tiles, checking every step against the rules. */
function replay(tiles: readonly number[], solution: Solution): void {
	const pool = [...tiles];
	const take = (v: number) => {
		const i = pool.indexOf(v);
		expect(i, `${v} is not available`).toBeGreaterThanOrEqual(0);
		pool.splice(i, 1);
	};
	for (const { a, op, b, value } of solution.steps) {
		take(a);
		take(b);
		expect(operate(a, op, b)).toBe(value);
		expect(Number.isInteger(value) && value > 0).toBe(true);
		pool.push(value);
	}
	expect(pool).toContain(solution.value);
}

/** Brute force for small cases: every reachable value, with its fewest operations. */
function reachable(tiles: readonly number[]): Map<number, number> {
	const fewest = new Map<number, number>();
	const note = (v: number, ops: number) => {
		const known = fewest.get(v);
		if (known === undefined || ops < known) fewest.set(v, ops);
	};
	const visit = (nums: number[], ops: number) => {
		for (let i = 0; i < nums.length; i++) {
			for (let j = 0; j < nums.length; j++) {
				if (i === j) continue;
				const rest = nums.filter((_, k) => k !== i && k !== j);
				for (const op of ['+', '-', '*', '/'] as Op[]) {
					const v = operate(nums[i], op, nums[j]);
					if (typeof v === 'string') continue;
					note(v, ops + 1);
					visit([...rest, v], ops + 1);
				}
			}
		}
	};
	for (const t of tiles) note(t, 0);
	visit([...tiles], 0);
	return fewest;
}

describe('operate', () => {
	it.each([
		[3, '+', 4, 7],
		[9, '-', 4, 5],
		[4, '-', 9, 'negative'],
		[5, '-', 5, 'negative'],
		[6, '*', 7, 42],
		[12, '/', 4, 3],
		[12, '/', 5, 'fraction'],
	])('%i %s %i → %s', (a, op, b, out) => {
		expect(operate(a, op as Op, b)).toBe(out);
	});
});

describe('a numbers round', () => {
	it('draws everything up front and reveals six tiles after the choice', () => {
		const round = newNumbersRound(createRng(4));
		expect(ascending(round.large)).toEqual(ascending(LARGE));
		expect(ascending(round.small)).toEqual(ascending(SMALL));
		expect(round.target).toBeGreaterThanOrEqual(101);
		expect(round.target).toBeLessThanOrEqual(999);
		expect(round.phase).toBe('setup');
		const chosen = act(round, { type: 'large', count: 2 });
		expect(chosen.tiles).toEqual([...round.large.slice(0, 2), ...round.small.slice(0, 4)]);
		expect(values(chosen)).toEqual(chosen.tiles);
		expect(chosen.phase).toBe('play');
	});

	it('ignores an impossible count', () => {
		const round = newNumbersRound(createRng(4));
		for (const count of [-1, 5, 1.5]) expect(act(round, { type: 'large', count })).toBe(round);
	});

	it('combines two tiles into one, and undo and reset step back', () => {
		const round = playing();
		const [a, b] = round.pool;
		const once = act(round, { type: 'combine', a: a.id, op: '+', b: b.id });
		expect(values(once)).toEqual([a.value + b.value, ...values(round).slice(2)]);
		expect(once.steps).toEqual([{ a: a.value, op: '+', b: b.value, value: a.value + b.value }]);
		const [c, d] = once.pool;
		const twice = act(once, { type: 'combine', a: c.id, op: '+', b: d.id });
		expect(twice.pool).toHaveLength(4);
		expect(act(twice, { type: 'undo' }).pool).toEqual(once.pool);
		expect(act(twice, { type: 'reset' }).pool).toEqual(round.pool);
		expect(act(twice, { type: 'reset' }).steps).toEqual([]);
	});

	it('rejects a result that is not a positive whole number', () => {
		const round = playing();
		const [big, small] = [...round.pool].sort((x, y) => y.value - x.value);
		expect(reduceNumbers(round, { type: 'combine', a: small.id, op: '-', b: big.id })).toEqual({
			round,
			rejected: 'negative',
		});
	});

	it('locks the tile closest to the target', () => {
		const round = playing();
		const locked = act(round, { type: 'lock' });
		expect(locked.phase).toBe('review');
		expect(locked.locked).toBe(closest(values(round), round.target));
	});

	it('scores against dictionary corner once it answers', () => {
		const locked = act(playing(), { type: 'lock' });
		expect(numbersResult(locked)).toBeNull();
		const best = solveNumbers(locked.tiles, locked.target);
		const done = act(locked, { type: 'best-numbers', solution: best });
		const result = numbersResult(done);
		expect(result?.yours).toBe(String(locked.locked));
		expect(result?.best).toBe(String(best.value));
		expect(result?.bestScore).toBeGreaterThanOrEqual(result?.score ?? 0);
	});
});

describe('scoreNumbers', () => {
	it.each([
		[500, 10],
		[495, 7],
		[505, 7],
		[494, 5],
		[510, 5],
		[511, 0],
	])('%i for target 500 scores %i', (value, points) => {
		expect(scoreNumbers(value, 500)).toBe(points);
	});
});

describe('solveNumbers', () => {
	it.each([
		[[2, 3], 6, 6, 1],
		[[1, 1, 1, 1, 1, 1], 999, 9, 5],
		[[100, 75, 50, 25, 6, 3], 100, 100, 0],
	])('%j → %i reaches %i in %i steps', (tiles, target, value, steps) => {
		const best = solveNumbers(tiles, target);
		expect(best.value).toBe(value);
		expect(best.steps).toHaveLength(steps);
		replay(tiles, best);
	});

	it('answers replay from the drawn tiles with positive whole numbers only', () => {
		const draw = fc.record({ seed: fc.integer(), count: fc.integer({ min: 0, max: 4 }) });
		fc.assert(
			fc.property(draw, ({ seed, count }) => {
				const round = playing(count, seed);
				const best = solveNumbers(round.tiles, round.target);
				replay(round.tiles, best);
				const single = closest(round.tiles, round.target);
				expect(Math.abs(best.value - round.target)).toBeLessThanOrEqual(
					Math.abs(single - round.target),
				);
			}),
			{ numRuns: 25 },
		);
	});

	it('agrees with brute force on small cases, including "no exact solution"', () => {
		const tiles = fc.array(fc.constantFrom(...LARGE, ...SMALL), { minLength: 2, maxLength: 4 });
		fc.assert(
			fc.property(tiles, fc.integer({ min: 1, max: 400 }), (ts, target) => {
				const best = solveNumbers(ts, target);
				replay(ts, best);
				const all = reachable(ts);
				const nearest = Math.min(...[...all.keys()].map((v) => Math.abs(v - target)));
				expect(Math.abs(best.value - target)).toBe(nearest);
				if (best.value === target) expect(best.steps).toHaveLength(all.get(target) ?? -1);
			}),
			{ numRuns: 200 },
		);
	});
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/games/letters-and-numbers/numbers.test.ts`
Expected: FAIL, because `./numbers` can't be resolved.

- [ ] **Step 3: Implement**

`src/lib/games/letters-and-numbers/numbers.ts`:

```ts
import type { Rng } from '$lib/platform/rng';
import {
	type Action,
	type Op,
	type Phase,
	type Rejection,
	ROUND_MS,
	type RoundOutcome,
	type Scored,
	type Solution,
	type Step,
} from './round';

// e2e/helpers.ts imports this file: keep its runtime imports relative (Playwright can't resolve $lib).

export const LARGE: readonly number[] = [25, 50, 75, 100];
export const SMALL: readonly number[] = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10];
export const TILE_COUNT = 6;
export const MIN_TARGET = 101;
export const MAX_TARGET = 999;

export interface Tile {
	id: number;
	value: number;
}

export interface NumbersRound {
	kind: 'numbers';
	phase: Phase;
	/** Shuffled piles and the target, drawn up front and revealed once the player picks. */
	large: number[];
	small: number[];
	target: number;
	/** The six drawn numbers; empty until the player picks how many large. */
	tiles: number[];
	/** The numbers still in play. A combine replaces its two tiles with the result. */
	pool: Tile[];
	/** The player's working, one step per combine. */
	steps: Step[];
	/** The pool before each step, for Undo; history[0] is the original pool. */
	history: Tile[][];
	nextId: number;
	msLeft: number;
	/** The value locked in; null until the round is locked. */
	locked: number | null;
	best: Solution | null;
}

export function newNumbersRound(rng: Rng): NumbersRound {
	return {
		kind: 'numbers',
		phase: 'setup',
		large: rng.shuffle(LARGE),
		small: rng.shuffle(SMALL),
		target: rng.int(MIN_TARGET, MAX_TARGET),
		tiles: [],
		pool: [],
		steps: [],
		history: [],
		nextId: 0,
		msLeft: ROUND_MS,
		locked: null,
		best: null,
	};
}

/** `a op b`, or why it isn't allowed: every value must stay a positive whole number. */
export function operate(a: number, op: Op, b: number): number | Rejection {
	switch (op) {
		case '+':
			return a + b;
		case '-':
			return a > b ? a - b : 'negative';
		case '*':
			return a * b;
		case '/':
			return a % b === 0 ? a / b : 'fraction';
	}
}

/** The value nearest the target (the first one, on a tie). `values` is never empty. */
export function closest(values: readonly number[], target: number): number {
	let best = values[0];
	for (const v of values) if (Math.abs(v - target) < Math.abs(best - target)) best = v;
	return best;
}

/** Spec §8.2: exact 10; 1–5 away 7; 6–10 away 5; else 0. */
export function scoreNumbers(value: number, target: number): number {
	const off = Math.abs(value - target);
	return off === 0 ? 10 : off <= 5 ? 7 : off <= 10 ? 5 : 0;
}

function choose(round: NumbersRound, count: number): NumbersRound {
	if (round.phase !== 'setup' || !Number.isInteger(count) || count < 0 || count > LARGE.length) {
		return round;
	}
	const tiles = [...round.large.slice(0, count), ...round.small.slice(0, TILE_COUNT - count)];
	return {
		...round,
		phase: 'play',
		tiles,
		pool: tiles.map((value, id) => ({ id, value })),
		nextId: tiles.length,
	};
}

function combine(round: NumbersRound, aId: number, op: Op, bId: number): RoundOutcome<NumbersRound> {
	const a = round.pool.find((t) => t.id === aId);
	const b = round.pool.find((t) => t.id === bId);
	if (round.phase !== 'play' || !a || !b || a === b) return { round };
	const value = operate(a.value, op, b.value);
	if (typeof value === 'string') return { round, rejected: value };
	const made: Tile = { id: round.nextId, value };
	return {
		round: {
			...round,
			pool: round.pool.filter((t) => t !== b).map((t) => (t === a ? made : t)),
			steps: [...round.steps, { a: a.value, op, b: b.value, value }],
			history: [...round.history, round.pool],
			nextId: round.nextId + 1,
		},
	};
}

function undo(round: NumbersRound): NumbersRound {
	const previous = round.history.at(-1);
	if (round.phase !== 'play' || !previous) return round;
	return {
		...round,
		pool: previous,
		steps: round.steps.slice(0, -1),
		history: round.history.slice(0, -1),
	};
}

function reset(round: NumbersRound): NumbersRound {
	if (round.phase !== 'play' || round.history.length === 0) return round;
	return { ...round, pool: round.history[0], steps: [], history: [] };
}

function lock(round: NumbersRound): NumbersRound {
	if (round.phase !== 'play') return round;
	const locked = closest(
		round.pool.map((t) => t.value),
		round.target,
	);
	return { ...round, phase: 'review', locked };
}

export function reduceNumbers(round: NumbersRound, action: Action): RoundOutcome<NumbersRound> {
	switch (action.type) {
		case 'large':
			return { round: choose(round, action.count) };
		case 'combine':
			return combine(round, action.a, action.op, action.b);
		case 'undo':
			return { round: undo(round) };
		case 'reset':
			return { round: reset(round) };
		case 'lock':
		case 'timeout':
			return { round: lock(round) };
		case 'tick':
			return {
				round:
					round.phase === 'play' && action.msLeft !== round.msLeft
						? { ...round, msLeft: action.msLeft }
						: round,
			};
		case 'best-numbers':
			return {
				round:
					round.phase !== 'setup' && round.best === null
						? { ...round, best: action.solution }
						: round,
			};
		default:
			return { round };
	}
}

export function numbersResult(round: NumbersRound): Scored | null {
	if (round.locked === null || round.best === null) return null;
	const score = scoreNumbers(round.locked, round.target);
	return {
		yours: String(round.locked),
		score,
		best: String(round.best.value),
		bestScore: Math.max(score, scoreNumbers(round.best.value, round.target)),
	};
}

/** Larger-first moves for one pair. ×1 and ÷1 are skipped: they cost a step and change nothing. */
function moves(hi: number, lo: number): [Op, number][] {
	const out: [Op, number][] = [['+', hi + lo]];
	if (hi > lo) out.push(['-', hi - lo]);
	if (lo > 1) {
		out.push(['*', hi * lo]);
		if (hi % lo === 0) out.push(['/', hi / lo]);
	}
	return out;
}

/**
 * Dictionary corner for numbers: an exhaustive search for the value nearest the target, using as
 * few steps as possible. Every intermediate value is a positive whole number. Six tiles take at
 * most tens of milliseconds, and it runs in the worker.
 */
export function solveNumbers(tiles: readonly number[], target: number): Solution {
	const off = (v: number) => Math.abs(v - target);
	let best: Solution = { value: closest(tiles, target), steps: [] };
	const nums = [...tiles];
	const trail: Step[] = [];

	const search = (n: number): void => {
		// Nothing below here can beat an exact answer that is already this short.
		if (best.value === target && trail.length + 1 >= best.steps.length) return;
		for (let i = 0; i < n; i++) {
			for (let j = i + 1; j < n; j++) {
				const x = nums[i];
				const y = nums[j];
				for (const [op, value] of moves(Math.max(x, y), Math.min(x, y))) {
					trail.push({ a: Math.max(x, y), op, b: Math.min(x, y), value });
					const d = off(value);
					if (d < off(best.value) || (d === off(best.value) && trail.length < best.steps.length)) {
						best = { value, steps: [...trail] };
					}
					// Put the result in the pair's place, search the n - 1 numbers left, then restore.
					nums[i] = value;
					nums[j] = nums[n - 1];
					search(n - 1);
					nums[j] = y;
					nums[i] = x;
					trail.pop();
				}
			}
		}
	};

	search(nums.length);
	return best;
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/lib/games/letters-and-numbers/numbers.test.ts && npm run check && npm run lint`
Expected: all tests pass (the properties take a few seconds), check reports 0 errors and 0 warnings, and lint is clean.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/lib/games/letters-and-numbers
git commit -m "feat(letters-and-numbers): add the numbers round and an exhaustive solver

Assisted-by: Claude Code (<model>)"
```

---

### Task 6: The Conundrum round and the match rules

**Files:**
- Create: `src/lib/games/letters-and-numbers/conundrum.ts`, `src/lib/games/letters-and-numbers/labels.ts`, `src/lib/games/letters-and-numbers/rules.ts`
- Test: `src/lib/games/letters-and-numbers/rules.test.ts`

**Interfaces:**
- Consumes: Tasks 4 and 5.
- Produces:
  - `conundrum.ts`: `ConundrumRound`, `CONUNDRUM_POINTS = 10`, `newConundrumRound(rng, answers)`, `reduceConundrum(round, action, rng): RoundOutcome<ConundrumRound>`, `conundrumResult(round)`.
  - `labels.ts` (UI copy, no runtime `$lib` imports): `KIND_NAMES`, `ROUND_NAMES`, `REASONS`, `OPS`, `formatStep`, `away`.
  - `rules.ts`:
    - Types: `Format = 'match' | 'letters' | 'numbers' | 'conundrum'`, `LnOptions`, `Round`, `RoundResult`, `State`, `Env { rng; conundrums }`, `Outcome`.
    - `FORMATS`, `isFormat`.
    - `newGame(format, env)`, `roundResult(round)`, `totals(results)`, `canAdvance(state)`.
    - `reduce(state, action, env): Outcome`.
    - `progressLabel(state)`.

- [ ] **Step 1: Write the failing tests**

`src/lib/games/letters-and-numbers/rules.test.ts`:

```ts
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRng } from '$lib/platform/rng';
import { freeTile } from './board';
import { type ConundrumRound, conundrumResult, newConundrumRound, reduceConundrum } from './conundrum';
import { solveNumbers } from './numbers';
import type { Action, Pile } from './round';
import {
	canAdvance,
	type Env,
	FORMATS,
	type Format,
	isFormat,
	newGame,
	progressLabel,
	reduce,
	type State,
	totals,
} from './rules';

const ANSWERS = ['anchorage', 'forbidden', 'substance'];
const env = (seed = 1): Env => ({ rng: createRng(seed), conundrums: ANSWERS });
const sorted = (xs: readonly string[]) => [...xs].sort();
const DRAW: Action[] = [
	...Array<Pile>(6).fill('consonant'),
	...Array<Pile>(3).fill('vowel'),
].map((pile) => ({ type: 'draw', pile }));

function typeWord(round: ConundrumRound, word: string): ConundrumRound {
	let r = round;
	for (const ch of word) {
		const index = freeTile(r, ch);
		if (index !== null) r = reduceConundrum(r, { type: 'tile', index }, createRng(0)).round;
	}
	return r;
}

/** Plays the current round to its review with fixed legal moves, and answers for the dictionary. */
function finishRound(state: State, e: Env): State {
	const step = (s: State, a: Action) => reduce(s, a, e).state;
	switch (state.round.kind) {
		case 'letters':
			return [...DRAW, { type: 'lock' } as Action, { type: 'best-words', words: ['cat'] } as Action]
				.reduce(step, state);
		case 'numbers': {
			const s = step(step(state, { type: 'large', count: 2 }), { type: 'lock' });
			if (s.round.kind !== 'numbers') throw new Error('expected a numbers round');
			return step(s, { type: 'best-numbers', solution: solveNumbers(s.round.tiles, s.round.target) });
		}
		case 'conundrum':
			return step(state, { type: 'timeout' });
	}
}

describe('a conundrum', () => {
	it('scrambles one of the answers, never into the answer itself', () => {
		fc.assert(
			fc.property(fc.integer(), (seed) => {
				const round = newConundrumRound(createRng(seed), ANSWERS);
				expect(ANSWERS).toContain(round.answer);
				expect(round.letters.join('')).not.toBe(round.answer);
				expect(sorted(round.letters)).toEqual(sorted([...round.answer]));
				expect(round.phase).toBe('play');
			}),
		);
	});

	it('rejects an incomplete or wrong answer and takes the right one', () => {
		const round = newConundrumRound(createRng(2), ANSWERS);
		const rng = createRng(0);
		const half = typeWord(round, round.answer.slice(0, 4));
		expect(reduceConundrum(half, { type: 'lock' }, rng)).toEqual({ round: half, rejected: 'incomplete' });
		const scramble = typeWord(round, round.letters.join(''));
		expect(reduceConundrum(scramble, { type: 'lock' }, rng).rejected).toBe('wrong');
		const solved = reduceConundrum(typeWord(round, round.answer), { type: 'lock' }, rng).round;
		expect(solved.phase).toBe('review');
		const answer = round.answer.toUpperCase();
		expect(conundrumResult(solved)).toEqual({ yours: answer, score: 10, best: answer, bestScore: 10 });
	});

	it('ends unsolved when the time runs out', () => {
		const round = newConundrumRound(createRng(2), ANSWERS);
		const out = reduceConundrum(round, { type: 'timeout' }, createRng(0)).round;
		expect(conundrumResult(out)).toEqual({
			yours: '—',
			score: 0,
			best: round.answer.toUpperCase(),
			bestScore: 10,
		});
	});
});

describe('a match', () => {
	it.each(Object.keys(FORMATS) as Format[])('%s starts at its first round kind', (format) => {
		const state = newGame(format, env());
		expect(state.round.kind).toBe(FORMATS[format][0]);
		expect(state).toMatchObject({ format, index: 0, results: [], over: false });
	});

	it('plays letters, letters, numbers, letters, numbers, conundrum, then ends', () => {
		const e = env(9);
		let state = newGame('match', e);
		const kinds: string[] = [];
		while (!state.over) {
			kinds.push(state.round.kind);
			state = finishRound(state, e);
			expect(canAdvance(state)).toBe(true);
			state = reduce(state, { type: 'next' }, e).state;
		}
		expect(kinds).toEqual(FORMATS.match);
		expect(state.results.map((r) => r.kind)).toEqual(FORMATS.match);
		expect(reduce(state, { type: 'next' }, e).state).toBe(state);
	});

	it('waits for the dictionary before advancing', () => {
		const e = env();
		const state = [...DRAW, { type: 'lock' } as Action].reduce(
			(s, a) => reduce(s, a, e).state,
			newGame('letters', e),
		);
		expect(state.round.phase).toBe('review');
		expect(canAdvance(state)).toBe(false);
		expect(reduce(state, { type: 'next' }, e).state).toBe(state);
	});

	it('ignores actions meant for another kind of round', () => {
		const state = newGame('numbers', env());
		expect(reduce(state, { type: 'draw', pile: 'vowel' }, env()).state).toBe(state);
	});

	it('stays JSON-serializable and never scores a round above its best', () => {
		fc.assert(
			fc.property(fc.integer(), (seed) => {
				const e = env(seed);
				let state = newGame('match', e);
				while (!state.over) {
					state = finishRound(state, e);
					expect(JSON.parse(JSON.stringify(state))).toEqual(state);
					state = reduce(state, { type: 'next' }, e).state;
				}
				for (const r of state.results) expect(r.score).toBeLessThanOrEqual(r.bestScore);
			}),
			{ numRuns: 20 },
		);
	});
});

describe('totals and labels', () => {
	it('adds up scores and bests', () => {
		expect(
			totals([
				{ kind: 'letters', yours: 'CAT', score: 3, best: 'PLANETS', bestScore: 7 },
				{ kind: 'conundrum', yours: '—', score: 0, best: 'FORBIDDEN', bestScore: 10 },
			]),
		).toEqual({ score: 3, best: 17 });
	});

	it('labels progress for the home resume card', () => {
		expect(progressLabel(newGame('match', env()))).toBe('round 1 of 6');
		expect(progressLabel(newGame('numbers', env()))).toBe('numbers round');
		expect(progressLabel(newGame('conundrum', env()))).toBe('conundrum');
	});

	it('recognizes formats', () => {
		expect(isFormat('match')).toBe(true);
		expect(isFormat('chess')).toBe(false);
		expect(isFormat('toString')).toBe(false);
	});
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/games/letters-and-numbers/rules.test.ts`
Expected: FAIL, because `./conundrum` and `./rules` can't be resolved.

- [ ] **Step 3: Implement the conundrum**

`src/lib/games/letters-and-numbers/conundrum.ts`:

```ts
import type { Rng } from '$lib/platform/rng';
import { addTile, type Board, entryWord, removeTile, shuffleTiles } from './board';
import { type Action, type Phase, ROUND_MS, type RoundOutcome, type Scored } from './round';

export const CONUNDRUM_POINTS = 10;

export interface ConundrumRound extends Board {
	kind: 'conundrum';
	phase: Phase;
	answer: string;
	msLeft: number;
	/** The board when the round ended; null until then. */
	locked: string | null;
}

/** Scrambles a random answer. The scramble never spells the answer itself. */
export function newConundrumRound(rng: Rng, answers: readonly string[]): ConundrumRound {
	const answer = rng.pick(answers);
	let letters = rng.shuffle([...answer]);
	// Terminates: a nine-letter answer never repeats one letter nine times.
	while (letters.join('') === answer) letters = rng.shuffle(letters);
	return {
		kind: 'conundrum',
		phase: 'play',
		answer,
		letters,
		order: letters.map((_, i) => i),
		entry: [],
		msLeft: ROUND_MS,
		locked: null,
	};
}

/** Wrong guesses are rejected and play goes on; only the right answer ends the round early. */
function lock(round: ConundrumRound): RoundOutcome<ConundrumRound> {
	if (round.phase !== 'play') return { round };
	const word = entryWord(round);
	if (word.length < round.letters.length) return { round, rejected: 'incomplete' };
	if (word !== round.answer) return { round, rejected: 'wrong' };
	return { round: { ...round, phase: 'review', locked: word } };
}

export function reduceConundrum(
	round: ConundrumRound,
	action: Action,
	rng: Rng,
): RoundOutcome<ConundrumRound> {
	if (round.phase !== 'play') return { round };
	switch (action.type) {
		case 'tile':
			return { round: addTile(round, action.index) };
		case 'backspace':
			return { round: removeTile(round) };
		case 'shuffle':
			return { round: shuffleTiles(round, rng) };
		case 'lock':
			return lock(round);
		case 'timeout':
			return { round: { ...round, phase: 'review', locked: entryWord(round) } };
		case 'tick':
			return { round: action.msLeft !== round.msLeft ? { ...round, msLeft: action.msLeft } : round };
		default:
			return { round };
	}
}

export function conundrumResult(round: ConundrumRound): Scored | null {
	if (round.locked === null) return null;
	const solved = round.locked === round.answer;
	return {
		yours: solved ? round.answer.toUpperCase() : '—',
		score: solved ? CONUNDRUM_POINTS : 0,
		best: round.answer.toUpperCase(),
		bestScore: CONUNDRUM_POINTS,
	};
}
```

- [ ] **Step 4: Implement the UI copy and the match rules**

`src/lib/games/letters-and-numbers/labels.ts`:

```ts
// Words the game shows. No runtime imports: e2e/helpers.ts loads this file.
import type { Op, Rejection, RoundKind, Step } from './round';

export const KIND_NAMES: Record<RoundKind, string> = {
	letters: 'Letters',
	numbers: 'Numbers',
	conundrum: 'Conundrum',
};

/** A single-round game's name, as in the meta line. */
export const ROUND_NAMES: Record<RoundKind, string> = {
	letters: 'Letters round',
	numbers: 'Numbers round',
	conundrum: 'Conundrum',
};

export const REASONS: Record<Rejection, string> = {
	negative: 'Results must stay above zero',
	fraction: 'Division has to come out exact',
	incomplete: 'Use all nine letters',
	wrong: 'Not the word',
};

export const OPS: readonly { op: Op; symbol: string; name: string }[] = [
	{ op: '+', symbol: '+', name: 'plus' },
	{ op: '-', symbol: '−', name: 'minus' },
	{ op: '*', symbol: '×', name: 'times' },
	{ op: '/', symbol: '÷', name: 'divided by' },
];

export function formatStep({ a, op, b, value }: Step): string {
	return `${a} ${OPS.find((o) => o.op === op)?.symbol} ${b} = ${value}`;
}

export function away(value: number, target: number): string {
	const off = Math.abs(value - target);
	return off === 0 ? 'exact' : `${off} away`;
}
```

`src/lib/games/letters-and-numbers/rules.ts`:

```ts
import type { Rng } from '$lib/platform/rng';
import {
	type ConundrumRound,
	conundrumResult,
	newConundrumRound,
	reduceConundrum,
} from './conundrum';
import { ROUND_NAMES } from './labels';
import { type LettersRound, lettersResult, newLettersRound, reduceLetters } from './letters';
import { type NumbersRound, newNumbersRound, numbersResult, reduceNumbers } from './numbers';
import type { Action, Rejection, RoundKind, RoundOutcome, Scored } from './round';

export type Format = 'match' | 'letters' | 'numbers' | 'conundrum';
export type LnOptions = { format: Format };
export type Round = LettersRound | NumbersRound | ConundrumRound;

/** Spec §8.2: the mini match is Letters, Letters, Numbers, Letters, Numbers, Conundrum. */
export const FORMATS: Record<Format, readonly RoundKind[]> = {
	match: ['letters', 'letters', 'numbers', 'letters', 'numbers', 'conundrum'],
	letters: ['letters'],
	numbers: ['numbers'],
	conundrum: ['conundrum'],
};

export interface RoundResult extends Scored {
	kind: RoundKind;
}

export interface State {
	format: Format;
	/** The current round, 0-based. */
	index: number;
	round: Round;
	/** One entry per finished round. */
	results: RoundResult[];
	over: boolean;
}

/** What the reducer needs besides the state: randomness, and answers for a new conundrum. */
export interface Env {
	rng: Rng;
	conundrums: readonly string[];
}

export interface Outcome {
	/** The same object as the input when the action was ignored or rejected. */
	state: State;
	rejected?: Rejection;
}

export function isFormat(value: string): value is Format {
	return Object.hasOwn(FORMATS, value);
}

function newRound(kind: RoundKind, env: Env): Round {
	switch (kind) {
		case 'letters':
			return newLettersRound(env.rng);
		case 'numbers':
			return newNumbersRound(env.rng);
		case 'conundrum':
			return newConundrumRound(env.rng, env.conundrums);
	}
}

export function newGame(format: Format, env: Env): State {
	return { format, index: 0, round: newRound(FORMATS[format][0], env), results: [], over: false };
}

/** The round's scores, or null while the review still waits for the dictionary. */
export function roundResult(round: Round): Scored | null {
	switch (round.kind) {
		case 'letters':
			return lettersResult(round);
		case 'numbers':
			return numbersResult(round);
		case 'conundrum':
			return conundrumResult(round);
	}
}

export function totals(results: readonly RoundResult[]): { score: number; best: number } {
	let score = 0;
	let best = 0;
	for (const r of results) {
		score += r.score;
		best += r.bestScore;
	}
	return { score, best };
}

export function canAdvance(state: State): boolean {
	return !state.over && state.round.phase === 'review' && roundResult(state.round) !== null;
}

function reduceRound(round: Round, action: Action, rng: Rng): RoundOutcome<Round> {
	switch (round.kind) {
		case 'letters':
			return { round: reduceLetters(round, action, rng) };
		case 'numbers':
			return reduceNumbers(round, action);
		case 'conundrum':
			return reduceConundrum(round, action, rng);
	}
}

function next(state: State, env: Env): State {
	const result = roundResult(state.round);
	if (!canAdvance(state) || !result) return state;
	const results = [...state.results, { kind: state.round.kind, ...result }];
	const kinds = FORMATS[state.format];
	const index = state.index + 1;
	if (index >= kinds.length) return { ...state, results, over: true };
	return { ...state, index, round: newRound(kinds[index], env), results };
}

export function reduce(state: State, action: Action, env: Env): Outcome {
	if (state.over) return { state };
	if (action.type === 'next') return { state: next(state, env) };
	const { round, rejected } = reduceRound(state.round, action, env.rng);
	if (rejected) return { state, rejected };
	return round === state.round ? { state } : { state: { ...state, round } };
}

/** For the home resume card: "round 2 of 6", or the single round's name. */
export function progressLabel(state: State): string {
	const count = FORMATS[state.format].length;
	return count > 1
		? `round ${state.index + 1} of ${count}`
		: ROUND_NAMES[state.round.kind].toLowerCase();
}
```

- [ ] **Step 5: Run the game's tests**

Run: `npx vitest run src/lib/games/letters-and-numbers && npm run check && npm run lint`
Expected: all tests pass, check reports 0 errors and 0 warnings, and lint is clean.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/lib/games/letters-and-numbers
git commit -m "feat(letters-and-numbers): add the conundrum and the match rules

Assisted-by: Claude Code (<model>)"
```

---

### Task 7: Dictionary corner in a Web Worker

**Files:**
- Create: `src/lib/games/letters-and-numbers/solver.ts`, `src/lib/games/letters-and-numbers/solver.worker.ts`, `src/lib/games/letters-and-numbers/dictionary.ts`, `src/lib/platform/words/urls.ts`
- Test: `src/lib/games/letters-and-numbers/solver.test.ts`

**Interfaces:**
- Consumes:
  - `loadWordList`, `loadLines`, `WordList` (Task 2).
  - `bestWords` (Task 4), `solveNumbers` (Task 5).
- Produces:
  - `urls.ts`: `ENGLISH = { words, conundrums }`, the content-hashed URLs.
  - `solver.ts`:
    - The protocol: `Request`, `Envelope { id; wordsUrl; request }`, `Reply`.
    - `createSolver(load): (envelope) => Promise<unknown>`.
  - `dictionary.ts`: `Dictionary { isWord; bestWords; solveNumbers; conundrums; dispose }` and `createDictionary()`.

- [ ] **Step 1: Write the failing test**

`src/lib/games/letters-and-numbers/solver.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { parseWordList, type WordList } from '$lib/platform/words';
import { createSolver, type Request } from './solver';

const LIST = parseWordList('act\ncat\n!damn\nplanets\n');
const envelope = (request: Request) => ({ id: 1, wordsUrl: '/words/en.txt', request });

describe('createSolver', () => {
	it('checks words and finds the best words in the loaded list', async () => {
		const solve = createSolver(async () => LIST);
		await expect(solve(envelope({ type: 'is-word', word: 'damn' }))).resolves.toBe(true);
		await expect(solve(envelope({ type: 'is-word', word: 'dog' }))).resolves.toBe(false);
		await expect(
			solve(envelope({ type: 'best-words', letters: [...'planetscx'] })),
		).resolves.toEqual(['planets', 'act', 'cat']);
	});

	it('solves numbers without loading the word list', async () => {
		const load = vi.fn(async () => LIST);
		const solve = createSolver(load);
		await expect(
			solve(envelope({ type: 'solve-numbers', tiles: [2, 3], target: 6 })),
		).resolves.toEqual({ value: 6, steps: [{ a: 3, op: '*', b: 2, value: 6 }] });
		expect(load).not.toHaveBeenCalled();
	});

	it('loads a list once, and tries again after a failed load', async () => {
		const load = vi
			.fn<(url: string) => Promise<WordList>>()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValue(LIST);
		const solve = createSolver(load);
		const ask = () => solve(envelope({ type: 'is-word', word: 'cat' }));
		await expect(ask()).rejects.toThrow('offline');
		await expect(ask()).resolves.toBe(true);
		await expect(ask()).resolves.toBe(true);
		expect(load).toHaveBeenCalledTimes(2);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/games/letters-and-numbers/solver.test.ts`
Expected: FAIL, because `./solver` can't be resolved.

- [ ] **Step 3: Implement the solver**

`src/lib/games/letters-and-numbers/solver.ts`:

```ts
import type { WordList } from '$lib/platform/words';
import { bestWords } from './letters';
import { solveNumbers } from './numbers';

/** What the game asks dictionary corner. */
export type Request =
	| { type: 'is-word'; word: string }
	| { type: 'best-words'; letters: string[] }
	| { type: 'solve-numbers'; tiles: number[]; target: number };

/** A request as posted to the worker, with the word list's URL. */
export interface Envelope {
	id: number;
	wordsUrl: string;
	request: Request;
}

export type Reply = { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string };

/**
 * Answers dictionary corner's requests; solver.worker.ts wraps it. Each word list loads once
 * per URL, and a failed load is retried on the next request.
 */
export function createSolver(
	load: (url: string) => Promise<WordList>,
): (envelope: Envelope) => Promise<unknown> {
	const lists = new Map<string, Promise<WordList>>();
	const words = (url: string): Promise<WordList> => {
		let list = lists.get(url);
		if (!list) {
			list = load(url);
			lists.set(url, list);
			list.catch(() => lists.delete(url));
		}
		return list;
	};

	return async ({ wordsUrl, request }) => {
		switch (request.type) {
			case 'is-word':
				return (await words(wordsUrl)).words.has(request.word);
			case 'best-words':
				return bestWords(request.letters, await words(wordsUrl));
			case 'solve-numbers':
				return solveNumbers(request.tiles, request.target);
		}
	};
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/games/letters-and-numbers/solver.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: The worker, the URLs and the client**

`src/lib/games/letters-and-numbers/solver.worker.ts`:

```ts
import { loadWordList } from '$lib/platform/words';
import { createSolver, type Envelope, type Reply } from './solver';

// Worker globals typed by hand: the project's TypeScript lib is DOM, not WebWorker.
const scope = self as unknown as {
	onmessage: ((event: MessageEvent<Envelope>) => void) | null;
	postMessage(reply: Reply): void;
};
const solve = createSolver(loadWordList);

scope.onmessage = ({ data }) => {
	solve(data).then(
		(result) => scope.postMessage({ id: data.id, ok: true, result }),
		(error: unknown) => scope.postMessage({ id: data.id, ok: false, error: String(error) }),
	);
};
```

`src/lib/platform/words/urls.ts`:

```ts
// The committed English lists, content-hashed by Vite. Only code that fetches them imports this,
// so they never land in a JS chunk; the service worker precaches them with the rest of the build.
import conundrums from './en-conundrums.txt?url';
import words from './en.txt?url';

export const ENGLISH = { words, conundrums } as const;
```

`src/lib/games/letters-and-numbers/dictionary.ts`:

```ts
import { loadLines } from '$lib/platform/words';
import { ENGLISH } from '$lib/platform/words/urls';
import type { Solution } from './round';
import type { Envelope, Reply, Request } from './solver';

/** Dictionary corner as the game sees it: word checks and solvers run in a Web Worker. */
export interface Dictionary {
	isWord(word: string): Promise<boolean>;
	bestWords(letters: readonly string[]): Promise<string[]>;
	solveNumbers(tiles: readonly number[], target: number): Promise<Solution>;
	/** Conundrum answers, fetched on this thread: a conundrum round needs one before it starts. */
	conundrums(): Promise<string[]>;
	/** Stops the worker. Pending answers never arrive. */
	dispose(): void;
}

export function createDictionary(): Dictionary {
	let worker: Worker | null = null;
	let nextId = 0;
	const pending = new Map<number, { resolve: (result: unknown) => void; reject: (e: Error) => void }>();

	function stop(error?: Error): void {
		worker?.terminate();
		worker = null;
		if (error) for (const p of pending.values()) p.reject(error);
		pending.clear();
	}

	function start(): Worker {
		if (worker) return worker;
		const w = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
		w.onmessage = ({ data }: MessageEvent<Reply>) => {
			const p = pending.get(data.id);
			if (!p) return;
			pending.delete(data.id);
			if (data.ok) p.resolve(data.result);
			else p.reject(new Error(data.error));
		};
		// A worker that fails to load or crashes fails every open question; the next one restarts it.
		w.onerror = (e) => stop(new Error(e.message || 'dictionary worker failed'));
		worker = w;
		return w;
	}

	function ask<T>(request: Request): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const id = nextId++;
			pending.set(id, { resolve: (result) => resolve(result as T), reject });
			const envelope: Envelope = { id, wordsUrl: ENGLISH.words, request };
			start().postMessage(envelope);
		});
	}

	return {
		isWord: (word) => ask<boolean>({ type: 'is-word', word }),
		bestWords: (letters) => ask<string[]>({ type: 'best-words', letters: [...letters] }),
		solveNumbers: (tiles, target) =>
			ask<Solution>({ type: 'solve-numbers', tiles: [...tiles], target }),
		conundrums: () => loadLines(ENGLISH.conundrums),
		dispose: () => stop(),
	};
}
```

Keep `new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' })` on one expression, exactly like this: Vite only bundles a worker it can see written that way. If the build complains about the worker format, add `worker: { format: 'es' }` to `vite.config.ts`, and record that as a ruling.

- [ ] **Step 6: Run the gates**

Run: `npm test && npm run check && npm run lint`
Expected: every test passes, check reports 0 errors and 0 warnings, and lint is clean. The worker is exercised end to end in Task 9.

- [ ] **Step 7: Commit**

```bash
npm run format
git add src/lib/games/letters-and-numbers src/lib/platform/words/urls.ts
git commit -m "feat(letters-and-numbers): run dictionary corner in a web worker

Assisted-by: Claude Code (<model>)"
```

---
### Task 8: The game's UI, and registration

**Files:**
- Create: `src/lib/platform/ui/Burst.svelte`
- Create in `src/lib/games/letters-and-numbers/`: `TileRow.svelte`, `Draw.svelte`, `WordBoard.svelte`, `NumbersBoard.svelte`, `Corner.svelte`, `View.svelte`, `HowToPlay.svelte`, `module.ts`, `index.ts`, `icon.svg`
- Modify: `src/lib/platform/registry.ts`

**Interfaces:**
- Consumes:
  - Everything from Tasks 1 and 4–7.
  - `GameProps` and `PausableTimer` (`$lib/platform/types`).
  - `Button` (`$lib/platform/ui/Button.svelte`).
- Produces:
  - `lettersAndNumbers: AnyGame`, with id `letters-and-numbers`, one option `format`, and `pace: 'timed'`.
  - Accessible names that the e2e specs rely on:

    | Element | Accessible name |
    |---|---|
    | Buttons | **Vowel**, **Consonant**, **Delete**, **Shuffle**, **Lock in**, **Undo**, **Reset**, **Next round**, **See result**, **Retry** |
    | Groups | **Letters drawn**, **Your word**, **Letters** (the nine letter keys), **Large numbers** (buttons `0`–`4`), **Numbers** (tile buttons named by value), **Operations** (**plus**, **minus**, **times**, **divided by**), **You** and **Dictionary corner** (the two sides of the result) |
    | Region | **Round result** |
    | Other | `data-testid="target"`, and the reason line `role="status"` |

**Layout notes:** every control sits in the bottom part of the play area (`justify-content: flex-end`). The nine letter keys are a 3×3 grid of 52 px keys, which keeps tap targets ≥ 44 px; the display rows are 9 × 32 px tiles, which fit the iPhone SE's 343 px. Used keys fade and lose their shadow, and a selected number is inverted to ink. Neither relies on color alone.

- [ ] **Step 1: The ink burst (platform)**

`src/lib/platform/ui/Burst.svelte`:

```svelte
<script lang="ts">
	/** A one-shot red ink burst for scoring moments (spec §6.4). Place it in a positioned element. */
	const angles = Array.from({ length: 10 }, (_, i) => i * 36);
</script>

<span class="burst" aria-hidden="true">
	{#each angles as angle (angle)}<i style:--angle="{angle}deg"></i>{/each}
</span>

<style>
	.burst {
		position: absolute;
		left: 50%;
		top: 50%;
		pointer-events: none;
	}
	i {
		position: absolute;
		width: 8px;
		height: 8px;
		margin: -4px;
		border-radius: 50%;
		background: var(--accent);
		opacity: 0;
		animation: burst 520ms var(--ease-out);
	}
	@keyframes burst {
		from {
			opacity: 1;
			transform: rotate(var(--angle)) translateY(0) scale(1);
		}
		to {
			opacity: 0;
			transform: rotate(var(--angle)) translateY(-56px) scale(0.3);
		}
	}
</style>
```

- [ ] **Step 2: Letter tiles and the drawing screen**

`src/lib/games/letters-and-numbers/TileRow.svelte`:

```svelte
<script lang="ts">
	import { LETTER_COUNT } from './letters';

	let { letters, label }: { letters: readonly string[]; label: string } = $props();
	const slots = Array.from({ length: LETTER_COUNT }, (_, i) => i);
</script>

<div class="row" role="group" aria-label={label}>
	{#each slots as i (i)}
		<span class="tile" class:empty={letters[i] === undefined}>{letters[i]?.toUpperCase() ?? ''}</span>
	{/each}
</div>

<style>
	.row {
		display: flex;
		justify-content: center;
		gap: 4px;
	}
	.tile {
		width: 32px;
		height: 40px;
		display: grid;
		place-items: center;
		border: var(--line) solid var(--ink);
		border-radius: var(--radius-sm);
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 20px;
	}
	.tile.empty {
		border-style: dashed;
		opacity: 0.35;
	}
</style>
```

`src/lib/games/letters-and-numbers/Draw.svelte`:

```svelte
<script lang="ts">
	import Button from '$lib/platform/ui/Button.svelte';
	import { canDraw, LETTER_COUNT, type LettersRound, MIN_CONSONANTS, MIN_VOWELS } from './letters';
	import type { Action } from './round';
	import TileRow from './TileRow.svelte';

	let { round, play }: { round: LettersRound; play: (action: Action) => void } = $props();
	const left = $derived(LETTER_COUNT - round.letters.length);
</script>

<div class="draw">
	<TileRow letters={round.letters} label="Letters drawn" />
	<p class="prompt">{left} to go: a vowel or a consonant?</p>
	<p class="hint">At least {MIN_VOWELS} vowels and {MIN_CONSONANTS} consonants</p>
	<div class="actions">
		<Button
			variant="ink"
			disabled={!canDraw(round, 'vowel')}
			onclick={() => play({ type: 'draw', pile: 'vowel' })}>Vowel</Button
		>
		<Button
			variant="ink"
			disabled={!canDraw(round, 'consonant')}
			onclick={() => play({ type: 'draw', pile: 'consonant' })}>Consonant</Button
		>
	</div>
</div>

<style>
	.draw {
		display: grid;
		gap: 10px;
	}
	.prompt {
		margin: 8px 0 0;
		text-align: center;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 18px;
	}
	.hint {
		margin: 0;
		text-align: center;
		color: var(--ink-soft);
		font-size: 13px;
	}
	.actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin-top: 8px;
	}
</style>
```

- [ ] **Step 3: The word board (letters and conundrum play)**

`src/lib/games/letters-and-numbers/WordBoard.svelte`:

```svelte
<script lang="ts">
	import Button from '$lib/platform/ui/Button.svelte';
	import { type Board, entryWord } from './board';
	import type { Action } from './round';
	import TileRow from './TileRow.svelte';

	let { board, play }: { board: Board; play: (action: Action) => void } = $props();
	const word = $derived([...entryWord(board)]);
</script>

<div class="word-board">
	<TileRow letters={word} label="Your word" />
	<div class="keys" role="group" aria-label="Letters">
		{#each board.order as index (index)}
			<button
				class="key"
				disabled={board.entry.includes(index)}
				onclick={() => play({ type: 'tile', index })}>{board.letters[index].toUpperCase()}</button
			>
		{/each}
	</div>
	<div class="actions">
		<Button aria-label="Delete" onclick={() => play({ type: 'backspace' })}>⌫</Button>
		<Button aria-label="Shuffle" onclick={() => play({ type: 'shuffle' })}>↻</Button>
		<Button variant="accent" onclick={() => play({ type: 'lock' })}>Lock in</Button>
	</div>
</div>

<style>
	.word-board {
		display: grid;
		gap: 12px;
	}
	.keys {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}
	.key {
		min-height: 52px;
		border: var(--line) solid var(--ink);
		border-radius: 10px;
		background: var(--paper);
		box-shadow: var(--shadow-sm);
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 22px;
		cursor: pointer;
		touch-action: manipulation;
	}
	.key:active:not(:disabled) {
		transform: translate(2px, 2px);
		box-shadow: none;
	}
	.key:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.key:disabled {
		opacity: 0.25;
		box-shadow: none;
		cursor: default;
	}
	.actions {
		display: grid;
		grid-template-columns: 1fr 1fr 2fr;
		gap: 8px;
	}
</style>
```

- [ ] **Step 4: The numbers board**

`src/lib/games/letters-and-numbers/NumbersBoard.svelte`:

```svelte
<script lang="ts">
	import Button from '$lib/platform/ui/Button.svelte';
	import { away, formatStep, OPS } from './labels';
	import { closest, LARGE, type NumbersRound } from './numbers';
	import type { Action, Op } from './round';

	let { round, play }: { round: NumbersRound; play: (action: Action) => void } = $props();

	/** The first tile tapped, and the operation chosen after it (transient UI state, not saved). */
	let first = $state<number | null>(null);
	let op = $state<Op | null>(null);
	const counts = Array.from({ length: LARGE.length + 1 }, (_, i) => i);
	const near = $derived(
		round.pool.length
			? closest(
					round.pool.map((t) => t.value),
					round.target,
				)
			: null,
	);

	function clear(): void {
		first = null;
		op = null;
	}

	/** Tile, operation, tile: the second tile combines. Tapping the first tile again deselects it. */
	function pick(id: number): void {
		if (first !== null && op !== null && id !== first) {
			play({ type: 'combine', a: first, op, b: id });
			clear();
		} else {
			first = first === id ? null : id;
			op = null;
		}
	}

	function choose(next: Op): void {
		if (first !== null) op = op === next ? null : next;
	}
</script>

{#if round.phase === 'setup'}
	<div class="setup">
		<p class="prompt">How many large numbers?</p>
		<p class="hint">Large: {LARGE.join(' · ')}. The rest are 1–10.</p>
		<div class="counts" role="group" aria-label="Large numbers">
			{#each counts as count (count)}
				<Button variant="ink" onclick={() => play({ type: 'large', count })}>{count}</Button>
			{/each}
		</div>
	</div>
{:else}
	<div class="numbers-board">
		<p class="target tabular" data-testid="target">{round.target}</p>
		<ol class="working" aria-label="Working">
			{#each round.steps as step, i (i)}<li class="tabular">{formatStep(step)}</li>{/each}
		</ol>
		{#if near !== null}<p class="near tabular">Closest {near}, {away(near, round.target)}</p>{/if}
		<div class="tiles" role="group" aria-label="Numbers">
			{#each round.pool as tile (tile.id)}
				<button class="key tabular" aria-pressed={first === tile.id} onclick={() => pick(tile.id)}
					>{tile.value}</button
				>
			{/each}
		</div>
		<div class="ops" role="group" aria-label="Operations">
			{#each OPS as o (o.op)}
				<button
					class="key"
					aria-label={o.name}
					aria-pressed={op === o.op}
					disabled={first === null}
					onclick={() => choose(o.op)}>{o.symbol}</button
				>
			{/each}
		</div>
		<div class="actions">
			<Button
				disabled={round.steps.length === 0}
				onclick={() => {
					clear();
					play({ type: 'undo' });
				}}>Undo</Button
			>
			<Button
				disabled={round.steps.length === 0}
				onclick={() => {
					clear();
					play({ type: 'reset' });
				}}>Reset</Button
			>
			<Button variant="accent" onclick={() => play({ type: 'lock' })}>Lock in</Button>
		</div>
	</div>
{/if}

<style>
	.setup,
	.numbers-board {
		display: grid;
		gap: 10px;
	}
	.prompt {
		margin: 0;
		text-align: center;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 18px;
	}
	.hint,
	.near {
		margin: 0;
		text-align: center;
		color: var(--ink-soft);
		font-size: 13px;
	}
	.counts {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 8px;
	}
	.target {
		margin: 0;
		text-align: center;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 44px;
	}
	.working {
		min-height: 20px;
		margin: 0;
		padding: 0;
		list-style: none;
		text-align: center;
		font-size: 14px;
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}
	.ops {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
	}
	.key {
		min-height: 48px;
		border: var(--line) solid var(--ink);
		border-radius: 10px;
		background: var(--paper);
		box-shadow: var(--shadow-sm);
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 20px;
		cursor: pointer;
		touch-action: manipulation;
	}
	.key[aria-pressed='true'] {
		background: var(--ink);
		color: var(--paper);
	}
	.key:active:not(:disabled) {
		transform: translate(2px, 2px);
		box-shadow: none;
	}
	.key:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.key:disabled {
		opacity: 0.35;
		box-shadow: none;
		cursor: default;
	}
	.actions {
		display: grid;
		grid-template-columns: 1fr 1fr 2fr;
		gap: 8px;
	}
</style>
```

- [ ] **Step 5: Dictionary corner (the round review)**

`src/lib/games/letters-and-numbers/Corner.svelte`:

```svelte
<script lang="ts">
	import Burst from '$lib/platform/ui/Burst.svelte';
	import { away, formatStep } from './labels';
	import { type LettersRound, MIN_WORD } from './letters';
	import { type Round, roundResult } from './rules';

	let { round }: { round: Round } = $props();
	const result = $derived(roundResult(round));

	function lettersNote(r: LettersRound): string {
		if (!r.locked) return 'No word locked in';
		if (r.locked.length < MIN_WORD) return 'Too short';
		if (r.valid === null) return 'Checking…';
		return r.valid ? `${r.locked.length} letters` : 'Not in the word list';
	}
</script>

<section class="corner" aria-label="Round result">
	<div class="side" role="group" aria-label="You">
		<h3>You</h3>
		{#if round.kind === 'letters'}
			<p class="answer">{round.locked ? round.locked.toUpperCase() : '—'}</p>
			<p class="note">{lettersNote(round)}</p>
		{:else if round.kind === 'numbers'}
			{#if round.locked !== null}
				<p class="answer tabular">{round.locked}</p>
				<p class="note">{away(round.locked, round.target)} from {round.target}</p>
			{/if}
			<ol class="working">
				{#each round.steps as step, i (i)}<li class="tabular">{formatStep(step)}</li>{/each}
			</ol>
		{:else}
			<p class="answer">{round.locked === round.answer ? round.answer.toUpperCase() : 'Not solved'}</p>
		{/if}
		<p class="pts tabular">{result ? `${result.score} pts` : '…'}</p>
		{#if result && result.score > 0 && result.score === result.bestScore}<Burst />{/if}
	</div>

	<div class="side best" role="group" aria-label="Dictionary corner">
		<h3>Dictionary corner</h3>
		{#if round.kind === 'letters'}
			{#if round.best === null}
				<p class="note">Thinking…</p>
			{:else if round.best.length === 0}
				<p class="answer">—</p>
			{:else}
				<ul class="words">
					{#each round.best as word (word)}
						<li><span class="answer">{word.toUpperCase()}</span> <span class="note">{word.length}</span></li>
					{/each}
				</ul>
			{/if}
		{:else if round.kind === 'numbers'}
			{#if round.best === null}
				<p class="note">Thinking…</p>
			{:else}
				<p class="answer tabular">{round.best.value}</p>
				<p class="note">{away(round.best.value, round.target)}</p>
				<ol class="working">
					{#each round.best.steps as step, i (i)}<li class="tabular">{formatStep(step)}</li>{/each}
				</ol>
			{/if}
		{:else}
			<p class="answer">{round.answer.toUpperCase()}</p>
		{/if}
		<p class="pts tabular">{result ? `${result.bestScore} pts` : '…'}</p>
	</div>
</section>

<style>
	.corner {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.side {
		position: relative;
		display: grid;
		align-content: start;
		gap: 4px;
		padding: 12px;
		border: var(--line) solid var(--ink);
		border-radius: var(--radius);
	}
	.best {
		box-shadow: var(--shadow);
	}
	h3 {
		font-size: 14px;
	}
	.answer {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 18px;
		overflow-wrap: anywhere;
	}
	.note {
		margin: 0;
		color: var(--ink-soft);
		font-size: 12px;
	}
	.words,
	.working {
		display: grid;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 12px;
	}
	.pts {
		margin: 6px 0 0;
		font-weight: 700;
	}
</style>
```

- [ ] **Step 6: The View**

`src/lib/games/letters-and-numbers/View.svelte`:

```svelte
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { GameProps, PausableTimer } from '$lib/platform/types';
	import Button from '$lib/platform/ui/Button.svelte';
	import { freeTile } from './board';
	import Corner from './Corner.svelte';
	import { createDictionary } from './dictionary';
	import Draw from './Draw.svelte';
	import { KIND_NAMES, REASONS, ROUND_NAMES } from './labels';
	import NumbersBoard from './NumbersBoard.svelte';
	import { type Action, type Rejection, ROUND_MS } from './round';
	import {
		canAdvance,
		type Env,
		FORMATS,
		isFormat,
		type LnOptions,
		newGame,
		reduce,
		type State,
		totals,
	} from './rules';
	import WordBoard from './WordBoard.svelte';

	let { options, saved, ctx }: GameProps<State, LnOptions> = $props();

	const dictionary = createDictionary();
	// $state.raw: the state is replaced whole on every change, and parts of it are posted to the
	// worker, which can't clone a deep $state proxy.
	let game = $state.raw<State | null>(untrack(() => saved));
	let conundrums = $state.raw<readonly string[] | null>(null);
	let failed = $state(false);
	let rejection = $state<Rejection | null>(null);
	let nudge = $state(0);
	let timer = $state.raw<PausableTimer | null>(null);
	let root = $state<HTMLElement>();
	/** Dictionary questions already asked in this run, so no effect asks twice. */
	const asked = new Set<string>();

	const env = (): Env => ({ rng: ctx.rng, conundrums: conundrums ?? [] });
	const count = $derived(game ? FORMATS[game.format].length : 0);
	const last = $derived(game !== null && game.index === count - 1);

	onMount(() => {
		// A new game waits for the conundrum answers, so every round can be created on the spot.
		dictionary.conundrums().then(
			(list) => {
				conundrums = list;
				game ??= newGame(isFormat(options.format) ? options.format : 'match', env());
			},
			() => {
				failed = true;
			},
		);
		return () => dictionary.dispose();
	});

	$effect(() => {
		if (!game) return;
		const kind = game.round.kind;
		ctx.setMeta(
			count > 1 ? `Round ${game.index + 1} of ${count} · ${KIND_NAMES[kind]}` : ROUND_NAMES[kind],
			`Score ${totals(game.results).score}`,
		);
	});

	/** The round whose clock runs, or -1. Derived, so the clock effect reruns only when it changes. */
	const clockRound = $derived(
		conundrums !== null && game && !game.over && game.round.phase === 'play' ? game.index : -1,
	);

	$effect(() => {
		if (clockRound < 0) return;
		const t = untrack(() =>
			ctx.timer(ROUND_MS, onTimeout, ROUND_MS - (game?.round.msLeft ?? ROUND_MS)),
		);
		timer = t;
		return () => {
			t.stop();
			timer = null;
		};
	});

	// Saves the clock once a second, so a resumed round keeps the time it had.
	const secondsLeft = $derived(timer ? Math.ceil(timer.remainingMs / 1000) : null);
	$effect(() => {
		const s = secondsLeft;
		if (s !== null) untrack(() => apply({ type: 'tick', msLeft: s * 1000 }));
	});

	// Asks dictionary corner whatever the current round is waiting for (again after a resume).
	$effect(() => {
		const g = game;
		if (g && !g.over) untrack(() => askFor(g));
	});

	function askFor(g: State): void {
		const r = g.round;
		const key = `${g.index}:${r.kind}`;
		if (r.kind === 'letters') {
			const { letters, locked } = r;
			if (r.phase !== 'setup' && r.best === null) {
				query(`${key}:best`, () => dictionary.bestWords(letters), (words) => ({ type: 'best-words', words }));
			}
			if (locked !== null && r.valid === null) {
				query(`${key}:judge`, () => dictionary.isWord(locked), (valid) => ({ type: 'judged', valid }));
			}
		} else if (r.kind === 'numbers' && r.phase !== 'setup' && r.best === null) {
			const { tiles, target } = r;
			query(
				`${key}:best`,
				() => dictionary.solveNumbers(tiles, target),
				(solution) => ({ type: 'best-numbers', solution }),
			);
		}
	}

	function query<T>(key: string, run: () => Promise<T>, toAction: (result: T) => Action): void {
		if (asked.has(key)) return;
		asked.add(key);
		run().then(
			(result) => apply(toAction(result)),
			() => {
				failed = true;
			},
		);
	}

	/** Applies an action from anywhere (the player, the clock, the dictionary) and saves or finishes. */
	function apply(action: Action): Rejection | undefined {
		if (!game) return undefined;
		const { state, rejected } = reduce(game, action, env());
		if (state === game) return rejected;
		game = state;
		if (state.over) finish(state);
		else ctx.save(state);
		return undefined;
	}

	/** A player's action: ignored while paused, with feedback. */
	function play(action: Action): void {
		if (ctx.paused || !game || game.over) return;
		const before = game;
		const rejected = apply(action);
		if (rejected) {
			rejection = rejected;
			nudge += 1;
			ctx.feedback.sound('fail');
			ctx.feedback.haptic('error');
			return;
		}
		if (game === before) return;
		rejection = null;
		if (action.type === 'lock') {
			ctx.feedback.sound('pop');
			ctx.feedback.haptic('tap');
		} else {
			ctx.feedback.sound('tick');
		}
	}

	function onTimeout(): void {
		apply({ type: 'timeout' });
		ctx.feedback.sound('pop');
	}

	function finish(g: State): void {
		const { score, best } = totals(g.results);
		ctx.finish({
			stamp: score === best && best > 0 ? 'Perfect!' : count > 1 ? 'Match over' : 'Round over',
			headline: `${score} / ${best}`,
			detail: 'yours / best possible',
			reveal: summary,
		});
	}

	/** A focused control outside the game (Home, Menu, ...) keeps Enter and Backspace for itself. */
	function controlFocused(target: EventTarget | null): boolean {
		return (
			target instanceof Element &&
			!root?.contains(target) &&
			target.closest('a, button, input, select, textarea, [tabindex]') !== null
		);
	}

	function onkeydown(e: KeyboardEvent): void {
		const r = game?.round;
		if (!r || r.kind === 'numbers' || r.phase !== 'play') return;
		if (e.metaKey || e.ctrlKey || e.altKey || ctx.paused) return;
		if (/^[a-z]$/i.test(e.key)) {
			const index = freeTile(r, e.key.toLowerCase());
			if (index !== null) play({ type: 'tile', index });
		} else if (controlFocused(e.target)) return;
		else if (e.key === 'Backspace') play({ type: 'backspace' });
		else if (e.key === 'Enter') play({ type: 'lock' });
		else return;
		e.preventDefault();
	}
</script>

<svelte:window {onkeydown} />

{#snippet summary()}
	<table class="summary">
		<thead>
			<tr><th scope="col">Round</th><th scope="col">You</th><th scope="col">Best</th></tr>
		</thead>
		<tbody>
			{#each game?.results ?? [] as r, i (i)}
				<tr>
					<th scope="row">{KIND_NAMES[r.kind]}</th>
					<td>{r.yours} <b class="tabular">{r.score}</b></td>
					<td>{r.best} <b class="tabular">{r.bestScore}</b></td>
				</tr>
			{/each}
		</tbody>
	</table>
{/snippet}

<div class="ln" bind:this={root}>
	{#if failed}
		<div class="status" role="alert">
			<p>The word list couldn't load. Check your connection and try again.</p>
			<Button onclick={() => location.reload()}>Retry</Button>
		</div>
	{:else if !game || !conundrums}
		<p class="status">Loading…</p>
	{:else if game.round.phase === 'review'}
		<Corner round={game.round} />
		<Button variant="accent" disabled={!canAdvance(game)} onclick={() => play({ type: 'next' })}
			>{last ? 'See result' : 'Next round'}</Button
		>
	{:else if game.round.kind === 'letters' && game.round.phase === 'setup'}
		<Draw round={game.round} {play} />
	{:else if game.round.kind === 'numbers'}
		<NumbersBoard round={game.round} {play} />
	{:else}
		<WordBoard board={game.round} {play} />
	{/if}
	{#key nudge}
		<p class="reason" class:shake={nudge > 0} role="status">{rejection ? REASONS[rejection] : ''}</p>
	{/key}
</div>

<style>
	.ln {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 12px;
		min-height: 0;
	}
	.status {
		margin: auto 0;
		text-align: center;
		display: grid;
		gap: 12px;
		justify-items: center;
	}
	.reason {
		min-height: 20px;
		margin: 0;
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
	.summary {
		border-collapse: collapse;
		font-size: 13px;
		text-align: left;
	}
	.summary th,
	.summary td {
		padding: 2px 6px;
	}
	.summary thead th {
		color: var(--ink-soft);
		font-weight: 600;
	}
</style>
```

- [ ] **Step 7: Rules sheet, module, definition, icon and registration**

`src/lib/games/letters-and-numbers/HowToPlay.svelte`:

```svelte
<p>
	Three kinds of round, 30 seconds each. A mini match plays six: letters, letters, numbers,
	letters, numbers, conundrum.
</p>
<h3>Letters</h3>
<ul>
	<li>Pick vowels and consonants until you have nine letters (at least 3 vowels, 4 consonants).</li>
	<li>Make the longest word you can: tap the letters or type them, then <b>Lock in</b>.</li>
	<li>A word scores its length. All nine letters score 18.</li>
</ul>
<h3>Numbers</h3>
<ul>
	<li>Choose how many large numbers (25, 50, 75, 100) join the small ones.</li>
	<li>Tap a number, an operation, then another number. The result replaces both.</li>
	<li>Results must be whole numbers above zero.</li>
	<li>Exact scores 10, within 5 scores 7, within 10 scores 5.</li>
</ul>
<h3>Conundrum</h3>
<ul>
	<li>Unscramble the nine letters into one word, for 10 points.</li>
</ul>
<p>After each round, dictionary corner shows the best answer it can find.</p>

<style>
	h3 {
		margin-top: 12px;
		font-size: 16px;
	}
	ul {
		padding-left: 20px;
	}
	li {
		margin: 6px 0;
	}
</style>
```

`src/lib/games/letters-and-numbers/module.ts`:

```ts
import type { GameModule } from '$lib/platform/types';
import HowToPlay from './HowToPlay.svelte';
import { type LnOptions, progressLabel, type State } from './rules';
import View from './View.svelte';

const mod: GameModule<State, LnOptions> = { View, Rules: HowToPlay, progressLabel };

export default mod;
```

`src/lib/games/letters-and-numbers/index.ts`:

```ts
import { defineGame } from '$lib/platform/types';
import icon from './icon.svg?raw';
import type { LnOptions, State } from './rules';

export const lettersAndNumbers = defineGame<State, LnOptions>({
	id: 'letters-and-numbers',
	title: 'Letters & Numbers',
	pitch: 'Nine letters, six numbers, 30 seconds',
	category: 'words',
	pace: 'timed',
	minutes: [1, 7],
	icon,
	saveVersion: 1,
	options: [
		{
			key: 'format',
			label: 'Format',
			default: 'match',
			choices: [
				{ value: 'match', label: 'Mini match', hint: '6 rounds · about 6 min' },
				{ value: 'letters', label: 'Letters round', hint: 'Longest word from 9 letters' },
				{ value: 'numbers', label: 'Numbers round', hint: 'Hit a target with 6 numbers' },
				{ value: 'conundrum', label: 'Conundrum', hint: 'Unscramble one 9-letter word' },
			],
		},
	],
	load: () => import('./module').then((m) => m.default),
});
```

`src/lib/games/letters-and-numbers/icon.svg` (one line):

```svg
<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><title>Letters &amp; Numbers</title><rect x="5" y="8" width="14" height="14" rx="2.5"/><path d="M9 19l3-8 3 8M10.2 16.5h3.6"/><rect x="21" y="18" width="14" height="14" rx="2.5"/><path class="accent" d="M28 21.5v7M24.5 25h7"/></svg>
```

`src/lib/platform/registry.ts`: add one import and one array entry, and nothing else:

```ts
import { lettersAndNumbers } from '../games/letters-and-numbers';
…
export const games: AnyGame[] = [breakTheCode, lettersAndNumbers];
```

- [ ] **Step 8: Run the gates and a smoke test**

Run: `npm test && npm run check && npm run lint`
Expected:
- Every test passes, including the registry contract test for `letters-and-numbers`, which checks metadata, options, `load()` and that `rules.test.ts` exists.
- Check reports 0 errors and 0 warnings. Fix any a11y warnings in the components; don't suppress them.
- Lint is clean.

Run: `npm run build && npm run size && ls build/_app/immutable/workers build/_app/immutable/assets | grep -E 'solver|^en'`
Expected:
- The size script reports `game letters-and-numbers` well under 50 KB, and home still under 100 KB.
- The `ls` lists a `solver…js` worker and both `en….txt` word files, so the service worker's `build` list includes them.
- If there is no `workers/` directory, find the worker with `grep -rl createSolver build/_app/immutable`.

Smoke test by hand: run `npm run dev -- --host`, open `/tinkster/play/letters-and-numbers` and play one mini match through. Check each of these:
- The clock strip appears empty on the drawing screen, and runs once nine letters are drawn.
- Dictionary corner fills in.
- The end card lists all six rounds.

- [ ] **Step 9: Commit**

```bash
npm run format
git add src/lib/platform/ui/Burst.svelte src/lib/platform/registry.ts src/lib/games/letters-and-numbers
git commit -m "feat(letters-and-numbers): add the game view and register it

Assisted-by: Claude Code (<model>)"
```

---
### Task 9: End-to-end tests for Letters & Numbers

**Files:**
- Modify: `e2e/helpers.ts`, `e2e/home.spec.ts`
- Create: `e2e/letters-and-numbers.spec.ts`

**Interfaces:**
- Consumes: the accessible names listed in Task 8; `solveNumbers` and `scoreNumbers` (Task 5); `OPS` (Task 6); `parseWordList`, `parseLines` and `signature` (Task 2).
- Produces (in `e2e/helpers.ts`, used by Task 10):
  - `startLettersAndNumbers(page, format)`
  - `drawLetters(page, picks?)`, `boardLetters(page)`
  - `longestWord(letters)`, `nonWord(letters)`, `conundrumAnswer(scramble)`
  - `chooseLarge(page, count)`, `numbersOnBoard(page)`, `playSteps(page, steps)`
  - re-exports of `solveNumbers` and `scoreNumbers`

- [ ] **Step 1: Helpers**

Append to `e2e/helpers.ts`, and add the imports at the top of the file:

```ts
import { readFileSync } from 'node:fs';
import { OPS } from '../src/lib/games/letters-and-numbers/labels';
import { scoreNumbers, solveNumbers } from '../src/lib/games/letters-and-numbers/numbers';
import type { Step } from '../src/lib/games/letters-and-numbers/round';
import { parseLines, parseWordList, signature, type WordList } from '../src/lib/platform/words';
```

```ts
// ---- Letters & Numbers ----
// Import only game files with no runtime `$lib/...` imports here: Playwright doesn't resolve
// SvelteKit's aliases. The word oracles read the committed files, not the game's solver.

export { scoreNumbers, solveNumbers };

let words: WordList | undefined;
let answers: string[] | undefined;
const wordList = () =>
	(words ??= parseWordList(readFileSync('src/lib/platform/words/en.txt', 'utf8')));
const conundrums = () =>
	(answers ??= parseLines(readFileSync('src/lib/platform/words/en-conundrums.txt', 'utf8')));

export type LnFormat = 'Mini match' | 'Letters round' | 'Numbers round' | 'Conundrum';

export async function startLettersAndNumbers(page: Page, format: LnFormat = 'Mini match') {
	await page.goto(`play/letters-and-numbers?seed=${SEED}`);
	await page.getByRole('radio', { name: new RegExp(`^${format}`) }).check();
	await page.getByRole('button', { name: 'Start' }).click();
	const meta = format === 'Mini match' ? 'Round 1 of 6 · Letters' : format;
	await expect(page.getByText(meta, { exact: true })).toBeVisible();
}

/** Draws nine letters, consonant ('c') or vowel ('v') as spelled out; returns them lowercase. */
export async function drawLetters(page: Page, picks = 'cvccvcvcc'): Promise<string[]> {
	for (const pick of picks) {
		await page.getByRole('button', { name: pick === 'v' ? 'Vowel' : 'Consonant' }).click();
	}
	return boardLetters(page);
}

/** The nine letter keys, lowercase, in display order. */
export async function boardLetters(page: Page): Promise<string[]> {
	const keys = page.getByRole('group', { name: 'Letters', exact: true }).getByRole('button');
	await expect(keys).toHaveCount(9);
	return (await keys.allTextContents()).map((text) => text.trim().toLowerCase());
}

function spells(word: string, letters: readonly string[]): boolean {
	const left = [...letters];
	for (const ch of word) {
		const i = left.indexOf(ch);
		if (i < 0) return false;
		left.splice(i, 1);
	}
	return true;
}

/** The longest word dictionary corner can suggest (the alphabetically first on a tie). */
export function longestWord(letters: readonly string[]): string {
	const list = wordList();
	let best = '';
	for (const word of list.words) {
		if (word.length <= best.length || word.length > letters.length) continue;
		if (!list.neverSuggest.has(word) && spells(word, letters)) best = word;
	}
	return best;
}

/** Three of the letters in an order that isn't a word. */
export function nonWord(letters: readonly string[]): string {
	for (const a of letters) {
		for (const b of letters) {
			for (const c of letters) {
				const word = a + b + c;
				if (spells(word, letters) && !wordList().words.has(word)) return word;
			}
		}
	}
	throw new Error(`every arrangement of ${letters.join('')} is a word`);
}

export function conundrumAnswer(scramble: readonly string[]): string {
	const key = signature(scramble.join(''));
	const answer = conundrums().find((word) => signature(word) === key);
	if (!answer) throw new Error(`no conundrum answer for ${scramble.join('')}`);
	return answer;
}

export async function chooseLarge(page: Page, count: number) {
	await page
		.getByRole('group', { name: 'Large numbers', exact: true })
		.getByRole('button', { name: String(count), exact: true })
		.click();
}

export async function numbersOnBoard(page: Page): Promise<{ tiles: number[]; target: number }> {
	const keys = page.getByRole('group', { name: 'Numbers', exact: true }).getByRole('button');
	await expect(keys).toHaveCount(6);
	const tiles = (await keys.allTextContents()).map(Number);
	return { tiles, target: Number(await page.getByTestId('target').textContent()) };
}

/** Taps tile, operation, tile for each step. Values name the tiles, so equal tiles are the same. */
export async function playSteps(page: Page, steps: readonly Pick<Step, 'a' | 'op' | 'b'>[]) {
	const tiles = page.getByRole('group', { name: 'Numbers', exact: true });
	for (const { a, op, b } of steps) {
		await tiles.getByRole('button', { name: String(a), exact: true }).first().click();
		const name = OPS.find((o) => o.op === op)?.name ?? op;
		await page.getByRole('button', { name, exact: true }).click();
		const second = tiles.getByRole('button', { name: String(b), exact: true });
		await (a === b ? second.nth(1) : second.first()).click();
	}
}
```

- [ ] **Step 2: The game's spec**

`e2e/letters-and-numbers.spec.ts`:

```ts
import { expect, type Page, test } from '@playwright/test';
import {
	boardLetters,
	chooseLarge,
	conundrumAnswer,
	drawLetters,
	longestWord,
	nonWord,
	numbersOnBoard,
	playSteps,
	scoreNumbers,
	solveNumbers,
	startLettersAndNumbers,
} from './helpers';

const result = (page: Page) => page.getByRole('region', { name: 'Round result' });
const yours = (page: Page) => result(page).getByRole('group', { name: 'You' });
const lettersPoints = (word: string) => (word.length === 9 ? 18 : word.length);

test('a letters round: the longest word ties dictionary corner', async ({ page }) => {
	await startLettersAndNumbers(page, 'Letters round');
	const word = longestWord(await drawLetters(page));
	await page.keyboard.type(word);
	await expect(page.getByRole('group', { name: 'Your word' })).toHaveText(
		new RegExp(`^${word.toUpperCase().split('').join('\\s*')}$`),
	);
	await page.getByRole('button', { name: 'Lock in' }).click();
	await expect(yours(page)).toContainText(word.toUpperCase());
	await page.getByRole('button', { name: 'See result' }).click();
	const points = lettersPoints(word);
	const card = page.getByRole('dialog', { name: 'Perfect!' });
	await expect(card.getByRole('heading', { name: `${points} / ${points}` })).toBeVisible();
	await card.getByRole('button', { name: 'Play again' }).click();
	await expect(page.getByRole('button', { name: 'Vowel' })).toBeVisible();
});

test('when the clock runs out, the word on the board is locked in', async ({ page }) => {
	await page.clock.install();
	await startLettersAndNumbers(page, 'Letters round');
	const word = longestWord(await drawLetters(page));
	await page.keyboard.type(word);
	await page.clock.runFor(31_000);
	await expect(yours(page)).toContainText(word.toUpperCase());
});

test('a word that is not in the list scores nothing', async ({ page }) => {
	await startLettersAndNumbers(page, 'Letters round');
	await page.keyboard.type(nonWord(await drawLetters(page)));
	await page.keyboard.press('Enter');
	await expect(yours(page)).toContainText('Not in the word list');
	await expect(yours(page).getByText('0 pts', { exact: true })).toBeVisible();
});

test('drawing stops at five vowels', async ({ page }) => {
	await startLettersAndNumbers(page, 'Letters round');
	const vowel = page.getByRole('button', { name: 'Vowel' });
	for (let i = 0; i < 5; i++) await vowel.click();
	await expect(vowel).toBeDisabled();
	for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Consonant' }).click();
	await boardLetters(page);
});

test('drawing stops at six consonants', async ({ page }) => {
	await startLettersAndNumbers(page, 'Letters round');
	const consonant = page.getByRole('button', { name: 'Consonant' });
	for (let i = 0; i < 6; i++) await consonant.click();
	await expect(consonant).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Vowel' })).toBeEnabled();
});

test('a numbers round: dictionary corner’s own solution scores full marks', async ({ page }) => {
	await startLettersAndNumbers(page, 'Numbers round');
	await chooseLarge(page, 2);
	const { tiles, target } = await numbersOnBoard(page);
	const best = solveNumbers(tiles, target);
	await playSteps(page, best.steps);
	await page.getByRole('button', { name: 'Lock in' }).click();
	const points = scoreNumbers(best.value, target);
	await expect(yours(page).getByText(`${points} pts`, { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'See result' }).click();
	await expect(
		page.getByRole('dialog', { name: 'Perfect!' }).getByRole('heading', { name: `${points} / ${points}` }),
	).toBeVisible();
});

test('numbers: the rules are enforced, and undo and reset restore the tiles', async ({ page }) => {
	await startLettersAndNumbers(page, 'Numbers round');
	await chooseLarge(page, 2);
	const { tiles } = await numbersOnBoard(page);
	const big = Math.max(...tiles);
	const small = Math.min(...tiles);
	const keys = page.getByRole('group', { name: 'Numbers', exact: true }).getByRole('button');

	await playSteps(page, [{ a: small, op: '-', b: big }]);
	await expect(page.getByRole('status')).toHaveText('Results must stay above zero');
	const uneven = tiles.flatMap((a) => tiles.map((b) => [a, b])).find(([a, b]) => a % b !== 0);
	if (uneven) {
		await playSteps(page, [{ a: uneven[0], op: '/', b: uneven[1] }]);
		await expect(page.getByRole('status')).toHaveText('Division has to come out exact');
	}

	await playSteps(page, [{ a: big, op: '+', b: small }]);
	await expect(keys).toHaveCount(5);
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(keys).toHaveCount(6);
	await playSteps(page, [{ a: big, op: '+', b: small }]);
	await playSteps(page, [{ a: big + small, op: '+', b: Math.max(...tiles.filter((t) => t !== big && t !== small)) }]);
	await expect(keys).toHaveCount(4);
	await page.getByRole('button', { name: 'Reset' }).click();
	await expect(keys).toHaveText(tiles.map(String));
});

test('a conundrum: a wrong answer is refused, the right one scores 10', async ({ page }) => {
	await startLettersAndNumbers(page, 'Conundrum');
	const scramble = await boardLetters(page);
	await page.keyboard.type(scramble.join(''));
	await page.keyboard.press('Enter');
	await expect(page.getByRole('status')).toHaveText('Not the word');
	for (let i = 0; i < 9; i++) await page.keyboard.press('Backspace');
	await page.keyboard.type(conundrumAnswer(scramble));
	await page.keyboard.press('Enter');
	await page.getByRole('button', { name: 'See result' }).click();
	await expect(
		page.getByRole('dialog', { name: 'Perfect!' }).getByRole('heading', { name: '10 / 10' }),
	).toBeVisible();
});

test('a mini match resumes from the home screen at the same round', async ({ page }) => {
	await startLettersAndNumbers(page, 'Mini match');
	await drawLetters(page);
	await page.getByRole('button', { name: 'Lock in' }).click();
	await page.getByRole('button', { name: 'Next round' }).click();
	await expect(page.getByText('Round 2 of 6 · Letters')).toBeVisible();
	await page.getByRole('button', { name: 'Home' }).click();
	await page.getByRole('link', { name: /Letters & Numbers.*round 2 of 6.*Resume/ }).click();
	await expect(page.getByText('Round 2 of 6 · Letters')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Vowel' })).toBeVisible();
});

test('a resumed round keeps the time it had left', async ({ page }) => {
	await startLettersAndNumbers(page, 'Letters round');
	await drawLetters(page);
	const timer = page.getByRole('timer');
	await expect(timer).toHaveAttribute('aria-label', /^2[0-6] seconds left$/, { timeout: 12_000 });
	await page.getByRole('button', { name: 'Home' }).click();
	await page.getByRole('link', { name: /Letters & Numbers.*Resume/ }).click();
	await expect(timer).toHaveAttribute('aria-label', /^(2[0-7]|1\d) seconds left$/);
});

test('a mini match plays all six rounds and lists them on the end card', async ({ page }) => {
	test.slow();
	await startLettersAndNumbers(page, 'Mini match');
	const kinds = ['letters', 'letters', 'numbers', 'letters', 'numbers', 'conundrum'];
	for (const [i, kind] of kinds.entries()) {
		await expect(page.getByText(`Round ${i + 1} of 6`)).toBeVisible();
		if (kind === 'letters') {
			await drawLetters(page);
			await page.getByRole('button', { name: 'Lock in' }).click();
		} else if (kind === 'numbers') {
			await chooseLarge(page, 1);
			await page.getByRole('button', { name: 'Lock in' }).click();
		} else {
			await page.keyboard.type(conundrumAnswer(await boardLetters(page)));
			await page.keyboard.press('Enter');
		}
		await page.getByRole('button', { name: i === 5 ? 'See result' : 'Next round' }).click();
	}
	const card = page.getByRole('dialog');
	await expect(card.getByRole('row')).toHaveCount(7);
	await expect(card.getByRole('heading', { name: /^\d+ \/ \d+$/ })).toBeVisible();
});
```

Add to `e2e/home.spec.ts`:

```ts
test('lists Letters & Numbers under Words & numbers', async ({ page }) => {
	await page.goto('./');
	const words = page.getByRole('region', { name: 'Words & numbers' });
	await words.getByRole('link', { name: /Letters & Numbers/ }).click();
	await expect(page).toHaveURL(/\/play\/letters-and-numbers$/);
});
```

- [ ] **Step 3: Run the e2e suite**

Run: `npm run test:e2e`
Expected: every spec passes on `iphone-se` and `pixel-7`; the only skip is the known Chromium-only offline one.

Fix these by adjusting the test, never the game's rules:

- **The clock test:** if `page.clock` misbehaves with the app's rAF timer, replace `page.clock.install()` / `runFor` with `test.setTimeout(60_000)` and a 35 s `toContainText` timeout. Record that as a ruling.
- **Seed-dependent draws:** if the seeded draw makes a test impossible, pick another `picks` string or large count, and say so in the test. For example, the numbers round could come out more than 10 away, which gives no **Perfect!**.

- [ ] **Step 4: Commit**

```bash
npm run format
git add e2e
git commit -m "test(letters-and-numbers): cover every round, the match, resume and the clock

Assisted-by: Claude Code (<model>)"
```

---

### Task 10: The shared gates (a11y, offline, privacy, visual) and the size budget

**Files:**
- Modify: `e2e/a11y.spec.ts`, `e2e/offline.spec.ts`, `e2e/privacy.spec.ts`, `e2e/visual.spec.ts`
- Regenerate and commit:
  - `e2e/visual.spec.ts-snapshots/home-{light,dark}-visual-linux.png`, which change because of the new tile.
  - New `ln-letters-{light,dark}-visual-linux.png` and `ln-numbers-{light,dark}-visual-linux.png`.

**Interfaces:**
- Consumes: the Task 9 helpers.

- [ ] **Step 1: Accessibility**

In `e2e/a11y.spec.ts`, import `chooseLarge`, `drawLetters`, `longestWord` and `startLettersAndNumbers` from `./helpers`. Add these tests inside the `for (const colorScheme …)` block:

```ts
		test('letters & numbers: letters in play', async ({ page }) => {
			await startLettersAndNumbers(page, 'Letters round');
			const letters = await drawLetters(page);
			await page.keyboard.type(longestWord(letters).slice(0, 3));
			await audit(page);
		});

		test('letters & numbers: numbers in play', async ({ page }) => {
			await startLettersAndNumbers(page, 'Numbers round');
			await chooseLarge(page, 2);
			await page.getByRole('group', { name: 'Numbers', exact: true }).getByRole('button').first().click();
			await audit(page);
		});

		test('letters & numbers: round result and end card', async ({ page }) => {
			await startLettersAndNumbers(page, 'Letters round');
			await page.keyboard.type(longestWord(await drawLetters(page)));
			await page.keyboard.press('Enter');
			await expect(page.getByRole('button', { name: 'See result' })).toBeEnabled();
			await audit(page);
			await page.getByRole('button', { name: 'See result' }).click();
			await expect(page.getByRole('dialog')).toBeVisible();
			await audit(page);
		});
```

- [ ] **Step 2: Offline**

In `e2e/offline.spec.ts`, import `drawLetters`, `longestWord` and `startLettersAndNumbers`. After `await startBreakTheCode(page);`, add:

```ts
	// The game chunk, the worker and the word lists must all come from the service worker's cache.
	await startLettersAndNumbers(page, 'Letters round');
	await page.keyboard.type(longestWord(await drawLetters(page)));
	await page.keyboard.press('Enter');
	await expect(page.getByRole('button', { name: 'See result' })).toBeEnabled();
```

- [ ] **Step 3: Privacy**

In `e2e/privacy.spec.ts`, import the same three helpers. Just before the two final `expect(...)` lines, add:

```ts
	// Starts the dictionary worker and fetches the word lists.
	await startLettersAndNumbers(page, 'Letters round');
	await page.keyboard.type(longestWord(await drawLetters(page)));
	await page.keyboard.press('Enter');
	await expect(page.getByRole('button', { name: 'See result' })).toBeEnabled();
```

- [ ] **Step 4: Visual regression**

In `e2e/visual.spec.ts`, import `chooseLarge`, `drawLetters`, `longestWord`, `numbersOnBoard`, `playSteps`, `solveNumbers` and `startLettersAndNumbers`. Add these tests inside the `for (const colorScheme …)` block. The running clock is masked: `toHaveScreenshot` needs two identical captures, and the strip moves every frame.

```ts
		test('letters & numbers letters in play', async ({ page }) => {
			await startLettersAndNumbers(page, 'Letters round');
			await page.keyboard.type(longestWord(await drawLetters(page)).slice(0, 4));
			await expect(page).toHaveScreenshot(`ln-letters-${colorScheme}.png`, {
				mask: [page.getByRole('timer')],
			});
		});

		test('letters & numbers numbers in play', async ({ page }) => {
			await startLettersAndNumbers(page, 'Numbers round');
			await chooseLarge(page, 2);
			const { tiles, target } = await numbersOnBoard(page);
			await playSteps(page, solveNumbers(tiles, target).steps.slice(0, 1));
			await expect(page).toHaveScreenshot(`ln-numbers-${colorScheme}.png`, {
				mask: [page.getByRole('timer')],
			});
		});
```

- [ ] **Step 5: Run everything on the host**

Run: `npm test && npm run check && npm run lint && npm run test:e2e && npm run build && npm run size`
Expected: all green. The size script reports home ≤ 100 KB, Break the Code ≤ 50 KB, Letters & Numbers ≤ 50 KB and fonts ≤ 110 KB.

- [ ] **Step 6: Regenerate the baselines (Docker, hard stop for a human look)**

Run: `npm run test:visual:update`, then `npm run test:visual`
Expected:
- Four new PNGs and two changed home PNGs; the second command passes.
- **Don't run host builds while the container runs**: they share the `build/` folder.

**Stop here.** Show the author the six new or changed PNGs, and commit them only after the author approves them.

- [ ] **Step 7: Commit**

```bash
npm run format
git add e2e
git commit -m "test: add Letters & Numbers to the a11y, offline, privacy and visual gates

Assisted-by: Claude Code (<model>)"
```

---

### Task 11: Documentation

**Files:**
- Modify: `docs/adding-a-game.md`, `AGENTS.md`, `README.md`, `docs/specs/2026-09-27-tinkster-v1-design.md`, `docs/HANDOFF.md`

- [ ] **Step 1: `docs/adding-a-game.md`**

Add a section after "### Real-time games" (inside §4):

````md
### Word games and heavy work

- **Word lists.** `$lib/platform/words` parses the shared lists (`parseWordList`, `signature`).
  `$lib/platform/words/urls` gives their content-hashed URLs. Fetch the lists at runtime; never
  import them into a chunk. The build and curation pipeline is `npm run words` (spec §9).
- **Web Workers.** Heavy work (solvers, big lookups) belongs in a module worker, created
  exactly like this so Vite bundles it:

  ```ts
  new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
  ```

  Keep state you post to a worker in `$state.raw`: a deep `$state` proxy can't be cloned. See
  `src/lib/games/letters-and-numbers/dictionary.ts`.
- **Resuming a clock.** Save the time left in your state once a second, then call
  `ctx.timer(ms, onExpire, ms - saved)` on resume. Letters & Numbers' `View.svelte` does this.
````

In §10 ("Your game's spec"), after the sentence that mentions importing `rules.ts`, add:

```md
Playwright doesn't resolve SvelteKit's `$lib` alias, so import only files whose **runtime**
imports are relative (`import type` from `$lib` is fine). When a file can't be imported that way,
read the board from the page instead, as the Letters & Numbers helpers do.
```

- [ ] **Step 2: `AGENTS.md` and `README.md`**

`AGENTS.md`:
- In "Architecture in one breath", add `words (shared word lists)` to the platform list.
- Add this row to the Commands table:

```md
| Rebuild the word list (network; output is committed) | `npm run words` |
```

`README.md`: add this row to the Games table:

```md
| Letters & Numbers | Longest word from nine letters, hit a target with six numbers, solve a conundrum, 30 seconds each. |
```

Then change the "More are on the way" line so it no longer lists Letters & Numbers.

- [ ] **Step 3: Spec amendments**

In `docs/specs/2026-09-27-tinkster-v1-design.md`:

- **§7.2 layout:**
  - Change `scripts/build-words.ts` to `scripts/build-words.mjs`.
  - Under `lib/platform/`, change the `words/` line to `words/  word-list reader, the committed English lists (en.txt, en-conundrums.txt) and their URLs`.
  - Drop `words/` from the `static/` line.
- **§7.3:** change the `timer` line of `GameContext` to
  `timer(ms: number, onExpire: () => void, elapsedMs?: number): PausableTimer; // tied to ctx.paused; elapsedMs resumes part-way`.
- **§8.2 Conundrum:** add "Wrong guesses are refused ("Not the word") and play continues until the clock runs out."
- **§9 pipeline:**
  - SCOWL is pinned to 2020.12.07, the last release that ships the sized lists, and its sha256 is checked.
  - The script is `scripts/build-words.mjs`.
  - Conundrum answers come from sizes ≤ 50, and their one-anagram rule is checked against the list before the blocklist.
  - The output goes to `src/lib/platform/words/` (`en.txt`, `en-conundrums.txt`, `en.manifest.json`, `LICENSE-SCOWL.txt`). Vite content-hashes it at build time, replacing `static/words/en.<hash>.txt`.
  - The curated lists name every form; nothing is expanded automatically.

- [ ] **Step 4: `docs/HANDOFF.md`**

- **Header and §4:** Plan 1 is merged (PR #1, squash `e7adab1`) and live at `https://amirna2.github.io/tinkster/`. Plan 2 is on `feat/letters-and-numbers`.
- **§5:** add the Plan 2 amendments from Step 3, D1–D17 in short form, and point to this plan's "Decisions" table.
- **§6:** mark Plan 2 as implemented and pending the author's merge. Next comes Plan 3 (Snake).

The controller appends the Plan 2 execution record (§12, in §11's format) after the final review. The implementer of this task doesn't write it.

- [ ] **Step 5: Commit**

```bash
npm run format
git add docs AGENTS.md README.md
git commit -m "docs: document Letters & Numbers, word lists and workers

Assisted-by: Claude Code (<model>)"
```

---

## Final verification (after Task 11)

- [ ] `npm test && npm run check && npm run lint && npm run test:e2e && npm run build && npm run size && npm run test:visual`: all green.
- [ ] `git diff --stat origin/main -- src/lib/platform` shows only these files:
  - Task 1's timer and strip files
  - `words/*`
  - `ui/Burst.svelte`
  - `registry.ts`
- [ ] Play a mini match on a phone over the LAN (`npm run build && npm run preview -- --host`).
- [ ] Open the PR (the author merges). Put the curated-list review and the six PNGs under **Test Not Performed**.

## Execution notes (subagent-driven)

Reuse HANDOFF §10 as the checklist, with these differences:

- **Workspace:**
  - A worktree for `feat/letters-and-numbers` off `origin/main`.
  - SDD workspace: `sdd-workspace docs/plans/2026-09-27-plan-2-letters-and-numbers.md`.
- **Pre-flight conflict scan.** Shared surfaces:

  | Surface | Tasks |
  |---|---|
  | `round.ts` `Action` union | 4 → 5, 6, 8 |
  | `board.ts` | 4 → 6, 8 |
  | `words/index.ts` | 2 → 3, 4, 7, 9 |
  | `words.test.ts` | 2 → 3 |
  | `labels.ts` | 6 → 8, 9 |
  | `solver.ts` protocol | 7 → `dictionary.ts` |
  | `e2e/helpers.ts` | 9 → 10 |
  | `registry.ts` | 8 |
  | `package.json` scripts | 3 |

- **Models:**

  | Tier | Use it for |
  |---|---|
  | `haiku` | Transcription tasks with complete code: 2, 5 |
  | `sonnet` | 1, 4, 6, 7, 9, 10, 11, and every task reviewer |
  | `opus` | Task 3 (the curation needs judgment on slurs) and Task 8 (the largest integration). Also the final whole-branch review. |

  Always pass `model` explicitly.
- **Hard stops:**
  - Task 3, Step 3: after curation, the controller reads both lists before the commit, and the author reviews them in the PR.
  - Task 10, Step 6: the author looks at the PNGs.
  - Pushing and opening the PR: ask first.
- **Known risks:**
  - The Vite worker format (Task 7, Step 5).
  - `page.clock` with rAF (Task 9, Step 3).
  - The seed-dependent e2e draws (Task 9, Step 3).
  - Playwright resolving `$lib` (the Global Constraints rule).
  - `?url` assets reaching the service worker's `build` list (Task 8, Step 8, and the offline gate in Task 10).
