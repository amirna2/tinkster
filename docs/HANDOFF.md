# tinkster: session handoff

- **Last updated:** 2026-09-27 (end of session 2: Plan 1 executed, reviewed, tested by the author)
- **Status:** **Plan 1 is implemented** on `feat/v1-foundation`. All 17 tasks, a whole-branch review, one fix wave and an audio follow-up are done, with all gates green. The author tested it on a Mac and a phone: "looks very good", about 2 minutes to crack the code, and fluid UX. The published repo and PR are recorded in §4.
- **Next action:** after the author merges the Plan 1 PR, write **Plan 2** (Letters & Numbers + word list) and **Plan 3** (Snake) against the real code (§6). §11 records what Plan 1 execution decided and deferred.

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

- Path: `~/dev/tinkster`. Remote: `github.com/amirna2/tinkster` (public). GitHub Pages builds from Actions.
- `main` was bootstrapped from the approved `docs/v1-design` head: spec, plan, mockups and handoff, with no code.
- `feat/v1-foundation` holds the Plan 1 implementation. It lives in the worktree `~/dev/tinkster/.worktrees/v1-foundation` (`.worktrees/` is gitignored) and is PR'd into `main`. The author merges.
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

1. **Done:** Plan 1, subagent-driven. See §11.
2. The author merges the Plan 1 PR. The first push to `main` deploys to `https://amirna2.github.io/tinkster/`.
3. On the live site (HTTPS), check what LAN testing couldn't:
   - offline after the first visit
   - install to home screen on iOS and Android
   - sound on an iPhone
   - the service worker updating after a second deploy
   - the deep link `/tinkster/play/break-the-code`
4. Write **Plan 2** (Letters & Numbers + SCOWL word list pipeline) against the real code. It is the first game to use `ctx.timer`.
5. Write **Plan 3** (Snake) from `docs/adding-a-game.md` alone. Acceptance: `git diff --stat main -- src/lib/platform src/routes` shows only `registry.ts`.
6. Before a public announcement, register a domain (`tinkster.games` or `tinkster.app`). Then set `BASE_PATH=''`.

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

## 10. Executing Plan 1 (subagent-driven): setup checklist for the resumed session

Do these in order **after** the author says to start.

1. **Load the skills.**
   - Invoke `superpowers:subagent-driven-development`. It will call for `superpowers:using-git-worktrees`.
   - Also follow the author's `git-workflow` skill for every commit and PR.
2. **Workspace isolation.**
   - The repo is a normal checkout at `~/dev/tinkster`, currently on `docs/v1-design` with a clean tree. No worktree exists.
   - The worktree skill asks for consent before creating one. **The author has not answered that yet, so ask.**
   - Recommended answer: yes. Prefer the native `EnterWorktree` tool (deferred; load it with ToolSearch).
   - Git fallback: first add `.worktrees/` to `.gitignore` and commit that on `docs/v1-design`. Then run `git worktree add .worktrees/v1-foundation -b feat/v1-foundation docs/v1-design`.
   - If the author declines, work in place: `git checkout -b feat/v1-foundation` (from `docs/v1-design`).
3. **Baseline.** There's no `package.json` yet, so there are no baseline tests. Task 1 creates the toolchain.
4. **SDD workspace and ledger.**
   - Scripts are in `~/.claude/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/subagent-driven-development/scripts/`: `sdd-workspace`, `task-brief`, `review-package`.
   - Run `sdd-workspace docs/plans/2026-09-27-plan-1-foundation.md`. It prints `<repo>/.superpowers/sdd/<plan-basename>/`, which is gitignored via `.superpowers/`.
   - The ledger is `<workspace>/progress.md`. Its first line must be `# SDD ledger — plan: docs/plans/2026-09-27-plan-1-foundation.md`.
   - **After any compaction, trust the ledger and `git log` over memory.** Tasks with a `Task N: complete` line are done; never re-dispatch them.
5. **Pre-flight conflict scan** (required by the skill before Task 1). Write a table to the ledger:
   - One row per pair of tasks that share a file or interface.
   - One row per task, checking self-consistency.

   Rule on anything found, as `Ruling: … — why — cost if wrong`. Known shared surfaces to check:

   | Surface | Touched by |
   |---|---|
   | `registry.ts` | Tasks 4 → 10 → 13 |
   | `package.json` scripts | Tasks 1, 10, 14, 15 |
   | `svelte.config.js` | Tasks 1 → 14 (SW files) → 15 (CSP) |
   | `src/app.html` | Tasks 1 → 14 |
   | `src/routes/+page.svelte` | Tasks 5 → 11 |
   | `e2e/home.spec.ts` | Tasks 11 → 13 |
   | `e2e/helpers.ts` | created in 13, used by 14 and 15 |
   | `fake-frames.ts` | created in Task 6 (Step 2), used by timer and loop tests |
   | `GameSession.discard()` | used by `GameFrame` (Task 10) |
