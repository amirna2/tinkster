import { describe, expect, it, vi } from 'vitest';
import { advance, startLoop } from './loop';
import { fakeFrames } from './testing/fake-frames';

describe('advance', () => {
	it('runs whole steps and carries the remainder', () => {
		const step = vi.fn();
		expect(advance(0, 250, () => 100, step)).toBe(50);
		expect(step).toHaveBeenCalledTimes(2);
	});

	it('clamps a long gap (tab switch) to maxElapsedMs', () => {
		const step = vi.fn();
		advance(0, 60_000, () => 100, step, 250);
		expect(step).toHaveBeenCalledTimes(2);
	});

	it('treats negative elapsed time as zero', () => {
		const step = vi.fn();
		expect(advance(40, -500, () => 100, step)).toBe(40);
		expect(step).not.toHaveBeenCalled();
	});

	it('re-reads stepMs after every step (speed-ups apply immediately)', () => {
		let ms = 100;
		const step = vi.fn(() => {
			ms = 50;
		});
		expect(advance(0, 200, () => ms, step)).toBe(0);
		expect(step).toHaveBeenCalledTimes(3); // 100 + 50 + 50
	});
});

describe('startLoop', () => {
	it('steps at the fixed rate and renders every frame', () => {
		const frames = fakeFrames();
		const step = vi.fn();
		const render = vi.fn();
		startLoop({ stepMs: () => 100, step, render, isPaused: () => false, frames });
		for (let i = 0; i < 10; i++) frames.advance(25);
		expect(step).toHaveBeenCalledTimes(2);
		expect(render).toHaveBeenCalledTimes(10);
	});

	it('does not step while paused, and does not catch up afterwards', () => {
		const frames = fakeFrames();
		const step = vi.fn();
		let paused = true;
		startLoop({ stepMs: () => 100, step, render: () => {}, isPaused: () => paused, frames });
		for (let i = 0; i < 20; i++) frames.advance(50);
		expect(step).not.toHaveBeenCalled();
		paused = false;
		frames.advance(50);
		expect(step).not.toHaveBeenCalled();
		frames.advance(50);
		expect(step).toHaveBeenCalledTimes(1);
	});

	it('stop() ends the loop', () => {
		const frames = fakeFrames();
		const render = vi.fn();
		const stop = startLoop({
			stepMs: () => 100,
			step: () => {},
			render,
			isPaused: () => false,
			frames,
		});
		frames.advance(16);
		stop();
		frames.advance(16);
		expect(render).toHaveBeenCalledTimes(1);
		expect(frames.pending).toBe(0);
	});

	it('stops and hands an error thrown by step() to onError', () => {
		const frames = fakeFrames();
		const boom = new Error('step');
		const render = vi.fn();
		const onError = vi.fn();
		startLoop({
			stepMs: () => 10,
			step: () => {
				throw boom;
			},
			render,
			isPaused: () => false,
			frames,
			onError,
		});
		frames.advance(16);
		frames.advance(16);
		expect(onError).toHaveBeenCalledExactlyOnceWith(boom);
		expect(render).not.toHaveBeenCalled();
		expect(frames.pending).toBe(0);
	});

	it('stops and hands an error thrown by render() to onError', () => {
		const frames = fakeFrames();
		const boom = new Error('render');
		const onError = vi.fn();
		startLoop({
			stepMs: () => 100,
			step: () => {},
			render: () => {
				throw boom;
			},
			isPaused: () => false,
			frames,
			onError,
		});
		frames.advance(16);
		expect(onError).toHaveBeenCalledExactlyOnceWith(boom);
		expect(frames.pending).toBe(0);
	});

	it('logs the error when no onError is given (never silent)', () => {
		const frames = fakeFrames();
		const boom = new Error('render');
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		startLoop({
			stepMs: () => 100,
			step: () => {},
			render: () => {
				throw boom;
			},
			isPaused: () => false,
			frames,
		});
		expect(() => frames.advance(16)).not.toThrow();
		expect(log).toHaveBeenCalledWith(boom);
		expect(frames.pending).toBe(0);
		log.mockRestore();
	});
});
