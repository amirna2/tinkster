# tinkster v1: design spec

- **Date:** 2026-09-27
- **Status:** Draft, pending author review
- **Mockups:** [`mockups/`](mockups/): `home-layout-v2.html` (home layout "H1"), `visual-style-bw.html` (chosen visual style "BW+1"), `game-frame.html` (shared game frame + end card)

## 1. Summary

tinkster is a mobile-first website of short, single-player games (2–15 minutes) for the moments when you're stuck waiting: a checkout line, a waiting room. It is a static, offline-capable web app with **no accounts, no tracking, no ads and no network calls after the first load**. It is open source (MIT) and deliberately built as a high-quality showcase of AI-assisted software development.

v1 delivers **the foundation** (home, game frame, game registry, shared platform services, quality gates, delivery) plus **three starter games** chosen to exercise different parts of the foundation.

## 2. Goals and non-goals

### Goals
- Get from opening the site to playing in one tap.
- Adding a game means adding one folder under `src/lib/games/` and one line in the registry, with no changes to the platform code.
- A crafted, consistent look and feel: "simple, not simplistic."
- Works fully offline after the first visit; installable to the home screen.
- Quality enforced by CI, not by reviewer vigilance.

### Non-goals (v1)
- Accounts, a backend, leaderboards, multiplayer.
- A daily puzzle, streaks, statistics, history, share buttons.
- Languages other than English (the design keeps the word list swappable per language).
- Chess, or anything trademarked (see §3.3).

## 3. Product decisions

### 3.1 Audience
The author and their family first, publicly hosted and open source. There is no growth or engagement machinery.

### 3.2 "Play and forget": what is stored
Only the following is persisted, in `localStorage` on the device:

| Key | Content | Lifetime |
|---|---|---|
| resume slot, one per game | JSON snapshot of an in-progress game + progress label + `savedAt` + `saveVersion` | deleted when that game ends (win, lose, or restart) |
| preferences | sound on/off; each game's last-used options (e.g. difficulty) | until the browser's site data is cleared |

Nothing else: no scores, no history, no identifiers. Nothing ever leaves the device.

### 3.3 Naming
- Product name: **tinkster** (a tinkerer fiddling with small puzzles). Wordmark: `tink` in ink + *`ster`* in accent italic.
- Game names avoid trademarks (Countdown, Spelling Bee, Wordle, Mastermind, Space Invaders, Frogger, Breakout):

| Game | Inspired by | Status |
|---|---|---|
| Break the Code | Mastermind / Bulls & Cows | v1 |
| Letters & Numbers | *Des Chiffres et des Lettres* / Countdown | v1 |
| Snake | Snake | v1 |
| Honeycomb | Spelling Bee | backlog |
| Emojigrams | Nonograms | backlog |
| Brick Breaker | Breakout | backlog |
| Alien Wave | Space Invaders | backlog |
| Road Hop | Frogger | backlog |

- Domain: not yet registered. Available at time of writing: `tinkster.games`, `tinkster.app`, `tinkster.io`, `playtinkster.com` (`tinkster.com` is parked for sale). v1 ships at `https://<user>.github.io/tinkster/`.

## 4. Scope and success criteria

v1 ships the platform plus Break the Code, Letters & Numbers and Snake. Each starter game exercises a different part of the platform:

| Game | Kind | Exercises |
|---|---|---|
| Break the Code | turn-based grid | state reducers, keypad input, resume |
| Letters & Numbers | timed, multi-round | timers, word list, Web Worker solver, rounds within a match |
| Snake | real-time canvas | fixed-step loop, swipe input, pause/resume, performance |

**v1 is done when:**
1. All three games are playable end to end on iOS Safari and Android Chrome, installed and in the browser, online and offline.
2. All CI gates in §10 pass on `main`.
3. **Extensibility acceptance test:** Snake is implemented last, working only from `docs/adding-a-game.md`, with **zero changes under `src/lib/platform/` or `src/routes/`**. If the platform has to change, the doc or the contract is wrong; fix it and redo the check.

