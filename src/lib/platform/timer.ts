/** Pure countdown state. `now` is any monotonic millisecond clock. */
export interface Countdown {
	readonly durationMs: number;
	/** Time consumed during completed running spans. */
	readonly elapsedMs: number;
	/** Start of the current running span, or null while paused. */
	readonly runningSince: number | null;
}

export function createCountdown(durationMs: number): Countdown {
	return { durationMs, elapsedMs: 0, runningSince: null };
}

export function isRunning(c: Countdown): boolean {
	return c.runningSince !== null;
}

export function startCountdown(c: Countdown, now: number): Countdown {
	return c.runningSince === null ? { ...c, runningSince: now } : c;
}

export function pauseCountdown(c: Countdown, now: number): Countdown {
	return c.runningSince === null
		? c
		: { ...c, elapsedMs: c.elapsedMs + (now - c.runningSince), runningSince: null };
}

export function remainingMs(c: Countdown, now: number): number {
	const running = c.runningSince === null ? 0 : now - c.runningSince;
	return Math.max(0, c.durationMs - c.elapsedMs - running);
}