6. **Model selection** (per the skill):
   - Tasks whose plan text contains complete code are transcription: cheapest tier (`haiku`) for mechanical single-file tasks (2, 3, 6, 7, 8, 12).
   - Standard tier (`sonnet`) as the floor for multi-file integration (1, 4, 5, 9, 10, 11, 13, 14, 15, 16, 17) and for all reviewers.
   - Final whole-branch review on the most capable model.
   - Always pass `model` explicitly.
7. **Hard stops during execution** (the only reasons to pause):
   - **Task 15, Step 6:** visual baselines need Docker, and a human must look at the 6 screenshots.
   - **Task 16, Step 5:** `gh repo create`, pushing and enabling Pages are publishing actions. Ask the author for the repo name, visibility and account first.
   - Anything destructive or security-sensitive.
   - Otherwise make rulings and keep going.
8. **Finish.**
   - After Task 17 and the final review, report every ledger `Ruling:` line to the author.
   - Then use `superpowers:finishing-a-development-branch`.
   - Update this HANDOFF.md, and write Plans 2 and 3.

§10 is kept as the record of how Plan 1 was run. Reuse it as the template for Plans 2 and 3.

## 11. Plan 1 execution record (2026-09-27)

**Outcome:**
- 17 tasks, each reviewed. Three tasks needed one fix round each: T7 pointer capture, T10 fixture tree-shaking, T9 by ruling only.
- A whole-branch review (Opus) returned "with fixes": 5 Important, 8 Minor.
- One fix wave, then an author-approved audio follow-up.

**Final gates:**

| Gate | Result |
|---|---|
| Unit tests | 112 |
| e2e | 75 passed, 1 skipped (offline is Chromium-only) |
| Visual | 6/6 |
| Home size | 39.4 / 100 KB |
| Break the Code chunk | 2.7 / 50 KB |
| Fonts | 105.4 / 110 KB |

**Decisions that changed code relative to the plan** (all in git history):
- `--scrim` token for the end-card overlay.
- Break the Code key handling:
  - lets keys through while paused or ended;
  - leaves Enter to focused top-bar buttons.
- `game.load()` failures are logged.
- The fixture's `defineGame` is marked `/* @__PURE__ */`, so production builds drop it.
- Swipe uses pointer capture.
- The platform fixes from the final review:
  - Timers pause the moment the tab is hidden (`sync()`).
  - Loop and timer callback errors reach the error screen (`LoopOptions.onError`; the session wraps `onExpire`).
  - A single shared AudioContext is unlocked by frame gestures and by the first gesture of a run.
  - Restart ends the countdown.
  - Everything behind the end card is inert.
  - CI never cancels a Pages deploy.
- Docs: registry wording (one import + one array entry), the swipe sample binds to the View root, the haptics wording, and the add-a-game guide now **requires** adding each new game to the a11y, offline and visual specs.
- Biome: keep `linter.rules.recommended: true`. **Never run `biome migrate`**; it silently disables the recommended rules.

**Known and deferred** (fine for v1; revisit when convenient):
- `goHome` uses `goto('/')`, so browser Back after ← re-enters the game (spec §5.2 "back behaves like ←" isn't met exactly).
- Offline navigation to an unknown URL is served the home HTML.
- Reduced motion zeroes animations instead of the spec's plain cross-fades.
- Swipe has no `isPrimary` filtering: a second finger replaces the origin.
- `loop.ts` drops a partial step on pause, and schedules one no-op frame after `stop()` from inside `step`.
- `void ac.resume()` style best-effort audio calls.
- Small duplication in `GameSession#finish()` / `discard()`.
- A stale `crash` field on one `restart()` branch (unreachable).
- Biome prints one info line about the `recommended` key.

**Operational notes:**
- Plain `npm run build` needs at least one registered real game, because every route is prerendered.
- Don't run host builds while the Docker visual container runs: they share a bind mount and race.
- `npm run preview -- --host` serves the production build on the LAN for phone testing. Offline, install and iOS audio need HTTPS, so test those on Pages.

### Suggested resume prompt for the author

> Resume tinkster: read `docs/HANDOFF.md` (§6 and §11), then write Plan 2 (Letters & Numbers) against the real code.
