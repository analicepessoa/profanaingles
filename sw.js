const CACHE_NAME = 'portal-aulas-cache-v4';
const SUPABASE_CLIENT_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
const APP_SHELL = ['./index.html', './manifest.json'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async (cache) => {
                await cache.addAll(APP_SHELL);
                // Uma falha no CDN não deve impedir a instalação do portal.
                try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 8000);
                    try {
                        const response = await fetch(SUPABASE_CLIENT_URL, { signal: controller.signal });
                        if (response.ok) await cache.put(SUPABASE_CLIENT_URL, response);
                    } finally {
                        clearTimeout(timeout);
                    }
                } catch (error) {
                    console.warn('Biblioteca externa será salva quando estiver disponível.', error);
                }
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key.startsWith('portal-aulas-cache-') && key !== CACHE_NAME).map((key) => caches.delete(key))
            ))
            .then(() => clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    if (event.request.method !== 'GET') return;

    if (requestUrl.href === SUPABASE_CLIENT_URL) {
        event.respondWith(caches.match(event.request).then(async (cached) => {
            if (cached) return cached;
            const response = await fetch(event.request);
            if (response.ok) {
                const cache = await caches.open(CACHE_NAME);
                await cache.put(event.request, response.clone());
            }
            return response;
        }));
        return;
    }

    if (requestUrl.origin !== self.location.origin) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response.ok) {
                    const copy = response.clone();
                    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {}));
                }
                if (!response.ok && event.request.mode === 'navigate') {
                    return caches.match('./index.html').then((cached) => cached || response);
                }
                return response;
            })
            .catch(async () => {
                const cached = await caches.match(event.request);
                if (cached) return cached;
                if (event.request.mode === 'navigate') {
                    const page = await caches.match('./index.html');
                    if (page) return page;
                }
                return Response.error();
            })
    );
});
