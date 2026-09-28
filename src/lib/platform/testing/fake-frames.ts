import type { FrameDeps } from '../frames';

export interface FakeFrames extends FrameDeps {
	/** Moves the clock forward and runs the callbacks that were queued before the call. */
	advance(ms: number): void;
	/** Moves the clock forward without running any frame, as in a hidden tab. */
	wait(ms: number): void;
	readonly pending: number;
}

export function fakeFrames(): FakeFrames {
	let t = 0;
	let queue: FrameRequestCallback[] = [];
	return {
		now: () => t,
		raf: (cb) => {
			queue.push(cb);
			return queue.length;
		},
		caf: () => {
			queue = [];
		},
		advance(ms) {
			t += ms;
			const due = queue;
			queue = [];
			for (const cb of due) cb(t);
		},
		wait(ms) {
			t += ms;
		},
		get pending() {
			return queue.length;
		},
	};
}
