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
