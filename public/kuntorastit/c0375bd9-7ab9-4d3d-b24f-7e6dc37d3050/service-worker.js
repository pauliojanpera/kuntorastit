// Cache name with UUID placeholder (replaced at build time)
const CACHE_NAME = "kuntorastit-c0375bd9-7ab9-4d3d-b24f-7e6dc37d3050";
const URLS_TO_CACHE = [
    "./index.html",
    "./dist/kuntorastit.mjs",
    "./data/events.json",
    "./icon-192.png",
];
// Install event: Cache assets
self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE)));
});
// Activate event: Clean up old caches
self.addEventListener("activate", (event) => {
    event.waitUntil(caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames
            .filter((name) => name.startsWith("kuntorastit-") && name !== CACHE_NAME)
            .map((name) => caches.delete(name)));
    }));
});
// Fetch event: Network-first with cache fallback
self.addEventListener("fetch", (event) => {
    event.respondWith((async () => {
        try {
            const response = await fetch(event.request);
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
            });
            return response;
        }
        catch (e) {
            return ((await caches.match(event.request)) ??
                new Response('Offline content unavailable', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: { 'Content-Type': 'text/plain' }
                }));
        }
    })());
});
// Handle skipWaiting message
self.addEventListener("message", (event) => {
    if (event.data && event.data.action === "skipWaiting") {
        self.skipWaiting();
    }
});

