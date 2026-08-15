importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAksQf3rkeG998TmJj-YuA3WpTDLLZ1ais",
  authDomain: "doira-chat-v2.firebaseapp.com",
  databaseURL: "https://doira-chat-v2-default-rtdb.firebaseio.com",
  projectId: "doira-chat-v2",
  storageBucket: "doira-chat-v2.firebasestorage.app",
  messagingSenderId: "885552294238",
  appId: "1:885552294238:web:8a5d288d1eb57e11b687cf"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'DoiraChat';
  const body = payload.notification?.body || 'Yangi xabar keldi';
  self.registration.showNotification(title, {
    body: body,
    icon: './icons/icon-192.png',
    badge: './icons/icon-96.png',
    tag: payload.data?.chatId || 'default',
    data: payload.data || {}
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/v2-private/index.html')
  );
});
