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

/** A game timer as the frame sees it: sync() applies a pause change the moment it happens. */
export interface SyncedTimer extends PausableTimer {
	sync(): void;
}

/** A countdown driven by animation frames. Freezes whenever isPaused() is true. */
export class RafTimer implements SyncedTimer {
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
		this.#apply();
		if (this.remainingMs === 0) {
			this.expired = true;
			this.#handle = null;
			this.#onExpire();
			return;
		}
		this.#handle = this.#frames.raf(this.#tick);
	};

	/**
	 * Records a pause or resume at the current time. Frames alone would notice it late: hidden tabs
	 * get no frames, so the first frame back would charge the whole hidden interval.
	 */
	sync(): void {
		if (this.#handle !== null) this.#apply();
	}

	stop(): void {
		if (this.#handle !== null) this.#frames.caf(this.#handle);
		this.#handle = null;
	}

	#apply(): void {
		const now = this.#frames.now();
		const paused = this.#isPaused();
		if (paused && isRunning(this.#countdown)) {
			this.#countdown = pauseCountdown(this.#countdown, now);
		} else if (!paused && !isRunning(this.#countdown)) {
			this.#countdown = startCountdown(this.#countdown, now);
		}
		this.remainingMs = remainingMs(this.#countdown, now);
	}
}

export function createRafTimer(
	durationMs: number,
	onExpire: () => void,
	isPaused: () => boolean,
	frames?: FrameDeps,
): SyncedTimer {
	return new RafTimer(durationMs, onExpire, isPaused, frames);
}
