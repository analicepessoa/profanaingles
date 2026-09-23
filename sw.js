const CACHE_NAME = 'portal-aulas-cache-v2';
const SUPABASE_CLIENT_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
const APP_SHELL = ['./', './index.html', './manifest.json', './sw.js', SUPABASE_CLIENT_URL];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            ))
            .then(() => clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    if (event.request.method !== 'GET') return;

    if (requestUrl.href === SUPABASE_CLIENT_URL) {
        event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
        return;
    }

    if (requestUrl.origin !== self.location.origin) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                }
                return response;
            })
            .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
});
