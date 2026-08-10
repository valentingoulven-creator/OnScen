/* Web Push handlers — imported by the Workbox service worker (push-sw.js). */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = { title: 'OnScen', body: '', url: '/', tag: 'soundy' };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'OnScen', {
      body: payload.body || '',
      tag: payload.tag || 'soundy',
      data: { url: payload.url || '/' },
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
