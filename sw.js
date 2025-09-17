const CACHE_NAME = 'territory-cache-v2'; // Оновлена версія кешу
const GITHUB_IMAGES_URL_PATTERN = /^https:\/\/raw\.githubusercontent\.com\/alexmargita\/territory_cards-app\/main\/images\//;

// Основні файли додатку для негайного кешування
const PRECACHE_URLS = [
  '/',
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
      .then(() => self.skipWaiting()) // Активуємо новий Service Worker одразу
  );
});

self.addEventListener('activate', event => {
  // Видаляємо старі версії кешу
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

  // Стратегія "Cache First" для зображень з GitHub
  if (GITHUB_IMAGES_URL_PATTERN.test(requestUrl.href)) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse; // Повертаємо з кешу, якщо є
        }
        // Якщо в кеші немає, завантажуємо і кешуємо
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
  
  // Стратегія "Network First" для основних файлів, щоб отримувати оновлення
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      })
      .catch(() => {
        // Якщо мережа недоступна, повертаємо з кешу
        return caches.match(event.request);
      })
  );
});