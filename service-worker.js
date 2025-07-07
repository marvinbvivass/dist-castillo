const CACHE_NAME = 'dist-castillo-cache-v1';
const STATIC_ASSETS_TO_CACHE = [
    './', // Cachea la página principal (index.html)
    './index.html',
    './manifest.json',
    // MODIFICADO: Eliminado 'https://cdn.tailwindcss.com' de la lista de precache
    // debido a problemas de CORS con el Service Worker.
    // Tailwind se cargará directamente desde el CDN cuando la aplicación esté en línea.
    // Para producción, se recomienda instalar Tailwind localmente y purgar el CSS.
    './images/2364.png',
    './images/7458.png',
    './images/1001.png',
    './images/1002.png',
    './images/9876.png',
    './images/no-image.png'
];

// Evento de instalación: cachea los archivos estáticos
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Cacheando archivos estáticos.');
                return cache.addAll(STATIC_ASSETS_TO_CACHE);
            })
            .catch((error) => {
                console.error('[Service Worker] Fallo al cachear durante la instalación:', error);
            })
    );
});

// Evento de activación: limpia cachés antiguas
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activando...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Eliminando caché antigua:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Asegura que el Service Worker tome el control de la página inmediatamente
    return self.clients.claim();
});

// Estrategia de caché: Cache-First para activos estáticos, Network-First para otros
self.addEventListener('fetch', (event) => {
    // Solo maneja solicitudes HTTP(S) para evitar errores con chrome-extension://
    if (event.request.url.startsWith('http')) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                // Si el recurso está en caché, lo devuelve
                if (cachedResponse) {
                    return cachedResponse;
                }
                // Si no está en caché, intenta obtenerlo de la red
                return fetch(event.request).then((networkResponse) => {
                    // Si la respuesta de la red es válida, la cachea y la devuelve
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch((error) => {
                    console.error('[Service Worker] Fallo en la solicitud de red:', event.request.url, error);
                    // Puedes devolver una página offline aquí si lo deseas
                    // return caches.match('/offline.html');
                });
            })
        );
    }
});
