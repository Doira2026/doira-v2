const CACHE_NAME = 'doirachat-v2';
const URLS_TO_CACHE = ['./login.html','./index.html','./manifest.json','./icons/icon-192.png','./icons/icon-512.png'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(URLS_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e=>{
  const url = e.request.url;
  if(url.includes('firebaseio.com')||url.includes('googleapis.com')||url.includes('imgbb.com')||url.includes('gstatic.com'))return;
  e.respondWith(caches.match(e.request).then(cached=>{
    return cached||fetch(e.request).then(res=>{
      return caches.open(CACHE_NAME).then(c=>{
        if(e.request.method==='GET'&&res.status===200)c.put(e.request,res.clone());
        return res;
      });
    }).catch(()=>cached);
  }));
});

// PUSH NOTIFICATION
self.addEventListener('push', e=>{
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'DoiraChat';
  const options = {
    body: data.body || 'Yangi xabar',
    icon: './icons/icon-192.png',
    badge: './icons/icon-96.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || './index.html' },
    actions: [
      { action: 'open', title: 'Ochish' },
      { action: 'close', title: 'Yopish' }
    ]
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e=>{
  e.notification.close();
  if(e.action === 'close') return;
  e.waitUntil(clients.openWindow(e.notification.data.url || './index.html'));
});
