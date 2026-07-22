// sw.js - Service Worker for Atolyecim ERP
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('push', (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch (err) {
    // If payload is plain text, convert it to data object
    data = { title: "Atölyecim Bildirimi", body: e.data ? e.data.text() : "" };
  }
  const title = data.title || "Atölyecim Bildirimi";
  const options = {
    body: data.body || "",
    icon: "https://atolyecim.vercel.app/favicon.ico",
    badge: "https://atolyecim.vercel.app/favicon.ico",
    vibrate: [200, 100, 200],
    data: {
      url: "/"
    }
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus if tab already open
      for (const client of clientList) {
        if (client.focus && typeof client.focus === 'function') {
          return client.focus();
        }
      }
      // Open new tab if none open
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
