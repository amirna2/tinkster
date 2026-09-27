import { browserFrames, type FrameDeps } from './frames';

/**
 * Fixed-timestep accumulator. Runs step() once per stepMs of elapsed time, re-reading stepMs after
 * each step. Returns the leftover accumulator. Elapsed time is clamped so a long pause (a
 * backgrounded tab) never causes a burst of catch-up steps.
 */
export function advance(
	accumulatorMs: number,
	elapsedMs: number,
	stepMs: () => number,
	step: () => void,
	maxElapsedMs = 250,
): number {
	let acc = accumulatorMs + Math.min(Math.max(elapsedMs, 0), maxElapsedMs);
	let ms = stepMs();
	while (acc >= ms) {
		step();
		acc -= ms;
		ms = stepMs();
	}
	return acc;
}

export interface LoopOptions {
	stepMs: () => number;
	step: () => void;
	render: () => void;
	isPaused: () => boolean;
	frames?: FrameDeps;
}

/** Game logic at a fixed rate, rendering at display rate. Returns stop(). */
export function startLoop({
	stepMs,
	step,
	render,
	isPaused,
	frames = browserFrames,
}: LoopOptions): () => void {
	let acc = 0;
	let last = frames.now();
	let stopped = false;
	let handle = frames.raf(tick);

	function tick(): void {
		if (stopped) return;
		const now = frames.now();
		const elapsed = now - last;
		last = now;
		acc = isPaused() ? 0 : advance(acc, elapsed, stepMs, step);
		render();
		handle = frames.raf(tick);
	}

	return () => {
		stopped = true;
		frames.caf(handle);
	};
}
