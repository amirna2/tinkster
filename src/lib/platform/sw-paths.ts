/** Normalized cache key: path only, no trailing slash (except "/"), no query string. */
export function cacheKey(url: URL): string {
	const path = url.pathname;
	return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}
