// Move service worker. One worker for the whole app: it keeps the app shell
// fresh after deploys, lets the app open offline, and shows push notifications.
// __BUILD_ID__ is replaced at build time (see vite.config.ts) so every deploy
// gets its own cache and the previous one is removed.
const BUILD_ID = '__BUILD_ID__';
const CACHE_NAME = `move-${BUILD_ID}`;
const SHELL_URL = '/index.html';
const LEGACY_CACHE = 'move-cache-v1';
const NAVIGATION_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(new Request(SHELL_URL, { cache: 'reload' })))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      const hadLegacyCache = names.includes(LEGACY_CACHE);
      await Promise.all(
        names
          .filter((name) => name.startsWith('move-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();

      // One-time rescue: phones still showing the old cache-first shell are
      // reloaded once so they pick up the current app straight away.
      if (hadLegacyCache) {
        const windows = await self.clients.matchAll({ type: 'window' });
        await Promise.all(windows.map((client) => client.navigate(client.url).catch(() => {})));
      }
    })()
  );
});

async function putInCache(request, response) {
  if (!response || !response.ok || response.type !== 'basic') return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
}

// HTML: always try the network first so a new deploy shows on the next open.
// Falls back to the last saved shell when offline or the network is too slow.
async function handleNavigation(request) {
  const cached = await caches.match(SHELL_URL);

  const fromNetwork = fetch(request).then((response) => {
    if (response.ok) putInCache(SHELL_URL, response.clone()).catch(() => {});
    return response;
  });

  if (!cached) return fromNetwork;

  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(cached), NAVIGATION_TIMEOUT_MS);
  });
  try {
    return await Promise.race([fromNetwork, timeout]);
  } catch {
    return cached;
  } finally {
    clearTimeout(timer);
  }
}

// Hashed build files never change, so the cache is safe to use first.
async function handleHashedAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  putInCache(request, response.clone()).catch(() => {});
  return response;
}

// Everything else on our origin (icons, manifest, avatars): network first.
async function handleOther(request) {
  try {
    const response = await fetch(request);
    putInCache(request, response.clone()).catch(() => {});
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(handleHashedAsset(request));
    return;
  }
  event.respondWith(handleOther(request));
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Move', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Move';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/notification-icon.png',
      badge: '/notification-badge.png',
      tag: data.tag || undefined,
      renotify: !!data.tag,
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin) && 'focus' in w) {
          w.navigate(url).catch(() => {});
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
