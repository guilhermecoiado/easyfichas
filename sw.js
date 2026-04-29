const CACHE_NAME = "easyfichas-v2";
const APP_SHELL = [
	"./",
	"./index.html",
	"./style.css",
	"./app.js",
	"./ui.js",
	"./config.js",
	"./sheets.js",
	"./manifest.json",
	"./icon-192.png",
	"./icon-512.png"
];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(
				keys
					.filter((key) => key !== CACHE_NAME)
					.map((oldKey) => caches.delete(oldKey))
			)
		).then(() => self.clients.claim())
	);
});

self.addEventListener("fetch", (event) => {
	if (event.request.method !== "GET") return;

	const requestUrl = new URL(event.request.url);
	const isSameOrigin = requestUrl.origin === self.location.origin;

	if (!isSameOrigin) return;

	event.respondWith(
		caches.match(event.request).then((cached) => {
			if (cached) return cached;

			return fetch(event.request).then((networkResponse) => {
				if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
					return networkResponse;
				}

				const responseToCache = networkResponse.clone();
				caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
				return networkResponse;
			});
		})
	);
});self.addEventListener('fetch', function(event) {});
