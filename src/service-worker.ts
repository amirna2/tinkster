/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { cacheKey } from '$lib/platform/sw-paths';
import { build, files, prerendered, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `tinkster-${version}`;
const PRECACHE = [...build, ...files, ...prerendered];
const KEYS = new Set(PRECACHE.map((path) => cacheKey(new URL(path, sw.location.href))));
const ROOT = cacheKey(new URL(sw.registration.scope));

async function precache(): Promise<void> {
	const cache = await caches.open(CACHE);
	await Promise.all(
		PRECACHE.map(async (path) => {
			const url = new URL(path, sw.location.href);
			const res = await fetch(url, { cache: 'reload' });
			if (!res.ok) throw new Error(`precache failed: ${path} (${res.status})`);
			// A redirected response (e.g. /tinkster → /tinkster/) can't answer a navigation, so re-wrap it.
			const body = res.redirected
				? new Response(await res.blob(), { status: res.status, headers: res.headers })
				: res;
			await cache.put(cacheKey(url), body);
		}),
	);
}

sw.addEventListener('install', (event) => {
	// No skipWaiting(): a new version takes over on the next launch, never mid-game.
	event.waitUntil(precache());
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
			await sw.clients.claim();
		})(),
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;
	const key = cacheKey(url);

	if (KEYS.has(key)) {
		event.respondWith(
			caches
				.open(CACHE)
				.then((cache) => cache.match(key))
				.then((hit) => hit ?? fetch(request)),
		);
	} else if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request).catch(async () => {
				const cache = await caches.open(CACHE);
				return (await cache.match(ROOT)) ?? Response.error();
			}),
		);
	}
});
