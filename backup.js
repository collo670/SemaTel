const CACHE_NAME = 'sematel-v4';
const ASSETS = ['./', './index.html', './manifest.json', './sw.js'];

function isHtmlRequest(request) {
  return request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS).catch(() => cache.add('./index.html')))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isAppShell = sameOrigin && (
    url.pathname.endsWith('index.html') ||
    url.pathname.endsWith('/') ||
    url.pathname === '' ||
    url.pathname.endsWith('/SemaTel/') ||
    url.pathname.endsWith('/SemaTel')
  );

  if (isHtmlRequest(event.request) || isAppShell) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;
        if (response.type === 'basic' || response.type === 'cors') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            try { cache.put(event.request, clone); } catch (e) { /* opaque */ }
          });
        }
        return response;
      }).catch(() => undefined);
    })
  );
});

async function notifyClientsSync() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach(client => client.postMessage({ type: 'SYNC_COMPLETE' }));
}

self.addEventListener('sync', event => {
  if (event.tag === 'sematel-sync-tx') {
    event.waitUntil(notifyClientsSync());
  }
});

self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data.type === 'QUEUE_TX') {
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache =>
        cache.put(
          new Request('sematel-offline-queue'),
          new Response(JSON.stringify({ queued: true, at: Date.now() }), {
            headers: { 'Content-Type': 'application/json' }
          })
        )
      ).then(() => {
        if (self.registration.sync) {
          return self.registration.sync.register('sematel-sync-tx');
        }
      }).catch(() => notifyClientsSync())
    );
  }
});

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'SemaTel', body: 'Transaction update' };
  event.waitUntil(
    self.registration.showNotification(data.title || 'SemaTel', {
      body: data.body || 'Your transaction was processed.',
      icon: './manifest.json',
      badge: './manifest.json'
    })
  );
});
