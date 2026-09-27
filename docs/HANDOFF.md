# tinkster: session handoff

- **Last updated:** 2026-09-27 (end of session 1: brainstorm → spec → Plan 1)
- **Status:** Design approved, Plan 1 written. **No implementation code exists yet.**
- **Next action:** the author picks an execution mode for Plan 1 (see §6), then Task 1 starts.

## 1. How to resume (read in this order)

1. This file.
2. `docs/specs/2026-09-27-tinkster-v1-design.md`, the approved design and the source of truth.
3. `docs/plans/2026-09-27-plan-1-foundation.md`, 17 tasks with full code. Read "Global Constraints" and "Branch setup" before Task 1.
4. `docs/specs/mockups/*.html`: open in a browser to see the approved look.
   - `home-layout-v2.html`: layout "H1". Its colors are from an earlier round; use BW+1.
   - `visual-style-bw.html`: style "BW+1", the middle phone.
   - `game-frame.html`: shared frame + end card.
5. Check repo state: `cd ~/dev/tinkster && git status && git branch -a && git log --oneline --all`.

## 2. What tinkster is

A mobile-first website of short single-player games (2–15 min) for the moments when you're stuck waiting (checkout line, waiting room). Static, offline-capable PWA. **No accounts, no tracking, no ads, no network calls after first load.** Open source (MIT). Built deliberately as a **showcase of high-quality AI-assisted development**, so process artifacts (spec → plan → reviewed PRs, CI gates) are part of the product.

Guiding bar from the author: **"simple, not simplistic."** Also: "play and forget."

## 3. Decisions made (with reasons)

