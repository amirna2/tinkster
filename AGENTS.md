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

## Add-a-game checklist
1. Create `src/lib/games/<id>/` with `rules.ts`, `rules.test.ts`, `View.svelte`,
   `HowToPlay.svelte`, `module.ts`, `index.ts`, `icon.svg`.
2. `rules.ts` is pure (no DOM, timers, `Math.random`, `Date`); `rules.test.ts` covers
   concrete cases plus `fast-check` properties.
3. `View.svelte` talks to the platform only through `ctx` (`GameContext`) — no other
   `$lib/platform` imports.
4. Import the `GameDefinition` and add it to the `games` array in
   `src/lib/platform/registry.ts` — the only platform file the change touches.
5. Add `e2e/<id>.spec.ts`: start → a deterministic end → end card → Play again, plus
   resume from the home screen.
6. Run the gates: `npm test && npm run check && npm run lint && npm run test:e2e &&
   npm run build && npm run size`.

Full details, including the `View.svelte` contract and turn-based vs. real-time input,
are in [docs/adding-a-game.md](docs/adding-a-game.md).
