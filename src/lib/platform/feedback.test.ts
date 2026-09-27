import { describe, expect, it, vi } from 'vitest';
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

	it('creates the audio context lazily and only once', () => {
		const { ctx } = fakeAudio();
		const audio = vi.fn(() => ctx);
		const fb = createFeedback({ enabled: () => true, audio, vibrate: null });
		fb.sound('tick');
		fb.sound('pop');
		expect(audio).toHaveBeenCalledTimes(1);
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
