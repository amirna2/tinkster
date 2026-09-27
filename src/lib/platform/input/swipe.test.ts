import { describe, expect, it, vi } from 'vitest';
import { attachSwipe, classifySwipe, keyToDirection, TurnBuffer } from './swipe';

describe('classifySwipe', () => {
	it('ignores movement shorter than the threshold', () => {
		expect(classifySwipe(10, 5)).toBeNull();
		expect(classifySwipe(23, 0)).toBeNull();
	});

	it('picks the dominant axis', () => {
		expect(classifySwipe(40, 10)).toBe('right');
		expect(classifySwipe(-40, 10)).toBe('left');
		expect(classifySwipe(5, 40)).toBe('down');
		expect(classifySwipe(5, -40)).toBe('up');
	});

	it('honors a custom threshold', () => {
		expect(classifySwipe(30, 0, 50)).toBeNull();
	});
});

describe('keyToDirection', () => {
	it('maps arrows and WASD', () => {
		expect(keyToDirection('ArrowUp')).toBe('up');
		expect(keyToDirection('a')).toBe('left');
		expect(keyToDirection('S')).toBe('down');
		expect(keyToDirection('d')).toBe('right');
		expect(keyToDirection('x')).toBeNull();
	});
});

describe('TurnBuffer', () => {
	it('queues up to capacity turns and replays them in order', () => {
		const b = new TurnBuffer(2);
		expect(b.push('up', 'right')).toBe(true);
		expect(b.push('left', 'right')).toBe(true);
		expect(b.push('down', 'right')).toBe(false); // full
		expect(b.next('right')).toBe('up');
		expect(b.next('up')).toBe('left');
		expect(b.next('left')).toBe('left'); // empty → keep heading
	});

	it('rejects a reversal or a repeat of the last effective direction', () => {
		const b = new TurnBuffer(2);
		expect(b.push('left', 'right')).toBe(false); // reverse of heading
		expect(b.push('right', 'right')).toBe(false); // same as heading
		expect(b.push('up', 'right')).toBe(true);
		expect(b.push('down', 'right')).toBe(false); // reverse of queued 'up'
		expect(b.size).toBe(1);
	});

	it('clear() empties the queue', () => {
		const b = new TurnBuffer();
		b.push('up', 'right');
		b.clear();
		expect(b.size).toBe(0);
	});
});

describe('attachSwipe', () => {
	const pointer = (type: string, x: number, y: number, id = 1) =>
		Object.assign(new Event(type), { clientX: x, clientY: y, pointerId: id });

	const fakeElement = () => {
		const target = new EventTarget();
		return Object.assign(target, { style: { touchAction: '' } }) as unknown as HTMLElement;
	};

	it('emits one direction per threshold crossed during a continuous drag', () => {
		const el = fakeElement();
		const onSwipe = vi.fn();
		attachSwipe(el, onSwipe);
		el.dispatchEvent(pointer('pointerdown', 0, 0));
		el.dispatchEvent(pointer('pointermove', 30, 2));
		el.dispatchEvent(pointer('pointermove', 32, 40));
		el.dispatchEvent(pointer('pointerup', 32, 40));
		el.dispatchEvent(pointer('pointermove', 90, 40)); // after release: ignored
		expect(onSwipe.mock.calls).toEqual([['right'], ['down']]);
	});

	it('detach() removes listeners and restores touch-action', () => {
		const el = fakeElement();
		const onSwipe = vi.fn();
		const detach = attachSwipe(el, onSwipe);
		expect(el.style.touchAction).toBe('none');
		detach();
		expect(el.style.touchAction).toBe('');
		el.dispatchEvent(pointer('pointerdown', 0, 0));
		el.dispatchEvent(pointer('pointermove', 60, 0));
		expect(onSwipe).not.toHaveBeenCalled();
	});
});
