const CACHE_NAME = "kuntorastit";
const URLS_TO_CACHE = [
    "index.html",
    "dist/kuntorastit.mjs",
    "data/events.json",
    "icon-192.png",
];
self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE)));
});
self.addEventListener("fetch", (event) => {
    event.respondWith(caches.match(event.request).then((response) => response || fetch(event.request)));
});
