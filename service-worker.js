// service-worker.js — кэширует «оболочку» приложения, чтобы P2PHub
// открывался даже без интернета (Этап 2).

const CACHE = "p2phub-v5";

// Файлы самого приложения (всё своё, без CDN — их кэшируем заранее).
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// Установка: складываем оболочку в кэш.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Активация: удаляем старые версии кэша.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Запросы:
//  - свои файлы (тот же origin) -> сначала кэш, потом сеть;
//  - чужие (CDN библиотек WebTorrent/PeerJS) -> всегда сеть, не кэшируем.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const sameOrigin = new URL(req.url).origin === self.location.origin;
  if (!sameOrigin) return; // пусть идёт в сеть как обычно

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((resp) => {
          // подкладываем свежие свои файлы в кэш
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return resp;
        })
        .catch(() => cached);
    })
  );
});
