/* Service Worker FCM — doit rester à la racine (public/) */
/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDTMPMI_zgOeivrpsvYrfScs-40GGzZKSQ',
  authDomain: 'stock-manager-ai-7828c.firebaseapp.com',
  projectId: 'stock-manager-ai-7828c',
  storageBucket: 'stock-manager-ai-7828c.firebasestorage.app',
  messagingSenderId: '150125164910',
  appId: '1:150125164910:web:4c5c44743592e9dce0297f',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'Stock Manager AI';
  const body = payload.notification?.body || payload.data?.body || 'Nouvelle notification';
  const link = payload.data?.link || '/kitchen';
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { link },
    tag: 'mm-fcm',
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/kitchen';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.navigate(link);
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(link);
    }),
  );
});
