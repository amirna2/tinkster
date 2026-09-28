import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserStore, createSaves, defaultPrefs, memoryStore, type ResumeSlot } from './save';

const slot = (over: Partial<ResumeSlot<{ n: number }>> = {}): ResumeSlot<{ n: number }> => ({
	gameId: 'demo',
	saveVersion: 1,
	savedAt: 1000,
	label: 'turn 2',
	options: { level: 'easy' },
	state: { n: 2 },
	...over,
});

describe('resume slots', () => {
	it('round-trips a slot', () => {
		const saves = createSaves(memoryStore());
		saves.writeSlot(slot());
		expect(saves.readSlot('demo', 1)).toEqual(slot());
	});

	it('returns null when there is no slot', () => {
		expect(createSaves(memoryStore()).readSlot('demo', 1)).toBeNull();
	});

	it('discards and deletes a slot whose saveVersion differs', () => {
		const store = memoryStore();
		const saves = createSaves(store);
		saves.writeSlot(slot({ saveVersion: 1 }));
		expect(saves.readSlot('demo', 2)).toBeNull();
		expect(store.get('tinkster:slot:demo')).toBeNull();
	});

	it('discards and deletes corrupt JSON', () => {
		const store = memoryStore();
		store.set('tinkster:slot:demo', '{not json');
		expect(createSaves(store).readSlot('demo', 1)).toBeNull();
		expect(store.get('tinkster:slot:demo')).toBeNull();
	});

	it('discards a slot with a missing field or wrong gameId', () => {
		const store = memoryStore();
		const saves = createSaves(store);
		store.set('tinkster:slot:demo', JSON.stringify({ ...slot(), label: 42 }));
		expect(saves.readSlot('demo', 1)).toBeNull();
		store.set('tinkster:slot:demo', JSON.stringify(slot({ gameId: 'other' })));
		expect(saves.readSlot('demo', 1)).toBeNull();
	});

	it('clearSlot removes the slot', () => {
		const saves = createSaves(memoryStore());
		saves.writeSlot(slot());
		saves.clearSlot('demo');
		expect(saves.readSlot('demo', 1)).toBeNull();
	});

	it('listSlots summarizes valid slots and drops corrupt ones', () => {
		const store = memoryStore();
		const saves = createSaves(store);
		saves.writeSlot(slot());
		saves.writeSlot(slot({ gameId: 'other', savedAt: 2000, label: 'turn 9' }));
		store.set('tinkster:slot:broken', 'nope');
		store.set('unrelated', 'x');
		const list = saves.listSlots().sort((a, b) => a.savedAt - b.savedAt);
		expect(list).toEqual([
			{ gameId: 'demo', saveVersion: 1, savedAt: 1000, label: 'turn 2' },
			{ gameId: 'other', saveVersion: 1, savedAt: 2000, label: 'turn 9' },
		]);
		expect(store.get('tinkster:slot:broken')).toBeNull();
		expect(store.get('unrelated')).toBe('x');
	});
});

describe('preferences', () => {
	it('defaults to sound off and no options', () => {
		expect(createSaves(memoryStore()).readPrefs()).toEqual({ sound: false, options: {} });
	});

	it('round-trips', () => {
		const saves = createSaves(memoryStore());
		saves.writePrefs({ sound: true, options: { demo: { level: 'hard' } } });
		expect(saves.readPrefs()).toEqual({ sound: true, options: { demo: { level: 'hard' } } });
	});

	it('falls back to defaults on a malformed value', () => {
		const store = memoryStore();
		store.set('tinkster:prefs', JSON.stringify({ sound: 'yes', options: [] }));
		expect(createSaves(store).readPrefs()).toEqual(defaultPrefs());
	});

	it('drops non-string option values but keeps valid ones', () => {
		const store = memoryStore();
		store.set(
			'tinkster:prefs',
			JSON.stringify({ sound: false, options: { a: { level: 'easy', n: 3 }, b: 'x' } }),
		);
		expect(createSaves(store).readPrefs()).toEqual({
			sound: false,
			options: { a: { level: 'easy' } },
		});
	});
});

describe('browserStore', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('falls back to memory when localStorage throws', () => {
		vi.stubGlobal('localStorage', {
			setItem() {
				throw new Error('SecurityError');
			},
		});
		const store = browserStore();
		store.set('k', 'v');
		expect(store.get('k')).toBe('v');
	});

	it('uses localStorage when it works', () => {
		const backing = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (k: string) => backing.get(k) ?? null,
			setItem: (k: string, v: string) => backing.set(k, v),
			removeItem: (k: string) => backing.delete(k),
			key: (i: number) => [...backing.keys()][i] ?? null,
			get length() {
				return backing.size;
			},
		});
		const store = browserStore();
		store.set('tinkster:x', '1');
		expect(backing.get('tinkster:x')).toBe('1');
		expect(store.keys()).toEqual(['tinkster:x']);
	});
});
