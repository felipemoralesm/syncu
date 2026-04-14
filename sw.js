// ══════════════════════════════════════════════════════════════
//  SyncU — Service Worker
//  Estrategia: Cache-first para assets estáticos,
//              Network-first para páginas y API calls.
// ══════════════════════════════════════════════════════════════

const CACHE_NAME    = 'syncu-v1';
const OFFLINE_PAGE  = '/offline.html';

// Recursos que se cachean en la instalación (precache)
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/pages/registro.html',
  '/manifest.json',
  '/offline.html',
  // Agrega aquí tus assets: CSS, JS, íconos, etc.
  // '/assets/icons/icon-192.png',
  // '/assets/icons/icon-512.png',
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Instalando SyncU v1…');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-cacheando assets estáticos');
      // addAll falla si algún recurso no está disponible,
      // por eso usamos add individual con catch para no romper el install.
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url =>
          cache.add(url).catch(err =>
            console.warn(`[SW] No se pudo cachear ${url}:`, err)
          )
        )
      );
    })
  );
  // Activa el nuevo SW de inmediato sin esperar a que cierren las pestañas
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activando…');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Eliminando caché antigua:', key);
            return caches.delete(key);
          })
      )
    )
  );
  // Toma control de todas las páginas inmediatamente
  self.clients.claim();
});

// ── FETCH ─────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar peticiones no-GET y peticiones a Firebase / terceros
  if (request.method !== 'GET') return;
  if (
    url.origin !== self.location.origin &&
    !url.hostname.includes('fonts.googleapis.com') &&
    !url.hostname.includes('fonts.gstatic.com')
  ) return;

  // Recursos estáticos (JS, CSS, fuentes, imágenes) → Cache-first
  const isStaticAsset = /\.(js|css|png|jpg|jpeg|svg|gif|woff2?|ttf|ico)$/i.test(url.pathname);
  if (isStaticAsset) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Páginas HTML → Network-first con fallback a caché y offline
  event.respondWith(networkFirst(request));
});

// ── Estrategia: Cache-first ───────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Asset no disponible offline.', { status: 503 });
  }
}

// ── Estrategia: Network-first ─────────────────────────────────
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Si es navegación, mostrar página offline
    if (request.mode === 'navigate') {
      const offline = await caches.match(OFFLINE_PAGE);
      return offline || new Response(
        `<!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>SyncU — Sin conexión</title>
          <style>
            body { margin:0; background:#0D0D0D; color:#fff;
                   font-family:'Space Grotesk',sans-serif;
                   display:flex; align-items:center; justify-content:center;
                   min-height:100vh; flex-direction:column; gap:1rem; }
            h1 { color:#FF6B00; font-size:2.5rem; }
            p  { color:#888; }
          </style>
        </head>
        <body>
          <h1>SyncU ⚡</h1>
          <p>Sin conexión. Reconéctate para continuar.</p>
        </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    return new Response('Sin conexión.', { status: 503 });
  }
}

// ── PUSH NOTIFICATIONS (preparado para futuro) ───────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'SyncU ⚡';
  const options = {
    body:  data.body  || 'Tienes una nueva notificación.',
    icon:  '/assets/icons/icon-192.png',
    badge: '/assets/icons/icon-72.png',
    data:  { url: data.url || '/' },
    vibrate: [100, 50, 100],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url === targetUrl && 'focus' in c);
      return existing ? existing.focus() : clients.openWindow(targetUrl);
    })
  );
});
