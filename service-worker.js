// Service Worker для DAB Dashboard
// Версия — меняйте при каждом обновлении, чтобы сбросить кэш
const CACHE_VERSION = 'dab-v1.0.0';
const CACHE_NAME = `${CACHE_VERSION}-static`;

// Файлы для кэширования при установке
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Установка — кэшируем основные файлы
self.addEventListener('install', (event) => {
  console.log('[SW] Установка', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_URLS).catch((err) => {
          console.warn('[SW] Не удалось закэшировать всё:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Активация — удаляем старые кэши
self.addEventListener('activate', (event) => {
  console.log('[SW] Активация', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Удаляю старый кэш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Стратегия: Cache First, Network Fallback
// Сначала смотрим кэш, если нет — идём в сеть и кэшируем ответ
self.addEventListener('fetch', (event) => {
  // Пропускаем не-GET запросы
  if (event.request.method !== 'GET') return;

  // Пропускаем запросы к внешним доменам (например, Google Fonts)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Фоновое обновление кэша (stale-while-revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => { /* офлайн — ок */ });
        return cachedResponse;
      }

      // Нет в кэше — идём в сеть
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // Офлайн и нет кэша — отдаём index.html для навигации
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});

// Обработка сообщений от страницы (например, пропустить ожидание)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});