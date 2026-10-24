/// <reference lib="webworker" />

const CACHE_CORE = 'juzu-core-v7';
const CACHE_ASSETS = 'juzu-assets-v7';
const PRECACHE_ASSETS: string[] = ['__PRECACHE_ASSETS__'];

const CORE_SHELL: string[] = [
  '/juzu/',
  '/juzu/index.html',
  '/juzu/manifest.webmanifest',
  '/juzu/favicon.svg',
  '/juzu/assets/icon-192.svg',
  '/juzu/assets/icon-512.svg',
];

self.addEventListener('install', (event: any) => {
  event.waitUntil(
    caches.open(CACHE_CORE).then(async (cache) => {
      try {
        await cache.addAll(CORE_SHELL);
      } catch (err) {
        console.warn('[SW] Core shell cache warming partial:', err);
      }
    })
  );
  (self as any).skipWaiting();
});

self.addEventListener('activate', (event: any) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE_CORE && k !== CACHE_ASSETS) {
            return caches.delete(k);
          }
          return Promise.resolve(true);
        })
      )
    )
  );
  (self as any).clients.claim();
});

self.addEventListener('fetch', (event: any) => {
  const req: Request = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Navigation requests: NETWORK-FIRST so code updates deploy immediately to all users
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_CORE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          return (await caches.match('/juzu/index.html')) || (await caches.match('/juzu/'));
        })
    );
    return;
  }

  // Same-origin and assets requests
  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        // 1. Try matching the exact request across all caches
        let cached = await caches.match(req, { ignoreSearch: true });
        if (!cached) {
          // 2. Try matching by pathname or relative URL
          cached = await caches.match(url.pathname, { ignoreSearch: true });
        }
        if (!cached) {
          // 3. Check directly in CACHE_ASSETS and CACHE_CORE
          const assetsCache = await caches.open(CACHE_ASSETS);
          cached = (await assetsCache.match(req, { ignoreSearch: true })) || (await assetsCache.match(url.pathname, { ignoreSearch: true }));
        }

        if (cached) {
          return cached;
        }

        // Cache miss: attempt network fetch
        try {
          const netRes = await fetch(req);
          if (netRes && netRes.status === 200) {
            const copy = netRes.clone();
            const targetCache = CORE_SHELL.includes(url.pathname) ? CACHE_CORE : CACHE_ASSETS;
            const c = await caches.open(targetCache);
            await c.put(req, copy);
          }
          return netRes;
        } catch (fetchErr) {
          console.warn('[SW FETCH] Offline cache miss for:', url.pathname, fetchErr);
          // If offline and request fails, try returning index.html or fallback
          if (req.mode === 'navigate') {
            const fallback = await caches.match('/juzu/index.html');
            if (fallback) return fallback;
          }
          return new Response('Asset not available offline', {
            status: 503,
            statusText: 'Service Unavailable (Offline)',
            headers: { 'Content-Type': 'text/plain' },
          });
        }
      })()
    );
  }
});

self.addEventListener('message', (event: any) => {
  const data = event.data;
  if (!data || !data.type) return;
  const port = event.ports && event.ports[0];

  const assetsToPrecache = PRECACHE_ASSETS.filter(
    (a) => a && typeof a === 'string' && a !== '__PRECACHE_ASSETS__'
  );

  if (data.type === 'DOWNLOAD_OFFLINE') {
    if (!port) return;

    if (assetsToPrecache.length === 0) {
      port.postMessage({ type: 'PROGRESS', progress: 100, completed: 0, total: 0 });
      port.postMessage({ type: 'COMPLETE', total: 0 });
      return;
    }

    caches
      .open(CACHE_ASSETS)
      .then(async (cache) => {
        let completed = 0;
        const total = assetsToPrecache.length;

        for (const assetUrl of assetsToPrecache) {
          try {
            const hasMatch = await cache.match(assetUrl);
            if (!hasMatch) {
              await cache.add(assetUrl);
            }
          } catch (err) {
            console.warn('[SW] Precache item failed:', assetUrl, err);
          }
          completed++;
          const progress = Math.round((completed / total) * 100);
          port.postMessage({
            type: 'PROGRESS',
            progress,
            completed,
            total,
            currentAsset: assetUrl,
          });
        }

        port.postMessage({ type: 'COMPLETE', total });
      })
      .catch((err) => {
        port.postMessage({ type: 'ERROR', error: String(err) });
      });
  } else if (data.type === 'CLEAR_OFFLINE') {
    if (!port) return;
    caches
      .delete(CACHE_ASSETS)
      .then(() => {
        port.postMessage({ type: 'CLEARED' });
      })
      .catch((err) => {
        port.postMessage({ type: 'ERROR', error: String(err) });
      });
  } else if (data.type === 'GET_OFFLINE_STATUS') {
    if (!port) return;
    const total = assetsToPrecache.length;
    if (total === 0) {
      port.postMessage({ type: 'STATUS', total: 0, cached: 0, isReady: false });
      return;
    }

    caches
      .open(CACHE_ASSETS)
      .then(async (cache) => {
        let count = 0;
        for (const assetUrl of assetsToPrecache) {
          const match = await cache.match(assetUrl);
          if (match) count++;
        }
        port.postMessage({
          type: 'STATUS',
          total,
          cached: count,
          isReady: count >= Math.max(1, total - 2), // allow slight discrepancy for transient dev chunks
        });
      })
      .catch(() => {
        port.postMessage({ type: 'STATUS', total, cached: 0, isReady: false });
      });
  }
});
