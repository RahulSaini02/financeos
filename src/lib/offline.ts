// Offline utilities: SW registration, sync queue, network status

const DB_NAME = 'financeos-offline';
const DB_VERSION = 1;
const SYNC_TAG = 'financeos-sync';

// ── Service Worker registration ───────────────────────────────────────────────

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[SW] Registered:', reg.scope);
    } catch (err) {
      console.warn('[SW] Registration failed:', err);
    }
  });
}

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Sync queue ────────────────────────────────────────────────────────────────

interface QueuedRequest {
  id?: number;
  url: string;
  method: string;
  body: string;
  timestamp: number;
}

export async function queueRequest(url: string, method: string, body: unknown): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('syncQueue', 'readwrite');
    tx.objectStore('syncQueue').add({ url, method, body: JSON.stringify(body), timestamp: Date.now() } as QueuedRequest);
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  } catch (err) {
    console.warn('[Offline] Failed to queue request:', err);
  }
}

export async function getPendingCount(): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction('syncQueue', 'readonly');
    return await new Promise((res, rej) => {
      const req = tx.objectStore('syncQueue').count();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  } catch {
    return 0;
  }
}

export async function requestBackgroundSync(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync?.register(SYNC_TAG);
  } catch (err) {
    console.warn('[Offline] Background sync registration failed:', err);
  }
}

// ── Offline-aware fetch ───────────────────────────────────────────────────────
// Wraps fetch: if offline and mutating, queues the request and schedules sync.

export async function offlineFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const isOnline = navigator.onLine;
  const method = (options.method ?? 'GET').toUpperCase();

  if (!isOnline && method !== 'GET') {
    await queueRequest(url, method, options.body ? JSON.parse(options.body as string) : null);
    await requestBackgroundSync();
    // Return optimistic 202 so UI can proceed
    return new Response(JSON.stringify({ queued: true, message: 'Saved offline — will sync when connected.' }), {
      status: 202,
      headers: { 'Content-Type': 'application/json', 'X-Offline-Queued': '1' },
    });
  }

  return fetch(url, options);
}
