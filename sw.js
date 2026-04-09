// Service Worker para ExamenApp PWA
const CACHE_NAME = 'examenapp-v18';
const ASSETS_TO_CACHE = [
  './',
  './examenalumno.html',
  './manifest.json'
];

// Instalación - cachear recursos esenciales
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cacheando recursos esenciales');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('[SW] Instalación completa');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] Error en instalación:', err);
      })
  );
});

// Activación - limpiar caches antiguos
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando Service Worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Eliminando cache antiguo:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activado');
        return self.clients.claim();
      })
  );
});

// Fetch - estrategia Cache First con fallback a Network
self.addEventListener('fetch', (event) => {
  // Solo cachear requests GET
  if (event.request.method !== 'GET') return;

  // Ignorar requests de extensiones, analytics, etc.
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[SW] Sirviendo desde cache:', event.request.url);
          return cachedResponse;
        }

        console.log('[SW] Buscando en red:', event.request.url);
        return fetch(event.request)
          .then((networkResponse) => {
            // Cachear la respuesta para futuro uso
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
          })
          .catch((err) => {
            console.error('[SW] Error de red:', err);
            // Aquí podríamos retornar una página offline si la tuviéramos
          });
      })
  );
});

// Mensaje desde la app principal
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
