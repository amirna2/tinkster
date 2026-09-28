import type { OptionField, Options } from '../types';

/** Last-used options where still valid, otherwise each field's default. */
export function resolveOptions(
	fields: OptionField[] | undefined,
	stored: Options | undefined,
): Options {
	const out: Options = {};
	for (const field of fields ?? []) {
		const value = stored?.[field.key];
		out[field.key] =
			value !== undefined && field.choices.some((c) => c.value === value) ? value : field.default;
	}
	return out;
}

/**
 * e2e determinism hook: `?seed=<n>` fixes the RNG seed (offset by run number so "Play again"
 * is deterministic too). Only honored in builds made with PUBLIC_TEST_HOOKS=1.
 */
export function seedFromUrl(href: string, run: number, enabled = __TEST_HOOKS__): number | null {
	if (!enabled) return null;
	const raw = new URL(href).searchParams.get('seed');
	if (raw === null || !/^\d+$/.test(raw)) return null;
	return (Number(raw) + run) >>> 0;
}
