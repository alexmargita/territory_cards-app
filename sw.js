const CACHE_NAME = 'territory-cache-v3';
const GITHUB_IMAGES_URL_PATTERN = /^https:\/\/raw\.githubusercontent\.com\/alexmargita\/territory_cards-app\/main\/images\//;

const PRECACHE_URLS = [
  'index.html',
  'style.css',
  'script.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and precaching files');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  if (GITHUB_IMAGES_URL_PATTERN.test(requestUrl.href)) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then(networkResponse => {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        });
      })
    );
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request.url)
            .then(response => {
                // Повертаємо кешовану версію, якщо є, або index.html для навігації
                return response || caches.match('index.html');
            });
      })
  );
});