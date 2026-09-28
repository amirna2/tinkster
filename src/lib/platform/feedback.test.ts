import { afterEach, describe, expect, it, vi } from 'vitest';
import { type AudioLike, createFeedback, HAPTICS } from './feedback';

function fakeAudio() {
	const param = () => ({
		setValueAtTime: vi.fn(),
		exponentialRampToValueAtTime: vi.fn(),
	});
	const started: string[] = [];
	const ctx = {
		currentTime: 0,
		state: 'running',
		destination: {},
		resume: vi.fn(async () => {}),
		createOscillator: vi.fn(() => {
			const osc = {
				type: 'sine',
				frequency: param(),
				connect: vi.fn((node: unknown) => node),
				start: vi.fn(() => started.push(osc.type)),
				stop: vi.fn(),
			};
			return osc;
		}),
		createGain: vi.fn(() => ({ gain: param(), connect: vi.fn((node: unknown) => node) })),
	};
	return { ctx: ctx as unknown as AudioLike, started, raw: ctx };
}

describe('createFeedback', () => {
	it('never touches audio while sound is disabled', () => {
		const audio = vi.fn();
		createFeedback({ enabled: () => false, audio, vibrate: null }).sound('pop');
		expect(audio).not.toHaveBeenCalled();
	});

	it('plays oscillator tones when enabled', () => {
		const { ctx, started } = fakeAudio();
		const fb = createFeedback({ enabled: () => true, audio: () => ctx, vibrate: null });
		fb.sound('stamp');
		expect(started.length).toBeGreaterThanOrEqual(1);
	});

	it('resumes a suspended context', () => {
		const { ctx, raw } = fakeAudio();
		raw.state = 'suspended';
		createFeedback({ enabled: () => true, audio: () => ctx, vibrate: null }).sound('tick');
		expect(raw.resume).toHaveBeenCalled();
	});

	it('is silent (no throw) when audio is unavailable', () => {
		const fb = createFeedback({ enabled: () => true, audio: () => null, vibrate: null });
		expect(() => fb.sound('fail')).not.toThrow();
	});

	it('maps haptics to vibration patterns regardless of the sound setting', () => {
		const vibrate = vi.fn(() => true);
		const fb = createFeedback({ enabled: () => false, audio: () => null, vibrate });
		fb.haptic('error');
		expect(vibrate).toHaveBeenCalledWith(HAPTICS.error);
	});

	it('is a no-op where vibration is unsupported', () => {
		expect(() =>
			createFeedback({ enabled: () => false, audio: () => null, vibrate: null }).haptic('tap'),
		).not.toThrow();
	});
});

describe('the shared AudioContext', () => {
	/** A fresh copy of the module (so a fresh shared context) with a counting AudioContext stub. */
	async function load(state: AudioContextState = 'running') {
		vi.resetModules();
		const created: ReturnType<typeof fakeAudio>['raw'][] = [];
		vi.stubGlobal('AudioContext', function FakeAudioContext() {
			const { raw } = fakeAudio();
			raw.state = state;
			created.push(raw);
			return raw;
		});
		const mod = await import('./feedback');
		return { ...mod, created };
	}

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('is created once and shared by every createFeedback()', async () => {
		const { createFeedback, created } = await load();
		const a = createFeedback({ enabled: () => true, vibrate: null });
		const b = createFeedback({ enabled: () => true, vibrate: null });
		a.sound('tick');
		b.sound('pop');
		a.sound('fail');
		expect(created).toHaveLength(1);
		expect(created[0]?.createOscillator).toHaveBeenCalledTimes(3);
	});

	it('unlockAudio() creates and resumes it, and sounds then play on it', async () => {
		const { createFeedback, unlockAudio, created } = await load('suspended');
		unlockAudio();
		expect(created).toHaveLength(1);
		expect(created[0]?.resume).toHaveBeenCalledTimes(1);
		createFeedback({ enabled: () => true, vibrate: null }).sound('pop');
		expect(created).toHaveLength(1);
		expect(created[0]?.createOscillator).toHaveBeenCalled();
	});

	it('is never created while sound is off', async () => {
		const { createFeedback, created } = await load();
		createFeedback({ enabled: () => false, vibrate: null }).sound('stamp');
		expect(created).toHaveLength(0);
	});

	it('swallows a refused resume() (e.g. outside a user gesture on iOS)', async () => {
		const { createFeedback, unlockAudio, created } = await load('suspended');
		const unhandled = vi.fn();
		process.on('unhandledRejection', unhandled);
		try {
			unlockAudio();
			const ctx = created[0];
			// A plain function: a vi.fn() observes its own results, which marks a rejection handled.
			if (ctx) ctx.resume = (() => Promise.reject(new Error('NotAllowedError'))) as never;
			createFeedback({ enabled: () => true, vibrate: null }).sound('pop');
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(unhandled).not.toHaveBeenCalled();
		} finally {
			process.off('unhandledRejection', unhandled);
		}
	});
});
