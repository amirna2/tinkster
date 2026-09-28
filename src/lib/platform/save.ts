import type { Options } from './types';

export interface KeyValueStore {
	get(key: string): string | null;
	set(key: string, value: string): void;
	remove(key: string): void;
	keys(): string[];
}

export function memoryStore(): KeyValueStore {
	const map = new Map<string, string>();
	return {
		get: (k) => map.get(k) ?? null,
		set: (k, v) => {
			map.set(k, v);
		},
		remove: (k) => {
			map.delete(k);
		},
		keys: () => [...map.keys()],
	};
}

/** localStorage when usable; otherwise (private mode, blocked storage, SSR) an in-memory store. */
export function browserStore(): KeyValueStore {
	try {
		const ls = globalThis.localStorage;
		const probe = 'tinkster:probe';
		ls.setItem(probe, '1');
		ls.removeItem(probe);
		return {
			get: (k) => ls.getItem(k),
			set: (k, v) => {
				try {
					ls.setItem(k, v);
				} catch {
					// Quota exceeded: resume is best-effort, so drop the write.
				}
			},
			remove: (k) => ls.removeItem(k),
			keys: () => Array.from({ length: ls.length }, (_, i) => ls.key(i)).filter((k) => k !== null),
		};
	} catch {
		return memoryStore();
	}
}

const SLOT_PREFIX = 'tinkster:slot:';
const PREFS_KEY = 'tinkster:prefs';

export interface ResumeSlot<S = unknown> {
	gameId: string;
	saveVersion: number;
	savedAt: number;
	label: string;
	options: Options;
	state: S;
}

export type SlotSummary = Omit<ResumeSlot, 'options' | 'state'>;

export interface Prefs {
	sound: boolean;
	/** Last-used options per game id. */
	options: Record<string, Options>;
}

export interface Saves {
	readSlot<S>(gameId: string, saveVersion: number): ResumeSlot<S> | null;
	writeSlot<S>(slot: ResumeSlot<S>): void;
	clearSlot(gameId: string): void;
	listSlots(): SlotSummary[];
	readPrefs(): Prefs;
	writePrefs(prefs: Prefs): void;
}

export function defaultPrefs(): Prefs {
	return { sound: false, options: {} };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

function stringOptions(v: unknown): Options | null {
	if (!isRecord(v)) return null;
	const out: Options = {};
	for (const [k, val] of Object.entries(v)) if (typeof val === 'string') out[k] = val;
	return out;
}

function parseSlot(raw: string): ResumeSlot | null {
	try {
		const v: unknown = JSON.parse(raw);
		if (!isRecord(v)) return null;
		const options = stringOptions(v.options);
		if (
			typeof v.gameId !== 'string' ||
			typeof v.saveVersion !== 'number' ||
			typeof v.savedAt !== 'number' ||
			typeof v.label !== 'string' ||
			options === null ||
			!('state' in v)
		) {
			return null;
		}
		return {
			gameId: v.gameId,
			saveVersion: v.saveVersion,
			savedAt: v.savedAt,
			label: v.label,
			options,
			state: v.state,
		};
	} catch {
		return null;
	}
}

export function createSaves(store: KeyValueStore): Saves {
	return {
		readSlot<S>(gameId: string, saveVersion: number): ResumeSlot<S> | null {
			const raw = store.get(SLOT_PREFIX + gameId);
			if (raw === null) return null;
			const slot = parseSlot(raw);
			if (!slot || slot.gameId !== gameId || slot.saveVersion !== saveVersion) {
				store.remove(SLOT_PREFIX + gameId);
				return null;
			}
			return slot as ResumeSlot<S>;
		},

		writeSlot(slot) {
			store.set(SLOT_PREFIX + slot.gameId, JSON.stringify(slot));
		},

		clearSlot(gameId) {
			store.remove(SLOT_PREFIX + gameId);
		},

		listSlots() {
			const out: SlotSummary[] = [];
			for (const key of store.keys()) {
				if (!key.startsWith(SLOT_PREFIX)) continue;
				const raw = store.get(key);
				const slot = raw === null ? null : parseSlot(raw);
				if (!slot) {
					store.remove(key);
					continue;
				}
				out.push({
					gameId: slot.gameId,
					saveVersion: slot.saveVersion,
					savedAt: slot.savedAt,
					label: slot.label,
				});
			}
			return out;
		},

		readPrefs() {
			const raw = store.get(PREFS_KEY);
			if (raw === null) return defaultPrefs();
			try {
				const v: unknown = JSON.parse(raw);
				if (!isRecord(v) || typeof v.sound !== 'boolean' || !isRecord(v.options)) {
					return defaultPrefs();
				}
				const options: Record<string, Options> = {};
				for (const [gameId, opts] of Object.entries(v.options)) {
					const parsed = stringOptions(opts);
					if (parsed) options[gameId] = parsed;
				}
				return { sound: v.sound, options };
			} catch {
				return defaultPrefs();
			}
		},

		writePrefs(prefs) {
			store.set(PREFS_KEY, JSON.stringify(prefs));
		},
	};
}
