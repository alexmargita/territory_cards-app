const CACHE_NAME = 'territory-cache-v4';
const GITHUB_IMAGES_URL_PATTERN = /^https:\/\/raw\.githubusercontent\.com\/alexmargita\/territory_cards-app\/main\/images\//;
const GOOGLE_SCRIPT_PATTERN = /^https:\/\/script\.google\.com\/macros\/s\//;

const PRECACHE_URLS = [
  'index.html',
  'style.css',
  'script.js'
];

// 1. Встановлення: Кешуємо оболонку додатка
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// 2. Активація: Видаляємо старі версії кешу (v1, v2, v3)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Видалення старого кешу:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Перехоплення запитів
self.addEventListener('fetch', event => {
  const requestUrl = event.request.url;

  // А. ОБРОБКА ДАНИХ GOOGLE (ТЕРИТОРІЇ)
  if (GOOGLE_SCRIPT_PATTERN.test(requestUrl)) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // Якщо інтернет є — зберігаємо свіжу копію
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // Якщо інтернету немає — віддаємо останню збережену копію
          return caches.match(event.request).then(cachedResponse => {
            return cachedResponse || new Response(JSON.stringify({ error: "offline" }), {
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // Б. ОБРОБКА КАРТИНОК ТА СТАТИКИ
  if (GITHUB_IMAGES_URL_PATTERN.test(requestUrl) || PRECACHE_URLS.some(url => requestUrl.includes(url))) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        });
      })
    );
    return;
  }

  // В. ВСЕ ІНШЕ (Стандартна поведінка)
  event.respondWith(
    fetch(event.request).catch(() => caches.match('index.html'))
  );
});