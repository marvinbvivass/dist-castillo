// Nombre del caché. Incrementa este número para forzar la actualización de todos los archivos en los navegadores.
const CACHE_NAME = 'gestion-ventas-v1';

// Archivos que se almacenarán en caché
const urlsToCache = [
    '/',
    '/index.html',
    '/ventas.js',
    'https://cdn.tailwindcss.com',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
];

// Evento de instalación: Almacena en caché los archivos estáticos
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caché abierto, precargando archivos.');
                return cache.addAll(urlsToCache);
            })
    );
});

// Evento de activación: Elimina cachés antiguos
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.filter((cacheName) => cacheName !== CACHE_NAME)
                    .map((cacheName) => caches.delete(cacheName))
            );
        })
    );
});

// Evento de obtención (fetch): Sirve archivos desde el caché si están disponibles
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Si la solicitud está en caché, la devuelve
                if (response) {
                    return response;
                }
                // Si no, la busca en la red
                return fetch(event.request);
            })
    );
});
