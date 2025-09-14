// --- Service Worker Mejorado para Funcionalidad Offline Robusta ---

const CACHE_NAME = 'ventas-app-cache-v3'; // Versión actualizada para forzar la recarga de la caché

// Lista de archivos esenciales para el funcionamiento de la aplicación (App Shell)
const urlsToCache = [
    './', // Alias para index.html
    './index.html',
    './inventario.js',
    './catalogo.js',
    './sincronizacion.js',
    './manifest.json',
    './images/icons/icon-192x192.png',
    './images/icons/icon-512x512.png',
    './images/fondo.png',
    './images/cervezayvinos.png',
    './images/maltinypepsi.png',
    './images/alimentospolar.png',
    './images/p&g.png',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
];

// Evento 'install': Se dispara cuando el Service Worker se instala por primera vez.
// Aquí es donde pre-cacheamos nuestro App Shell.
self.addEventListener('install', event => {
    console.log('[Service Worker] Instalando...');
    self.skipWaiting(); // Forzar la activación inmediata del nuevo Service Worker
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Abriendo caché y guardando el App Shell.');
                // cache.addAll manejará las solicitudes a los CDNs correctamente sin 'no-cors'
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('[Service Worker] Falló el precaching del App Shell:', error);
            })
    );
});

// Evento 'activate': Se dispara cuando el nuevo Service Worker se activa.
// Aquí limpiamos las cachés antiguas que ya no se necesitan.
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activando...');
    const cacheWhitelist = [CACHE_NAME];
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log(`[Service Worker] Eliminando caché antigua: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Evento 'fetch': Se dispara cada vez que la aplicación realiza una solicitud de red (ej. un script, una imagen, una API).
// Implementamos la estrategia "Network Falling Back to Cache".
self.addEventListener('fetch', event => {
    // Solo interceptamos las solicitudes GET, no las de POST a Firebase, etc.
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // Si la solicitud a la red fue exitosa, la usamos y la guardamos en caché para futuras peticiones offline.
                // Es importante clonar la respuesta, ya que solo se puede consumir una vez.
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME)
                    .then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                return networkResponse;
            })
            .catch(() => {
                // Si la solicitud a la red falla (estamos offline), intentamos obtener la respuesta desde la caché.
                console.log(`[Service Worker] Sin conexión. Sirviendo desde caché: ${event.request.url}`);
                return caches.match(event.request);
            })
    );
});
