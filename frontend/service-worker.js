const cacheName = "chatlink-pwa-v1";
const assetsToCache = [
  "./",
  "./index.html",
  "./login.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(cacheName)
      .then((cache) => cache.addAll(assetsToCache))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then(
        (response) => response || fetch(event.request)
      )
  );
});
