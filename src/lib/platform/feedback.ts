import type { Feedback, HapticName, SoundName } from './types';

export type AudioLike = Pick<
	AudioContext,
	'currentTime' | 'destination' | 'state' | 'resume' | 'createOscillator' | 'createGain'
>;

export interface FeedbackDeps {
	/** Sound preference; read on every call. */
	enabled: () => boolean;
	/** The audio context to play on; defaults to the app's shared one. */
	audio?: () => AudioLike | null;
	vibrate?: ((pattern: number | number[]) => boolean) | null;
}

interface Tone {
	type: OscillatorType;
	from: number;
	to: number;
	durationMs: number;
	gain: number;
}

/** Every sound is synthesized: no audio files to download or cache. */
const RECIPES: Record<SoundName, Tone[]> = {
	tick: [{ type: 'square', from: 1400, to: 1300, durationMs: 25, gain: 0.03 }],
	pop: [{ type: 'sine', from: 520, to: 880, durationMs: 70, gain: 0.12 }],
	stamp: [
		{ type: 'sine', from: 140, to: 60, durationMs: 160, gain: 0.35 },
		{ type: 'triangle', from: 900, to: 300, durationMs: 40, gain: 0.08 },
	],
	fail: [{ type: 'sawtooth', from: 220, to: 110, durationMs: 220, gain: 0.07 }],
};

export const HAPTICS: Record<HapticName, number | number[]> = {
	tap: 8,
	success: [18, 40, 18],
	error: [50, 30, 50],
};

let shared: AudioLike | null | undefined;

/**
 * The app's one AudioContext, created on first use; null where Web Audio is unavailable. One for
 * the whole app because browsers cap how many can exist, and iOS unlocks each separately.
 */
function sharedAudio(): AudioLike | null {
	if (shared === undefined)
		shared = typeof AudioContext === 'undefined' ? null : new AudioContext();
	return shared;
}

function wake(ac: AudioLike): void {
	// Browsers refuse resume() outside a user gesture; the next gesture will try again.
	if (ac.state === 'suspended') ac.resume().catch(() => {});
}

/**
 * Creates and resumes the shared AudioContext. Platform-internal: the frame calls it from real
 * user gestures (Start, Play again, Resume, turning Sound on), because iOS keeps audio silent
 * until a context is resumed inside one, and real-time games play sounds from animation frames.
 */
export function unlockAudio(): void {
	const ac = sharedAudio();
	if (ac) wake(ac);
}

function defaultVibrate(): ((pattern: number | number[]) => boolean) | null {
	return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
		? (pattern) => navigator.vibrate(pattern)
		: null;
}

function play(ac: AudioLike, tone: Tone): void {
	const t0 = ac.currentTime;
	const t1 = t0 + tone.durationMs / 1000;
	const osc = ac.createOscillator();
	const gain = ac.createGain();
	osc.type = tone.type;
	osc.frequency.setValueAtTime(tone.from, t0);
	osc.frequency.exponentialRampToValueAtTime(tone.to, t1);
	gain.gain.setValueAtTime(tone.gain, t0);
	gain.gain.exponentialRampToValueAtTime(0.0001, t1);
	osc.connect(gain).connect(ac.destination);
	osc.start(t0);
	osc.stop(t1 + 0.02);
}

export function createFeedback({
	enabled,
	audio = sharedAudio,
	vibrate = defaultVibrate(),
}: FeedbackDeps): Feedback {
	return {
		sound(name) {
			if (!enabled()) return;
			const ac = audio();
			if (!ac) return;
			wake(ac);
			for (const tone of RECIPES[name]) play(ac, tone);
		},
		haptic(name) {
			vibrate?.(HAPTICS[name]);
		},
	};
}
