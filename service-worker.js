// service-worker.js

const CACHE_NAME = 'dist-castillo-cache-v1';
const urlsToCache = [
  '/', // La raíz de tu aplicación
  '/index.html',
  'https://cdn.tailwindcss.com', // Cacha el CDN de Tailwind
  'https://www.gstatic.com/firebasejs/9.6.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.6.0/firebase-analytics-compat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  // Puedes añadir más recursos estáticos aquí si los tienes (imágenes, otros JS, CSS)
  // Por ejemplo: '/images/logo.png', '/styles/main.css'
];

// Evento 'install': Se ejecuta cuando el Service Worker se instala por primera vez
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Cacheando archivos estáticos.');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('[Service Worker] Fallo al cachear durante la instalación:', error);
      })
  );
});

// Evento 'activate': Se ejecuta cuando el Service Worker se activa
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
  // Asegura que el Service Worker tome el control de las páginas existentes inmediatamente
  return self.clients.claim();
});

// Evento 'fetch': Se ejecuta cada vez que el navegador solicita un recurso
self.addEventListener('fetch', (event) => {
  // Solo interceptar peticiones HTTP/HTTPS (no extensiones, etc.)
  if (event.request.url.startsWith('http')) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          // Si el recurso está en caché, lo devuelve
          if (response) {
            console.log(`[Service Worker] Sirviendo desde caché: ${event.request.url}`);
            return response;
          }
          // Si no está en caché, va a la red
          console.log(`[Service Worker] Fetching desde la red: ${event.request.url}`);
          return fetch(event.request)
            .then((networkResponse) => {
              // Intenta cachear la respuesta si es válida
              if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(event.request, responseToCache);
                  });
              }
              return networkResponse;
            })
            .catch((error) => {
              console.error('[Service Worker] Fallo en la petición de red:', error);
              // Aquí podrías servir una página offline si la tuvieras cacheada
              // return caches.match('/offline.html');
            });
        })
    );
  }
});
