// Service Worker otimizado com estratégia Stale-While-Revalidate
const CACHE_NAME = 'vorix-cache-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/manifest.json'
];

// Instalação: Cacheia arquivos essenciais
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Ativação: Limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Estratégia Stale-While-Revalidate
// Serve do cache imediatamente e atualiza em background
self.addEventListener('fetch', (event) => {
  // Ignora requisições para APIs externas (Supabase, MercadoPago, etc)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Ignora requisições POST ou outras que não sejam GET
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchedResponse = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Se falhar a rede, já temos o cachedResponse (se houver)
        });

        // Retorna o cache se existir, senão espera a rede
        return cachedResponse || fetchedResponse;
      });
    })
  );
});
