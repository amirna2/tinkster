import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRng } from '../rng';
import { createSaves, memoryStore } from '../save';
import type { AnyGame, GameModule, PausableTimer } from '../types';
import { GameSession, type SessionDeps } from './session.svelte';

interface S {
	n: number;
}

const game: AnyGame = {
	id: 'demo',
	title: 'Demo',
	pitch: 'p',
	category: 'logic',
	pace: 'timed',
	minutes: [1, 2],
	icon: '<svg></svg>',
	saveVersion: 3,
	load: async () => {
		throw new Error('unused');
	},
};

const module = {
	View: (() => {}) as unknown as GameModule<S>['View'],
	Rules: (() => {}) as unknown as GameModule<S>['Rules'],
	progressLabel: (s: S) => `n=${s.n}`,
} satisfies GameModule<S>;

function setup(over: Partial<SessionDeps<S>> = {}) {
	const saves = createSaves(memoryStore());
	const onFinish = vi.fn();
	const session = new GameSession<S>({
		game,
		module,
		options: { level: 'easy' },
		saves,
		rng: createRng(1),
		feedback: { sound: vi.fn(), haptic: vi.fn() },
		onFinish,
		now: () => 1234,
		debounceMs: 300,
		...over,
	});
	return { session, saves, onFinish };
}

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
});

describe('GameSession saves', () => {
	it('debounces saves and writes only the latest state', () => {
		const { session, saves } = setup();
		const write = vi.spyOn(saves, 'writeSlot');
		session.ctx.save({ n: 1 });
		session.ctx.save({ n: 2 });
		expect(write).not.toHaveBeenCalled();
		vi.advanceTimersByTime(300);
		expect(write).toHaveBeenCalledTimes(1);
		expect(saves.readSlot<S>('demo', 3)?.state).toEqual({ n: 2 });
	});

	it('flush() writes immediately with label, options, version and timestamp', () => {
		const { session, saves } = setup();
		session.ctx.save({ n: 7 });
		session.flush();
		expect(saves.readSlot<S>('demo', 3)).toEqual({
			gameId: 'demo',
			saveVersion: 3,
			savedAt: 1234,
			label: 'n=7',
			options: { level: 'easy' },
			state: { n: 7 },
		});
	});

	it('dispose() flushes a pending save', () => {
		const { session, saves } = setup();
		session.ctx.save({ n: 4 });
		session.dispose();
		expect(saves.readSlot<S>('demo', 3)?.state).toEqual({ n: 4 });
	});

	it('discard() drops the pending save and ignores later saves', () => {
		const { session, saves } = setup();
		session.ctx.save({ n: 4 });
		session.discard();
		session.ctx.save({ n: 5 });
		vi.advanceTimersByTime(1000);
		session.flush();
		expect(saves.readSlot('demo', 3)).toBeNull();
	});
});

describe('GameSession finish', () => {
	it('clears the slot, pauses, reports the result and ignores later saves', () => {
		const { session, saves, onFinish } = setup();
		session.ctx.save({ n: 1 });
		session.flush();
		session.ctx.finish({ stamp: 'Done!', headline: 'n=1' });
		expect(saves.readSlot('demo', 3)).toBeNull();
		expect(session.paused).toBe(true);
		expect(session.finished).toBe(true);
		expect(onFinish).toHaveBeenCalledWith({ stamp: 'Done!', headline: 'n=1' });
		session.ctx.save({ n: 2 });
		vi.advanceTimersByTime(1000);
		expect(saves.readSlot('demo', 3)).toBeNull();
	});

	it('only reports the first finish', () => {
		const { session, onFinish } = setup();
		session.ctx.finish({ stamp: 'A', headline: 'a' });
		session.ctx.finish({ stamp: 'B', headline: 'b' });
		expect(onFinish).toHaveBeenCalledTimes(1);
	});
});

describe('GameSession pause and meta', () => {
	it('is paused while any reason is active', () => {
		const { session } = setup();
		expect(session.paused).toBe(false);
		session.setPause('sheet', true);
		session.setPause('sheet', true);
		session.setPause('hidden', true);
		expect(session.ctx.paused).toBe(true);
		session.setPause('sheet', false);
		expect(session.paused).toBe(true);
		session.setPause('hidden', false);
		expect(session.ctx.paused).toBe(false);
	});

	it('setMeta() updates both lines, right defaulting to empty', () => {
		const { session } = setup();
		session.ctx.setMeta('Guess 1 of 8');
		expect(session.meta).toEqual({ left: 'Guess 1 of 8', right: '' });
	});
});

describe('GameSession timers', () => {
	const fakeTimer = (): PausableTimer & { stop: ReturnType<typeof vi.fn> } => ({
		durationMs: 1000,
		remainingMs: 1000,
		expired: false,
		stop: vi.fn(() => {}),
	});

	it('creates timers bound to the session pause state and replaces the previous one', () => {
		const made: { timer: ReturnType<typeof fakeTimer>; isPaused: () => boolean }[] = [];
		const { session } = setup({
			createTimer: (_ms, _onExpire, isPaused) => {
				const timer = fakeTimer();
				made.push({ timer, isPaused });
				return timer;
			},
		});
		const first = session.ctx.timer(1000, () => {});
		expect(session.timer).toBe(first);
		session.setPause('sheet', true);
		expect(made[0]?.isPaused()).toBe(true);
		const second = session.ctx.timer(2000, () => {});
		expect(made[0]?.timer.stop).toHaveBeenCalled();
		expect(session.timer).toBe(second);
	});
});