## 5. UX

### 5.1 Home ("H1: rich grid")
- Header: wordmark (left), **Surprise me** pill (right). Surprise me opens a uniformly random registered game.
- **Resume card** (only if any resume slot exists): shows the most recently saved game (`savedAt`) with the progress label stored in its slot (e.g. "guess 4 of 8"; the frame computes it with the game's `progressLabel()` at save time, so home never loads game code) and a Resume button. Other games with saves resume when opened from their tile.
- Category sections in fixed order: **Words & numbers**, **Logic**, **Arcade**. Within a section, games appear in registry order.
- Two-column tiles, each showing: title, one-line pitch, a duration badge (`minutes` from the registry, e.g. "2–10m"), the game's line icon, and the category's halftone texture (dots = words, lines = logic, grid = arcade).

### 5.2 Game frame (shared by every game)
- **Top bar:** `←` (home; pauses and saves), title, `?` (rules sheet), `⋯` (menu: Restart, Sound on/off).
- **Meta line** under the bar: two short status strings provided by the game (e.g. "Guess 4 of 8" / "4 digits · no repeats").
- **Play area:** the game's view. Controls go in the bottom third (thumb zone).
- **Start sheet:** games with options (difficulty, round type) show them before play begins, defaulting to the last-used options.
- **Timed games:** a red timer strip under the bar drains in real time.
- **Pause:** the frame pauses the game when the user taps `←`, when the page becomes hidden (`visibilitychange`), or when the rules sheet or menu is open. Timed and real-time games resume with a 3-2-1 countdown.
- **Browser back** behaves like `←`.

### 5.3 End card (shared)
Overlay card with a stamped headline (e.g. *Cracked!*, *Locked out*, *Game over*), a result line, an optional reveal (the answer / best solution), then **Play again** (accent) and **Home**. Opening the end card clears that game's resume slot.

### 5.4 Error states
- An unreadable save (corrupt JSON, or `saveVersion` mismatch) is discarded silently and the game starts fresh.
- A game that throws during render or update is caught by the frame's error boundary (`<svelte:boundary>`), which shows "Something broke, start over?" and clears that game's save.

## 6. Visual system ("BW+1: ink with one red accent")

### 6.1 Tokens (the only colors used in code)

| Token | Light | Dark |
|---|---|---|
| `--paper` | `#f7f5f0` | `#121212` |
| `--ink` | `#161514` | `#ecebe6` |
| `--accent` | vermilion (mockup `#d8432b`), final value tuned to meet WCAG AA 4.5:1 for white text on accent and accent on paper | lighter vermilion (mockup `#ff6a4d`), tuned the same way |

- The theme follows `prefers-color-scheme`; there is no manual toggle.
- Colored emoji appear only in game content where the emoji is the point (the Emojigrams reveal). The UI never uses emoji.
- Game state never relies on color alone: solid, hatched and outlined forms carry the meaning, and color reinforces it.

### 6.2 Type
- Display: **Fraunces**. UI: **Inter**. Both OFL, self-hosted, Latin subsets, woff2, ≤ 80 KB total.
- Tabular numerals for timers and scores.

### 6.3 Components and ornament
- Ink outlines (1.5px), hard offset shadows (`3px 3px 0 var(--ink)`), 12px radii.
- One custom line-art SVG icon per game (2.2px stroke, ink, one accent detail).

### 6.4 Motion
- Durations 120–250 ms, spring-based where physical.
- Buttons "press into the paper": the offset shadow collapses on press.
- Staggered reveal of guess feedback, a stamp "slam" with slight overshoot on wins, a red ink particle burst on scoring moments, a gentle shake on invalid input.
- `prefers-reduced-motion: reduce` replaces all of this with plain cross-fades.

### 6.5 Sound and haptics
- Sounds are synthesized with Web Audio, with no audio assets: tick, pop, stamp thud, failure tone. **Sound is off by default.**
- Haptics use `navigator.vibrate` where available (Android). They do nothing silently where unsupported (iOS Safari).

### 6.6 Accessibility and desktop
- Tap targets ≥ 44px.
- Turn-based games expose screen-reader labels (e.g. each guess row reads "guess 2: 5 2 6 4, 2 right place, 1 wrong place").
- On desktop: a centered phone-width column with full keyboard support. Digits and letters type, Backspace deletes, Enter submits, arrow keys and WASD steer Snake, Escape opens the menu.

## 7. Architecture

### 7.1 Stack
- **SvelteKit** (Svelte 5, runes) with `@sveltejs/adapter-static`; every route is prerendered.
- **TypeScript**, strict.
- **Canvas 2D** for real-time games. No game engine.
- SvelteKit's `$service-worker` for offline use; a web app manifest for installation.
- Dev-only tooling: Vitest, fast-check, Playwright, `@axe-core/playwright`, Biome, `svelte-check`.
- No runtime dependencies beyond Svelte/SvelteKit output. No UI framework besides Svelte, no CSS framework, no state library.

### 7.2 Layout

```
src/
  routes/
    +layout.svelte              app shell: tokens, fonts, theme
    +page.svelte                home (built from the registry)
    play/[game]/+page.svelte    mounts GameFrame around the requested game
    play/[game]/+page.ts        entries() from the registry for prerendering
  service-worker.ts             precache build + static assets, cache-first
  lib/platform/
    registry.ts                 GameDefinition[]: the one-line-per-game list
    types.ts                    GameDefinition, GameProps, GameContext, GameResult
    frame/                      GameFrame, TopBar, StartSheet, RulesSheet, Menu, EndCard, ErrorBoundary
    save.ts                     resume slots + preferences (versioned localStorage)
    rng.ts                      seeded PRNG (e.g. sfc32) + helpers (int, pick, shuffle)
    loop.ts                     fixed-timestep rAF loop, honors ctx.paused
    timer.ts                    pausable countdown timer
    input/                      swipe (with buffered turns), keypad, keyboard mapping
    feedback.ts                 sound synth + haptics, gated by preferences
    words/                      word list loader (lazy, shared by word games)
    ui/                         Button, Tile, Icon, Stamp, texture/tokens CSS
  lib/games/<id>/
    index.ts                    GameDefinition (metadata + lazy loader)
    rules.ts                    pure state + reducers + scoring (no DOM, no timers)
    rules.test.ts               unit + property tests
    View.svelte                 board + controls; talks to the platform only via GameContext
    Rules.svelte                content of the rules sheet
    icon.svg
scripts/
  build-words.ts                reproducible word list build (§9)
static/
  fonts/  words/  icons/  manifest.webmanifest
docs/
  adding-a-game.md  specs/  plans/
```

### 7.3 The game contract

```ts
type Category = 'words' | 'logic' | 'arcade';

interface GameDefinition<S = unknown, O = unknown> {
  id: string;                          // url slug, e.g. 'break-the-code'
  title: string;
  pitch: string;                       // one line for the home tile
  category: Category;
  minutes: [min: number, max: number];
  icon: string;                        // imported SVG
  saveVersion: number;                 // bump when S changes shape
  options?: OptionSpec<O>;             // renders the start sheet; omitted → no sheet
  load(): Promise<GameModule<S, O>>;   // dynamic import → code-split
}

interface GameModule<S, O> {
  View: Component<GameProps<S, O>>;
  Rules: Component;
  progressLabel(state: S): string;     // for the home resume card
}

interface GameProps<S, O> {
  options: O;
  saved: S | null;                     // resume snapshot, if any
  ctx: GameContext<S>;
}

interface GameContext<S> {
  save(state: S): void;                // debounced write to the resume slot
  finish(result: GameResult): void;    // clears the slot, shows EndCard
  setMeta(left: string, right: string): void;
  readonly paused: boolean;            // reactive; owned by the frame
  rng: Rng;                            // seeded; seed comes from the frame
  feedback: Feedback;                  // sound(name), haptic(pattern)
  timer(ms: number): PausableTimer;    // tied to ctx.paused
}

interface GameResult {
  stamp: string;                       // 'Cracked!', 'Game over'
  headline: string;                    // '5 guesses', 'Score 42'
  detail?: string;
  reveal?: Snippet;                    // answer / best solution
}
```

**Rules:**
- A game imports only from `$lib/platform` and its own folder. Games never import from each other.
- `rules.ts` is pure: `(state, action) → state`. It never touches the DOM, timers, `Math.random`, or `Date`; randomness comes in through `Rng`.
- State `S` must be JSON-serializable, so saving and resuming works for free.

### 7.4 Flow
Home → `/play/<id>` → frame reads the resume slot → if there's no save and the game has options, show the start sheet → `load()` → mount the View with `{options, saved, ctx}` → the View calls `ctx.save()` after each state change → `ctx.finish(result)` → EndCard → **Play again** (remount with a fresh state and the same options) or **Home**.

### 7.5 Offline and install
- All routes are prerendered.
- The service worker precaches the build output, fonts, icons and the word list, then serves cache-first with a versioned cache name. A new deploy activates on the next launch; there's no "update available" prompt.
- `manifest.webmanifest`: standalone display, theme colors from the tokens, maskable icons.

### 7.6 Hosting constraints (GitHub Pages)
- `kit.paths.base = '/tinkster'` (empty if a custom domain is added later). The service worker scope follows it.
- There are no custom response headers, so the Content-Security-Policy is delivered as a `<meta>` tag via SvelteKit `kit.csp` in hash mode: `default-src 'self'`; no third-party origins. `frame-ancestors` cannot be enforced via `<meta>`, which is an accepted limitation.

### 7.7 Performance budgets
- Home route: JS + CSS ≤ 100 KB gzipped (fonts excluded, budgeted in §6.2).
- Each game chunk: ≤ 50 KB gzipped, excluding the word list.
- Word list: fetched lazily on the first word game, then cached by the service worker.
- Snake holds 60 fps on a mid-range Android phone. The game logic steps at a fixed rate; only rendering is tied to the display refresh rate.

## 8. Starter games

### 8.1 Break the Code
- **Secret:** digits 0–9. Leading zero allowed.

  | Difficulty | Length | Repeats | Guesses |
  |---|---|---|---|
  | Easy | 3 | no | 8 |
  | Normal (default) | 4 | no | 8 |
  | Hard | 5 | yes | 10 |

- **Feedback (pegs only):** *hits* = right digit, right position (solid accent peg); *nears* = right digit, wrong position (hollow peg). With repeats, standard Mastermind counting applies: `nears = Σ_d min(countSecret(d), countGuess(d)) − hits`. Pegs are shown in a fixed order (hits first) and never tied to positions.
- **Input:** on-screen keypad 0–9, ⌫, Enter. A guess that's the wrong length, or has a repeat where repeats aren't allowed, is rejected with a shake and a one-line reason.
- **End:** win → *Cracked!* "N guesses"; out of guesses → *Locked out*. Both reveal the code.
- **Resume label:** "guess K of M".

### 8.2 Letters & Numbers
- **Formats (start sheet):** Letters round · Numbers round · Conundrum · **Mini match (default)** = Letters, Letters, Numbers, Letters, Numbers, Conundrum (about 6 minutes).
- **Timer:** 30 s per round, pausable (§5.2).
- **Letters round:**
  - The player taps Vowel or Consonant until 9 letters are drawn. At least 3 vowels and at least 4 consonants; the buttons disable when a limit would be broken.
  - Letters are drawn without replacement from weighted vowel and consonant piles. The distribution is documented in `rules.ts` with its source; piles reset each round.
  - Word entry: tap tiles to build the word, ⌫ to remove the last letter, ↻ to shuffle tiles, **Lock in** to submit. When time runs out, the current word is submitted automatically.
  - Score: the word's length if it is in the list and uses only drawn letters (each at most as often as drawn); 18 for a 9-letter word; 0 otherwise.
  - Minimum word length is 3.
- **Numbers round:**
  - The player chooses how many large numbers (0–4). Large = {25, 50, 75, 100}; small = two each of 1–10. 6 tiles are drawn; the target is uniform in 101–999.
  - Input: tap tile → operator (+ − × ÷) → tile; the result replaces both tiles as a new tile. Only positive-integer results are allowed: subtraction must be positive, division must be exact. Undo steps back one operation; Reset restores the original 6 tiles.
  - The player's value is whichever current tile is closest to the target; they may Lock in at any time. When time runs out, the closest value is taken.
  - Score: exact 10; 1–5 away 7; 6–10 away 5; else 0.
- **Conundrum:**
  - A scrambled 9-letter word that has exactly one anagram in the list, is not flagged never-suggest (§9), and whose scramble is not itself a word.
  - The player types or taps the answer. 10 points if correct within 30 s.
- **"Dictionary corner":** after each round, show the best possible answer next to the player's: up to 3 longest valid words for Letters, one exact solution (or the closest) for Numbers, the answer for Conundrum.
  - Solvers run in a **Web Worker**, started as soon as the round's letters or numbers are known, so results are ready at the buzzer.
  - The Numbers solver searches exhaustively over the 6 tiles and returns a solution that uses as few operations as possible.
- **Match result:** *yours / best possible*. The end card shows each round's answer next to the best one.
- **Resume label:** "round K of 6" / "letters round".

### 8.3 Snake
- **Grid:** sized to the play area, with square cells and a cell count chosen so each cell is ≥ 16px (target around 16–20 cells on the short side). Walls are lethal. One life.
- **Speed:** step interval starts at 140 ms and drops 4 ms per food eaten, down to a minimum of 70 ms.
- **Input:** swipe anywhere on the screen (except the top bar) or use the arrow keys/WASD. A buffer holds up to 2 queued turns; a turn that reverses into the snake's neck is ignored.
- **Food:** placed on a random free cell via `ctx.rng`. Score = food eaten.
- **Game feel:** red ink burst on eating; short screen shake and a failure tone on death.
- **Pause and resume:** the snapshot (body, direction, food, score, step interval) is saved when the game pauses. Resuming starts with a 3-2-1 countdown.
- **End:** *Game over*, "Score N". Filling the board ends with *Perfect!*.
- **Resume label:** "score N".

## 9. Word list pipeline
- **Source:** SCOWL (via the `wordlist.aspell.net` distribution), American + British, sizes 10–70, pinned by version. License terms are reproduced in `THIRD_PARTY.md`.
- **`scripts/build-words.ts`** (Node, run manually, output committed):
  1. Take SCOWL entries; keep lowercase `a–z` only. That drops proper nouns, abbreviations, apostrophes, hyphens and diacritics.
  2. Keep lengths 3–15.
  3. Remove every word on `scripts/wordlist/blocklist.txt` (slurs). **Removed entirely.**
  4. Mark every word on `scripts/wordlist/never-suggest.txt` (vulgar but legitimate words). These are **accepted when the player enters them**, but never shown by a solver and never chosen as a conundrum.
  5. Derive `conundrums.txt`: 9-letter words with a unique anagram signature, none never-suggest.
  6. Emit `static/words/en.<hash>.txt` (one word per line, never-suggest words prefixed with `!`), `static/words/en-conundrums.<hash>.txt`, and a manifest recording the source version and counts.
- The blocklists are curated in-repo, seeded from an openly licensed list (e.g. LDNOOBW, CC BY 4.0) and reviewed by hand. Their license is recorded in `THIRD_PARTY.md`.
- The runtime loader builds a `Set` for lookup and a sorted-letters index for anagram and solver queries.

## 10. Quality gates (CI on every PR)

| Gate | Tool | What it proves |
|---|---|---|
| Types | `svelte-check` (strict TS) | no type errors anywhere, `.svelte` included |
| Lint and format | Biome | consistent style, common bug patterns |
| Rules | Vitest + fast-check | each `rules.ts` behaves correctly; invariants hold for random inputs |
| Registry contract | Vitest | every registry entry has valid metadata, an icon, a working `load()`, a `Rules` component and a `rules.test.ts` |
| Word list | Vitest | no blocklisted word is present; the conundrum list is valid; manifest counts match |
| End-to-end | Playwright (iPhone SE and Pixel 7 viewports) | per game: start → deterministic win via seed → end card → play again |
| Resume | Playwright | leave mid-game → resume card → identical state |
| Offline | Playwright | load, `setOffline(true)`, reload → home and every game work |
| Privacy | Playwright | zero requests to any origin other than the site's own |
| Accessibility | `@axe-core/playwright` | no serious or critical violations on home, each game and the end card |
| Visual regression | Playwright screenshots | home + each game frame, light and dark; baselines generated in the pinned Playwright Linux container |
| Size budget | script over build output | §7.7 budgets |

**Required property tests (minimum):**
- Break the Code: `0 ≤ hits + nears ≤ length`; `score(s, s) = all hits`; the score is symmetric in secret and guess.
- Numbers: any solver answer evaluates to its claimed value, uses each tile at most once, and every intermediate value is a positive integer. When the solver reports "no exact solution", brute-force confirmation agrees on small cases.
- Letters: every solver word is in the list, uses only drawn letters, and is not never-suggest.
- Conundrum: every entry's anagram signature is unique in the list.
- Rng: same seed → same sequence; `int(a, b)` stays within bounds.

**Test seed hook:** `?seed=<n>` is honored only when built with `PUBLIC_TEST_HOOKS=1` (CI e2e build). Production builds ignore it.

## 11. Delivery
- **Hosting:** GitHub Pages, deployed by GitHub Actions (`actions/upload-pages-artifact` + `actions/deploy-pages`) on every push to `main` that passes all gates.
- **Phone testing before merge:** `npm run dev -- --host` on the local network. There are no PR preview deploys in v1.
- **Package manager:** npm with a committed lockfile. Node LTS pinned via `.nvmrc` and `engines`.

## 12. Repository practices
- `README.md`: what it is, screenshots, the privacy promise, how to run, how to add a game.
- `docs/adding-a-game.md`: the step-by-step contract guide (validated by the §4 acceptance test).
- `AGENTS.md`: architecture summary, conventions and the add-a-game checklist for AI coding agents. (`CLAUDE.md` stays local-only, per the author's git workflow.)
- `docs/specs/` and `docs/plans/`: the spec → plan → PR trail for v1 and each future game.
- Feature branches + PRs only; Conventional Commits; `Assisted-by:` attribution trailer; `main` is protected and only the author merges.
- Licensing: MIT for code; `THIRD_PARTY.md` for SCOWL, the blocklist source, Fraunces and Inter (OFL).

## 13. Open items
- Register a domain (`tinkster.games` or `tinkster.app`) before any public announcement; switching sets `paths.base` to `''`.
- Final accent hex values for light and dark (§6.1), picked during implementation so axe's color-contrast check passes in both themes.
- Backlog games each get their own spec: Honeycomb, Emojigrams (build-time emoji-to-grid with a uniqueness solver, open-licensed emoji set), Brick Breaker, Alien Wave, Road Hop.
