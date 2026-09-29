self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {title:'The AV Guys Crew',body:event.data?.text()||'New crew alert'}; }
  const title = data.title || 'The AV Guys Crew';
  const options = { body: data.body || 'You have a new crew notification.', icon: new URL('icon-192.png', self.registration.scope).toString(), badge: new URL('icon-192.png', self.registration.scope).toString(), data: { url: data.url || self.registration.scope, event_code: data.event_code || '' }, tag: data.tag || 'avguys-crew', renotify: true };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || self.registration.scope;
  event.waitUntil((async()=>{ const list = await clients.matchAll({type:'window',includeUncontrolled:true}); const same = list.find(c=>c.url.startsWith(self.registration.scope)); if(same){await same.focus(); if('navigate' in same) await same.navigate(url);} else {await clients.openWindow(url);} })());
});