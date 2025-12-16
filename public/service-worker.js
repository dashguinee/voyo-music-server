/**
 * VOYO Music Service Worker
 * Handles caching and offline functionality
 */

const CACHE_NAME = 'voyo-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/icons/voyo-192.svg',
  '/icons/voyo-512.svg'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests (YouTube, API calls)
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Skip Vite dev server resources (HMR, react-refresh, etc.)
  if (event.request.url.includes('@vite') ||
      event.request.url.includes('@react-refresh') ||
      event.request.url.includes('node_modules') ||
      event.request.url.includes('.hot-update')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Return cached version or fetch from network
      return cached || fetch(event.request)
        .then((response) => {
          // Cache successful responses for static assets
          if (response.status === 200 && event.request.url.match(/\.(js|css|svg|png|jpg|webp)$/)) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Network error - return cached if available, otherwise fail silently
          return cached || new Response('', { status: 408, statusText: 'Request timeout' });
        });
    })
  );
});

// Handle skip waiting message
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
