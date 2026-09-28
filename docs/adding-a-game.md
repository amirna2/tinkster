# Adding a game

A game is **one folder** under `src/lib/games/<id>/` plus **one import and one array
entry** in `src/lib/platform/registry.ts`. If you find yourself editing anything under
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
| `ctx.timer(ms, onExpire)` | a countdown that freezes while paused; the frame draws the red strip, and an error thrown by `onExpire` shows the frame's error screen |
| `ctx.rng` | seeded randomness (deterministic in e2e tests) |
| `ctx.feedback.sound('tick' \| 'pop' \| 'stamp' \| 'fail')`, `.haptic('tap' \| 'success' \| 'error')` | game feel; sound respects the Sound setting, haptics are silent no-ops where unsupported |

`reveal` is a snippet shown on the end card. Declare it at the top level of your template
(`{#snippet answer()}…{/snippet}`) and pass `reveal: answer`.

### Turn-based input
Buttons in the bottom third of the screen, plus `<svelte:window onkeydown={…} />` for
desktop keys. Call `e.preventDefault()` only for the keys you actually handle, and check
`ctx.paused` and whether the game has already ended before handling anything, so Enter still
reaches the rules sheet and the end-card buttons while paused or once the game is over.
Leave Enter, Space and Backspace to a focused control outside your own keypad, too: a
keyboard user who tabs to Home, `?` or Menu and presses Enter means that button, not
"submit". Break the Code's `View.svelte` shows the pattern (its keypad wrapper has
`bind:this={pad}`):

```ts
/** A focused control outside the keypad (Home, Menu, ...) keeps Enter and Backspace for itself. */
function controlFocused(target: EventTarget | null): boolean {
	return (
		target instanceof Element &&
		!pad?.contains(target) &&
		target.closest('a, button, input, select, textarea, [tabindex]') !== null
	);
}

function onkeydown(e: KeyboardEvent): void {
	if (e.metaKey || e.ctrlKey || e.altKey || ctx.paused || game.status !== 'playing') return;
	if (/^[0-9]$/.test(e.key)) act({ type: 'digit', digit: Number(e.key) });
	else if (controlFocused(e.target)) return;
	else if (e.key === 'Backspace') act({ type: 'backspace' });
	else if (e.key === 'Enter') act({ type: 'submit' });
	else return;
	e.preventDefault();
}
```

It returns early — without calling `preventDefault()` — whenever the game is paused or
no longer playing, or when a control outside the keypad has focus (digits still type
then), and it only calls `preventDefault()` after a key it recognized was actually handled.

### Real-time games
Use the fixed-step loop and swipe input from the platform. Bind swipe to the view's own
root element, not `document.body`, so it works anywhere over the play area but not over
the top bar:

```ts
import { onMount } from 'svelte';
import { startLoop } from '$lib/platform/loop';
import { attachSwipe, keyToDirection, TurnBuffer } from '$lib/platform/input/swipe';

let canvas = $state<HTMLCanvasElement>();
let root = $state<HTMLElement>();
let crashed = $state.raw<{ error: unknown } | null>(null);
const turns = new TurnBuffer(2);

$effect(() => {
  if (!root) return;
  return attachSwipe(root, (dir) => {
    if (!ctx.paused) turns.push(dir, game.heading);
  });
});

function onkeydown(e: KeyboardEvent): void {
  if (ctx.paused) return;
  const dir = keyToDirection(e.key);
  if (!dir) return;
  turns.push(dir, game.heading);
  e.preventDefault();
}

onMount(() => {
  const stop = startLoop({
    stepMs: () => game.stepMs,
    step: () => {
      game = step(game, turns.next(game.heading));
      ctx.save(game);
      if (game.over) ctx.finish({ stamp: 'Game over', headline: `Score ${game.score}` });
    },
    render: () => draw(canvas, game),
    isPaused: () => ctx.paused,
    onError: (error) => {
      crashed = { error };
    },
  });
  return stop;
});

function rethrow(error: unknown): string {
  throw error;
}
```

```svelte
<svelte:window {onkeydown} />
<div bind:this={root} class="board">
  <canvas bind:this={canvas}></canvas>
  {#if crashed}{rethrow(crashed.error)}{/if}
</div>
```

`root` is a wrapper that fills the play area (not the top bar), so a swipe anywhere over
the board works while a swipe over the chrome doesn't.

- `step` and `render` run from animation frames, outside the frame's error boundary. If
  either throws, `startLoop` stops and calls `onError`; rethrowing the error while rendering
  (the `{#if crashed}` line) hands it to the boundary, which shows "Something broke" and
  clears the save. Without `onError` the error is only logged and the game just freezes.
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

## 9. Register it

In `src/lib/platform/registry.ts`: import your `GameDefinition` and add it to the `games`
array — one import and one array entry, nothing else in the file changes. Its position
within its category is its position on the home screen.

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

Then check `git diff --stat main -- src/lib/platform src/routes`. It should show only
`registry.ts`.
