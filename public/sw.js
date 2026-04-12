// FinanceOS Service Worker — Offline-first with background sync
const CACHE_VERSION = 'v2';
const STATIC_CACHE = `financeos-static-${CACHE_VERSION}`;
const API_CACHE = `financeos-api-${CACHE_VERSION}`;
const SYNC_TAG = 'financeos-sync';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/favicon.ico',
];

// API routes to cache for offline reads
const CACHEABLE_API_PATTERNS = [
  /\/api\/dashboard/,
  /\/api\/transactions/,
  /\/api\/accounts/,
  /\/api\/categories/,
  /\/api\/budgets/,
  /\/api\/loans/,
  /\/api\/investments/,
  /\/api\/subscriptions/,
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => {}) // don't fail if any asset 404s
    ).then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests for caching (but let them pass through)
  if (request.method !== 'GET') return;

  // Skip chrome-extension, websockets, etc.
  if (!url.protocol.startsWith('http')) return;

  // API routes — network-first, fall back to cache
  if (url.pathname.startsWith('/api/') && CACHEABLE_API_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(networkFirstWithCache(request, API_CACHE));
    return;
  }

  // Navigation requests — network-first, fall back to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/dashboard') ?? caches.match('/')
      )
    );
    return;
  }

  // Next.js JS/CSS chunks — network-first so recompiled chunks are never stale
  if (url.pathname.startsWith('/_next/static/chunks/') || url.pathname.startsWith('/_next/static/css/')) {
    event.respondWith(networkFirstWithCache(request, STATIC_CACHE));
    return;
  }

  // Truly immutable assets (fonts, images, icons) — cache-first
  if (url.pathname.match(/\.(woff2?|png|jpg|jpeg|svg|ico)$/)) {
    event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE));
    return;
  }
});

async function networkFirstWithCache(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'X-From-Cache': 'offline' },
    });
  }
}

async function cacheFirstWithNetwork(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response('', { status: 404 });
  }
}

// ── Background Sync ───────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushPendingQueue());
  }
});

async function flushPendingQueue() {
  // Read pending mutations from IndexedDB and replay them
  try {
    const db = await openDB();
    const tx = db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    const all = await storeGetAll(store);

    for (const item of all) {
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: { 'Content-Type': 'application/json' },
          body: item.body,
        });
        if (res.ok) {
          store.delete(item.id);
        }
      } catch {
        // Keep in queue — will retry next sync
      }
    }
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  } catch (err) {
    console.warn('SW sync flush error:', err);
  }
}

// ── IndexedDB helpers ─────────────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('financeos-offline', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function storeGetAll(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Push notifications (placeholder) ─────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'FinanceOS', {
      body: data.body ?? '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    })
  );
});
