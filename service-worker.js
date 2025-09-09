const CACHE_NAME = 'ventas-app-cache-v2'; // Incrementamos la versión para forzar la actualización
const urlsToCache = [
    './index.html',
    './', // Alias para index.html
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js',
    './manifest.json',
    './images/icons/icon-192x192.png',
    './images/icons/icon-512x512.png',
    './images/fondo.png' // Agregamos la imagen de fondo a la caché
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache opened, caching files.');
                // Solución para el error de CORS
                // Creamos un array de Requests en modo 'no-cors' para las URLs externas
                const requests = urlsToCache.map(url => {
                    if (url.startsWith('http')) {
                        return new Request(url, { mode: 'no-cors' });
                    }
                    return url;
                });
                return cache.addAll(requests);
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
                return fetch(event.request);
            })
    );
});

self.addEventListener('activate', event => {
    // Eliminamos las cachés antiguas para mantener todo limpio
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

