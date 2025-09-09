const CACHE_NAME = 'ventas-app-cache-v1';
const urlsToCache = [
    './index.html',
    './', // Alias para index.html
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js',
    './manifest.json', // Es buena práctica cachear el manifest también
    './images/icons/icon-192x192.png',
    './images/icons/icon-512x512.png'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache and caching URLs');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Si la respuesta está en la caché, la retornamos
                if (response) {
                    return response;
                }
                // Si no, la buscamos en la red
                return fetch(event.request).then(
                    (networkResponse) => {
                        // Opcional: si queremos actualizar la caché dinámicamente
                        // if(networkResponse && networkResponse.status === 200) {
                        //     const responseToCache = networkResponse.clone();
                        //     caches.open(CACHE_NAME)
                        //         .then(cache => {
                        //             cache.put(event.request, responseToCache);
                        //         });
                        // }
                        return networkResponse;
                    }
                );
            })
    );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        // Borramos las cachés viejas
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
