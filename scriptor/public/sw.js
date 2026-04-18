/* Service worker minimal pour rendre Scriptor installable (PWA) */
const CACHE = 'scriptor-v1'
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', () => {})
