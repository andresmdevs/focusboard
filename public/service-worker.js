// Service worker de Focusboard.
//
// Astro genera assets con nombre "hasheado" (p. ej. /_astro/index.Ab12.js),
// así que en lugar de una lista fija de precache usamos estrategias en
// tiempo de ejecución que funcionan con cualquier nombre de archivo:
//   - Navegaciones (HTML): network-first -> si no hay red, cae al caché
//     y como último recurso a la portada cacheada.
//   - Resto de assets same-origin (JS/CSS/íconos): cache-first -> red.
// Así la app abre offline tras la primera visita y siempre sirve HTML
// fresco cuando hay conexión.

const CACHE_NAME = "focusboard-v3";
const OFFLINE_URL = "/";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // no tocamos peticiones externas

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL)))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
