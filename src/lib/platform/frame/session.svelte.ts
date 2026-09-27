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
