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
