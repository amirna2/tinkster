export type Direction = 'up' | 'down' | 'left' | 'right';

export const OPPOSITE: Record<Direction, Direction> = {
	up: 'down',
	down: 'up',
	left: 'right',
	right: 'left',
};

export function classifySwipe(dx: number, dy: number, minDistancePx = 24): Direction | null {
	if (Math.max(Math.abs(dx), Math.abs(dy)) < minDistancePx) return null;
	if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
	return dy > 0 ? 'down' : 'up';
}

const KEYS: Record<string, Direction> = {
	arrowup: 'up',
	arrowdown: 'down',
	arrowleft: 'left',
	arrowright: 'right',
	w: 'up',
	s: 'down',
	a: 'left',
	d: 'right',
};

export function keyToDirection(key: string): Direction | null {
	return KEYS[key.toLowerCase()] ?? null;
}

/**
 * Queues quick successive turns (e.g. a fast up-then-left) so none are lost between game steps.
 * A turn is rejected if it repeats or reverses the last effective direction.
 */
export class TurnBuffer {
	readonly capacity: number;
	#queue: Direction[] = [];

	constructor(capacity = 2) {
		this.capacity = capacity;
	}

	get size(): number {
		return this.#queue.length;
	}

	push(dir: Direction, heading: Direction): boolean {
		const last = this.#queue.at(-1) ?? heading;
		if (dir === last || dir === OPPOSITE[last] || this.#queue.length >= this.capacity) return false;
		this.#queue.push(dir);
		return true;
	}

	next(heading: Direction): Direction {
		return this.#queue.shift() ?? heading;
	}

	clear(): void {
		this.#queue = [];
	}
}

/**
 * Reports swipes anywhere on `el`. A long drag can produce several turns: after each detected
 * swipe the origin resets to the current point. Returns a detach function.
 */
export function attachSwipe(
	el: HTMLElement,
	onSwipe: (dir: Direction) => void,
	minDistancePx = 24,
): () => void {
	let origin: { x: number; y: number; id: number } | null = null;

	const down = (e: PointerEvent) => {
		origin = { x: e.clientX, y: e.clientY, id: e.pointerId };
	};
	const move = (e: PointerEvent) => {
		if (!origin || e.pointerId !== origin.id) return;
		const dir = classifySwipe(e.clientX - origin.x, e.clientY - origin.y, minDistancePx);
		if (!dir) return;
		onSwipe(dir);
		origin = { x: e.clientX, y: e.clientY, id: e.pointerId };
	};
	const up = (e: PointerEvent) => {
		if (origin?.id === e.pointerId) origin = null;
	};

	const previousTouchAction = el.style.touchAction;
	el.style.touchAction = 'none';
	el.addEventListener('pointerdown', down as EventListener);
	el.addEventListener('pointermove', move as EventListener);
	el.addEventListener('pointerup', up as EventListener);
	el.addEventListener('pointercancel', up as EventListener);

	return () => {
		el.removeEventListener('pointerdown', down as EventListener);
		el.removeEventListener('pointermove', move as EventListener);
		el.removeEventListener('pointerup', up as EventListener);
		el.removeEventListener('pointercancel', up as EventListener);
		el.style.touchAction = previousTouchAction;
	};
}
