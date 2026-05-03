// ═══════════════════════════════════════════════════════════
//  SyncU — Service Worker v2
//  Cache-first para assets · Network-first para HTML
//  + Firebase Cloud Messaging (background push)
// ═══════════════════════════════════════════════════════════

// ── Firebase Messaging (debe ir primero) ─────────────────
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  projectId:         'syncu-3abec',
  appId:             '1:287232013909:web:d05003a489fa0190e806dc',
  messagingSenderId: '287232013909',
});

var messaging = firebase.messaging();

// ── Background push handler ───────────────────────────────
messaging.onBackgroundMessage(function(payload) {
  var notification = payload.notification || {};
  var data         = payload.data         || {};

  var title = notification.title || 'SyncU ⚡';
  var body  = notification.body  || '';
  var icon  = notification.icon  || '/syncu/assets/icons/icon-192.png';

  var senderUid = data.senderUid || String(Date.now());

  self.registration.showNotification(title, {
    body:               body,
    icon:               icon,
    badge:              '/syncu/assets/icons/icon-72.png',
    tag:                'syncu-libre-' + senderUid,
    data:               data,
    requireInteraction: false,
    vibrate:            [100, 50, 100],
  });
});

// ── Notification click ────────────────────────────────────
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var data   = event.notification.data || {};
  var url    = data.click_action ||
               'https://felipemoralesm.github.io/syncu/pages/comparador.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(list) {
        for (var i = 0; i < list.length; i++) {
          if (list[i].url === url && 'focus' in list[i]) {
            return list[i].focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});

// ═══════════════════════════════════════════════════════════
//  PWA CACHE
// ═══════════════════════════════════════════════════════════
var CACHE_NAME   = 'syncu-v2';
var OFFLINE_PAGE = '/syncu/offline.html';

var PRECACHE = [
  '/syncu/',
  '/syncu/index.html',
  '/syncu/pages/home.html',
  '/syncu/pages/mi-horario.html',
  '/syncu/pages/amigos.html',
  '/syncu/pages/grupos.html',
  '/syncu/pages/comparador.html',
  '/syncu/pages/perfil.html',
  '/syncu/manifest.json',
  '/syncu/css/estilos.css',
  '/syncu/js/sounds.js',
];

// ── INSTALL ───────────────────────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.allSettled(
        PRECACHE.map(function(url) {
          return cache.add(url).catch(function(e) {
            console.warn('[SW] No pre-cached:', url, e);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE ──────────────────────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(k) { return k !== CACHE_NAME; })
          .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// ── FETCH ─────────────────────────────────────────────────
self.addEventListener('fetch', function(event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);

  // Dejar pasar peticiones de Firebase / FCM sin interceptar
  if (
    url.hostname.indexOf('firebasedatabase') !== -1 ||
    url.hostname.indexOf('fcm.googleapis')   !== -1 ||
    (url.hostname.indexOf('firebase') !== -1 &&
     url.pathname.indexOf('/v1/')     !== -1)
  ) return;

  var isStatic = /\.(js|css|png|jpg|jpeg|svg|gif|woff2?|ttf|ico)$/i.test(url.pathname);
  var isFont   = url.hostname.indexOf('fonts.googleapis') !== -1 ||
                 url.hostname.indexOf('fonts.gstatic')    !== -1;

  if (isStatic || isFont) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});

// ── Cache-first ───────────────────────────────────────────
function cacheFirst(req) {
  return caches.match(req).then(function(cached) {
    if (cached) return cached;
    return fetch(req).then(function(res) {
      if (res && res.status === 200) {
        caches.open(CACHE_NAME).then(function(c) { c.put(req, res.clone()); });
      }
      return res;
    }).catch(function() {
      return new Response('Asset offline.', { status: 503 });
    });
  });
}

// ── Network-first ─────────────────────────────────────────
function networkFirst(req) {
  return fetch(req).then(function(res) {
    if (res && res.status === 200) {
      caches.open(CACHE_NAME).then(function(c) { c.put(req, res.clone()); });
    }
    return res;
  }).catch(function() {
    return caches.match(req).then(function(cached) {
      if (cached) return cached;
      if (req.mode === 'navigate') {
        return caches.match(OFFLINE_PAGE).then(function(offlinePage) {
          return offlinePage || new Response(
            '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
            '<title>SyncU offline</title>' +
            '<style>body{margin:0;background:#0D0D0D;color:#fff;' +
            "font-family:'Space Grotesk',sans-serif;" +
            'display:flex;align-items:center;justify-content:center;' +
            'min-height:100vh;flex-direction:column;gap:1rem}' +
            'h1{color:#FF6B00;font-size:2.5rem}</style></head>' +
            '<body><h1>SyncU ⚡</h1><p style="color:#888">Sin conexión.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        });
      }
      return new Response('Sin conexión.', { status: 503 });
    });
  });
}