### Product
| Decision | Reason / note |
|---|---|
| Audience: author + family first, publicly hosted, open source | Not a growth product; no engagement machinery |
| No accounts/stats/history/streaks/share buttons | "No strings attached, play and forget" |
| Stored on device: one resume slot per game (cleared on game end) + prefs (sound on/off, each game's last-used options) | Survive being called to the cashier mid-game. The last-used options were added during spec writing and are flagged to the author |
| **No chess** of any kind | Author: people who want chess know where to find it |
| English only in v1; word list per-locale file | Possible French *Chiffres et Lettres* later |
| Trademark-free game names | Open-source project hygiene |
| Sound **off** by default; haptics on where supported | Used in waiting rooms |

### Name
- **tinkster** (a tinkerer fiddling with small puzzles). Wordmark: `tink` ink + *`ster`* red italic.
- Rejected, after availability checks:
  - **flashfun**: "Flash games" is ad-portal territory (Poki, CrazyGames).
  - **pocketgame**: taken everywhere; a near-identical App Store app, Pocket Gamer, and Meta's "Pocket" (July 2026).
  - **bittle**: dominated by Petoi's Bittle robot dog; most TLDs taken.
- tinkster checks (2026-09-27): no products or companies found, only personal usernames.

  | Domain | Status |
  |---|---|
  | `tinkster.com` | parked at Afternic (for sale) |
  | `tinkster.io`, `playtinkster.com` | unregistered |
  | `.games`, `.app`, `.fun` | no DNS records (likely free) |

  **Not registered yet**; the author will register before any public announcement.

### Games
| v1 (Plan) | Kind | Notes |
|---|---|---|
| Break the Code (Plan 1) | turn-based logic | Mastermind / Bulls & Cows with digits. **Pegs-only feedback** (not Wordle-style per-tile). Easy 3 digits/8 guesses, Normal 4/8 (default), Hard 5 with repeats/10 |
| Letters & Numbers (Plan 2) | timed word/number | English adaptation of *Des Chiffres et des Lettres* (= UK Countdown). Letters, Numbers, Conundrum rounds; mini match L,L,N,L,N,C ≈ 6 min; solver "dictionary corner" in a Web Worker; score shown as yours / best possible |
| Snake (Plan 3) | real-time arcade | Swipe, 2-turn buffer, walls lethal, speed-up, 3-2-1 resume |

Backlog, one spec each later:
- **Honeycomb:** Spelling Bee-style.
- **Emojigrams:** nonograms from emoji. Build-time downscale plus a uniqueness solver, from an open emoji set; the solved puzzle reveals the full-color emoji, the only burst of color on an ink site.
- **Brick Breaker, Alien Wave, Road Hop** (the Breakout, Space Invaders and Frogger ideas).

### UX / visual (all chosen via the visual companion)
- **Home "H1":** a rich two-column tile grid grouped by category (Words & numbers → Logic → Arcade). Each tile has a title, one-line pitch, duration badge, line icon and category halftone (dots/lines/grid). Header: wordmark + "Surprise me". A resume card appears when a game is in progress.
  - Chosen over a time-filter list and a big-card feed. The author hesitated between A (grid) and C (big cards); H1 merges them.
- **Style "BW+1":** black ink on cream paper + **one vermilion accent**, serif display. Ink outlines, hard offset shadows. Dark mode = chalk on slate.
  - The author first leaned to a colored "Paper" style, then asked for black and white.
  - State is shown by fill/hatch/outline, never color alone.
- **Game frame:** shared by every game.
  - Top bar: ← (home + autosave), title, ? (rules), ⋯ (menu: restart, sound).
  - Meta line under the bar. Red timer strip for timed games. Controls in the bottom third.
  - Shared end card: red stamp, result, reveal, Play again / Home.
  - Author reaction: "very clean design, good amount of space."

### Tech
| Decision | Reason |
|---|---|
| SvelteKit 2 static (adapter-static, all prerendered) + Svelte 5 runes + TypeScript | Built-in motion primitives for game feel, tiny output, one dependency for routing/prerender/service worker. The author explicitly asked for the *best* tech for quality with a minimal stack, not the most learnable |
| Canvas 2D for arcade; no game engine | Not needed for these games |
| Dev-only tooling: Vitest + fast-check, Playwright + axe, Biome, svelte-check | Quality gates that check AI-written code |
| **GitHub Pages** (not Cloudflare Pages) | Author preference: everything in GitHub. Tradeoffs accepted: no PR preview deploys (use `npm run dev -- --host` on LAN), CSP via `<meta>`, base path `/tinkster` |
| **TypeScript pinned `^6`** | TS 7.0.2 is `latest` on npm, but the `svelte-check@4` and `@sveltejs/kit@2` peer ranges stop at `^6` |
| Plans split into 3 | Plan 1 foundation + Break the Code; Plan 2 Letters & Numbers + word list; Plan 3 Snake, built **only** from `docs/adding-a-game.md` as the extensibility acceptance test (zero diff under `src/lib/platform/` and `src/routes/` except the registry line) |

## 4. Current repository state

- Path: `~/dev/tinkster`. Local git repo, **no remote yet**, **`main` has no commits** (unborn).
- Branch `docs/v1-design` (checked out). Commits:
  - `b041262` spec + mockups
  - `21b615c` Plan 1 + spec alignment
  - the commit adding this handoff
- `.gitignore` already covers `.superpowers/`, `node_modules/`, `.svelte-kit/`, `build/`, test output, `CLAUDE.md`, `AI_DEVELOPER.md`, `CONTEXT.md`.
- `.superpowers/brainstorm/37841-1790539787/content/` (gitignored) holds every mockup round. The visual companion server is **stopped**. To reuse it: run `…/superpowers/<ver>/skills/brainstorming/scripts/start-server.sh --project-dir ~/dev/tinkster --open`.

## 5. Spec amendments made after the author approved it

All are committed and were reported to the author:
1. Font budget 80 KB → **110 KB** (measured Fontsource Latin files: Fraunces wght 36.6 KB + Fraunces 700 italic 23 KB + Inter wght 48.3 KB).
2. Accent colors fixed for WCAG AA:
   - light `#c93c25` (white text on it 5.05:1; on paper 4.64:1)
   - dark `#ff6a4d`
   - new token `--on-accent`: `#fff` light / `#121212` dark
3. Contract changes:
   - `pace: 'turn-based' | 'timed' | 'realtime'` added to `GameDefinition`; it drives the 3-2-1 resume countdown.
   - `Options = Record<string,string>` and an `OptionField` type.
   - `ctx.timer(ms, onExpire)`.
4. The rules-sheet component is named `HowToPlay.svelte`, to avoid a macOS case clash with `rules.ts`. It's exported as `Rules` in the module.
5. Deferred: the "red ink burst on scoring moments" is not in Plan 1. The stamp covers Break the Code; the burst comes with Snake and Letters & Numbers.

## 6. Next steps

1. **Waiting on the author:** choose Plan 1 execution mode. Offered: **(1) subagent-driven (recommended)** via `superpowers:subagent-driven-development`, or (2) inline via `superpowers:executing-plans`.
2. Branch setup (from the plan): `main` is unborn, so `git checkout docs/v1-design && git checkout -b feat/v1-foundation`.
3. Execute Tasks 1–17. Built-in stop points:
   - **Task 15:** visual baselines need **Docker** (availability on the author's Mac is unknown), and a human must look at the six screenshots before they're committed.
   - **Task 16:** **ask the author** before `gh repo create`, pushing, or enabling Pages. Confirm the repo name `tinkster`, visibility (public) and the account.
4. After Plan 1 lands: write Plan 2 (Letters & Numbers + SCOWL word list pipeline) and Plan 3 (Snake) against the real code.
5. Before public announcement: register a domain (`tinkster.games` or `tinkster.app`). Then set `BASE_PATH=''`.

## 7. Conventions and working agreements

**Git** (the author's `git-workflow` skill; hard rules):
- Feature branches `<type>/<topic>`; never commit to `main`.
- Conventional Commits.
- End every commit with `Assisted-by: Claude Code (<model>)`. **No `Co-Authored-By`.**
- Never commit `CLAUDE.md` / `AI_DEVELOPER.md` / `CONTEXT.md`. Agent instructions live in a committed **`AGENTS.md`** instead.
- PR body template: Description / Test Performed / Test Not Performed / Assisted-by. **Never merge**; the author merges.

**Collaboration:**
- The author is a senior engineer (30+ years). Talk peer to peer and don't explain basics.
- The author's self-described gap is web UI/UX, so Claude owns design direction proactively and shows mockups via the visual companion rather than describing them.
- Present recommendations, not surveys.

**Brainstorming artifacts location:** specs in `docs/specs/`, plans in `docs/plans/`. The project convention overrides the skill default `docs/superpowers/...`.

## 8. Environment facts (checked 2026-09-27)

- macOS (Apple Silicon), Node **22.16.0**, npm 10.9.2. `.nvmrc` = 22.

| Package | Latest on npm |
|---|---|
| svelte | 5.57.1 |
| @sveltejs/kit | 2.70.3 |
| @sveltejs/adapter-static | 3.0.10 |
| @sveltejs/vite-plugin-svelte | 7.3.1 |
| vite | 8.3.1 |
| vitest | 5.0.2 |
| fast-check | 4.10.2 |
| @playwright/test | 1.63.0 |
| @axe-core/playwright | 4.13.0 |
| @biomejs/biome | 2.5.14 |
| svelte-check | 4.7.6 |
| typescript | 7.0.2 (**use ^6**) |

- The Playwright Docker image tag must match the installed `@playwright/test` version (plan uses `v1.63.0-noble`).

## 9. Known risks flagged in the plan

Check these first if a step misbehaves:
- **Biome config keys** can shift between minors: run `npx biome migrate --write`.
- **Vite manifest location** for the size script: `.svelte-kit/output/client/.vite/manifest.json` is expected, with `build/.vite/` as the fallback. Adjust `MANIFESTS` if needed.
- **Service worker:**
  - GitHub Pages redirects `/tinkster` → `/tinkster/`, so cache keys drop trailing slashes, and redirected precache responses are re-wrapped. Otherwise navigations fail.
  - No `skipWaiting()`, by design: a new version activates on the next launch.
- **Offline e2e is Chromium-only** (skipped on the WebKit iPhone project).
- **Errors inside event handlers aren't caught by `<svelte:boundary>`.** Only render/effect errors are. The fixture's Crash button deliberately throws during render.
- **`svelte-check --fail-on-warnings`:** fix a11y warnings rather than suppressing them.
- **The registry contract test imports `.svelte` modules under Vitest's node environment.** If that fails, check the plugin/condition setup before weakening the test.
