import { describe, expect, it, vi } from 'vitest';
import { fakeFrames } from './testing/fake-frames';
import { createCountdown, isRunning, pauseCountdown, remainingMs, startCountdown } from './timer';
import { RafTimer } from './timer.svelte';

describe('countdown (pure)', () => {
	it('starts stopped with the full duration', () => {
		const c = createCountdown(1000);
		expect(isRunning(c)).toBe(false);
		expect(remainingMs(c, 500)).toBe(1000);
	});

	it('counts down while running and clamps at zero', () => {
		const c = startCountdown(createCountdown(1000), 100);
		expect(remainingMs(c, 400)).toBe(700);
		expect(remainingMs(c, 5000)).toBe(0);
	});

	it('freezes while paused and resumes where it left off', () => {
		let c = startCountdown(createCountdown(1000), 0);
		c = pauseCountdown(c, 300);
		expect(remainingMs(c, 10_000)).toBe(700);
		c = startCountdown(c, 10_000);
		expect(remainingMs(c, 10_200)).toBe(500);
	});

	it('start and pause are idempotent', () => {
		const running = startCountdown(createCountdown(1000), 0);
		expect(startCountdown(running, 50)).toBe(running);
		const paused = pauseCountdown(running, 100);
		expect(pauseCountdown(paused, 200)).toBe(paused);
	});
});

describe('RafTimer', () => {
	it('counts down each frame and fires onExpire exactly once', () => {
		const frames = fakeFrames();
		const onExpire = vi.fn();
		const timer = new RafTimer(1000, onExpire, () => false, frames);
		frames.advance(400);
		expect(timer.remainingMs).toBe(600);
		frames.advance(700);
		expect(timer.remainingMs).toBe(0);
		expect(timer.expired).toBe(true);
		frames.advance(100);
		expect(onExpire).toHaveBeenCalledTimes(1);
		expect(frames.pending).toBe(0);
	});

	it('freezes while isPaused() is true', () => {
		const frames = fakeFrames();
		let paused = false;
		const timer = new RafTimer(
			1000,
			() => {},
			() => paused,
			frames,
		);
		frames.advance(300);
		paused = true;
		frames.advance(1); // this frame notices the pause
		const frozen = timer.remainingMs;
		frames.advance(5000);
		expect(timer.remainingMs).toBe(frozen);
		paused = false;
		frames.advance(1); // this frame notices the resume
		frames.advance(200);
		expect(timer.remainingMs).toBe(frozen - 200);
	});

	it('stop() cancels further ticks', () => {
		const frames = fakeFrames();
		const onExpire = vi.fn();
		const timer = new RafTimer(1000, onExpire, () => false, frames);
		timer.stop();
		frames.advance(5000);
		expect(onExpire).not.toHaveBeenCalled();
		expect(timer.remainingMs).toBe(1000);
	});
});
