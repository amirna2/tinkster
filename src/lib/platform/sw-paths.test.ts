import { describe, expect, it } from 'vitest';
import { cacheKey } from './sw-paths';

describe('cacheKey', () => {
	it('drops a trailing slash (GitHub Pages redirects /tinkster to /tinkster/)', () => {
		expect(cacheKey(new URL('https://x.io/tinkster/'))).toBe('/tinkster');
	});

	it('ignores the query string', () => {
		expect(cacheKey(new URL('https://x.io/tinkster/play/a?seed=1'))).toBe('/tinkster/play/a');
	});

	it('keeps the root path', () => {
		expect(cacheKey(new URL('https://x.io/'))).toBe('/');
	});
});
