import type { Feedback, HapticName, SoundName } from './types';

export type AudioLike = Pick<
	AudioContext,
	'currentTime' | 'destination' | 'state' | 'resume' | 'createOscillator' | 'createGain'
>;

export interface FeedbackDeps {
	/** Sound preference; read on every call. */
	enabled: () => boolean;
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

function defaultAudio(): AudioLike | null {
	return typeof AudioContext === 'undefined' ? null : new AudioContext();
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
	audio = defaultAudio,
	vibrate = defaultVibrate(),
}: FeedbackDeps): Feedback {
	let ac: AudioLike | null | undefined;

	return {
		sound(name) {
			if (!enabled()) return;
			if (ac === undefined) ac = audio();
			if (!ac) return;
			if (ac.state === 'suspended') void ac.resume();
			for (const tone of RECIPES[name]) play(ac, tone);
		},
		haptic(name) {
			vibrate?.(HAPTICS[name]);
		},
	};
}
