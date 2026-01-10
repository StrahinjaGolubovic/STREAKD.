// Service Worker for STREAKD PWA
const CACHE_VERSION = '1.0.1'; // Sync with package.json version
const CACHE_NAME = `streakd-v${CACHE_VERSION}`;
const urlsToCache = [
  '/',
  '/login',
  '/register',
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('Cache installation failed:', error);
      })
  );
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - network-first strategy for HTML, cache-first for assets
self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Don't cache API routes, service worker, or Next.js internal files
  if (url.pathname.includes('/api/') ||
    url.pathname.includes('/sw.js') ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/webpack')) {
    return;
  }

  // For HTML pages (navigation requests), use network-first strategy
  if (event.request.mode === 'navigate' ||
    (event.request.method === 'GET' && event.request.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If network succeeds, update cache and return response
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(event.request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Fallback to index if cache also fails
              return caches.match('/');
            });
        })
    );
    return;
  }

  // For other assets (images, fonts, etc.), use cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }

        return fetch(event.request).then((response) => {
          // Don't cache if not a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            })
            .catch((error) => {
              console.log('Cache put failed:', error);
            });

          return response;
        });
      })
      .catch(() => {
        return fetch(event.request);
      })
  );
});

// Push notification event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let notificationData = {
    title: 'STREAKD.',
    body: 'You have a new notification',
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-48x48.png',
    data: { url: '/dashboard' }
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = { ...notificationData, ...data };
    } catch (e) {
      console.error('Error parsing push data:', e);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag || 'default',
      requireInteraction: notificationData.requireInteraction || false,
      data: notificationData.data,
      actions: notificationData.actions || []
    })
  );
});

// Notification click event - handle when user clicks notification
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Notification close event - handle when user dismisses notification
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
  // Could track dismissals here if needed
});
