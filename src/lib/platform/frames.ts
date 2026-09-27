/** Injectable animation-frame clock, so timers and loops are testable without a browser. */
export interface FrameDeps {
	now(): number;
	raf(cb: FrameRequestCallback): number;
	caf(handle: number): void;
}

export const browserFrames: FrameDeps = {
	now: () => performance.now(),
	raf: (cb) => requestAnimationFrame(cb),
	caf: (handle) => cancelAnimationFrame(handle),
};
