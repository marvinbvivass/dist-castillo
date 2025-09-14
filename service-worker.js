// --- Service Worker Mejorado para Funcionalidad Offline Robusta ---

const CACHE_NAME = 'ventas-app-cache-v4'; // Versión actualizada para forzar la recarga de la caché

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
self.addEventListener('install', event => {
    console.log('[Service Worker] Instalando...');
    self.skipWaiting(); // Forzar la activación inmediata
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Guardando App Shell en caché.');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('[Service Worker] Falló el precaching del App Shell:', error);
            })
    );
});

// Evento 'activate': Se dispara cuando el nuevo Service Worker se activa.
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

// Evento 'fetch': Se dispara para cada solicitud de red.
self.addEventListener('fetch', event => {
    // No interceptamos solicitudes que no sean GET
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Estrategia para las solicitudes de navegación (abrir la página)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => caches.match('./index.html')) // Si falla la red, sirve el index.html principal
        );
        return;
    }

    // Estrategia para otros recursos (CSS, JS, imágenes, etc.)
    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // Si la respuesta de red es válida, la usamos y actualizamos la caché
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME)
                    .then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                return networkResponse;
            })
            .catch(() => {
                // Si la red falla, intentamos servir desde la caché
                return caches.match(event.request)
                    .then(cachedResponse => {
                        // Si encontramos una respuesta en caché, la retornamos
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // Si no está en caché y no hay red, la solicitud fallará naturalmente.
                        // Esto es correcto para las peticiones de Firebase que no cacheamos.
                        return new Response('Contenido no disponible sin conexión.', {
                            status: 404,
                            statusText: 'Not Found'
                        });
                    });
            })
    );
});



