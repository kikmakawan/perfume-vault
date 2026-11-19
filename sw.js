/* Perfume Vault service worker — ทำให้เปิดแอปได้แม้ไม่มีเน็ต */
const VERSION = 'pv-2.0.0';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const IMAGES = 'pv-images'; // แยกไว้ ไม่ล้างตอนอัปเดตเวอร์ชัน

const SHELL_FILES = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './js/app.js', './js/nav.js', './js/util.js', './js/db.js', './js/api.js', './js/store.js', './js/sync.js',
  './js/analytics.js', './js/charts.js', './js/share.js', './js/weather.js',
  './js/views/home.js', './js/views/vault.js', './js/views/detail.js', './js/views/form.js',
  './js/views/diary.js', './js/views/more.js', './js/views/ai.js', './js/views/wishlist.js',
  './js/views/insights.js', './js/views/settings.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== SHELL && k !== RUNTIME && k !== IMAGES).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API (Apps Script) และสภาพอากาศ: เน็ตเท่านั้น
  if (url.hostname.includes('script.google') || url.hostname.includes('googleusercontent.com') && url.pathname.includes('macros')) return;
  if (url.hostname.includes('open-meteo.com')) return;

  // รูปจาก Drive: cache ก่อน แล้วค่อยเน็ต
  if (url.hostname === 'drive.google.com' || url.hostname.endsWith('googleusercontent.com')) {
    e.respondWith(caches.open(IMAGES).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') c.put(req, res.clone());
        return res;
      } catch (err) { return hit || Response.error(); }
    }));
    return;
  }

  // ฟอนต์: stale-while-revalidate
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(caches.open(RUNTIME).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  // ไฟล์ของแอป: cache ก่อน (อัปเดตเมื่อเปลี่ยน VERSION)
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
        if (res.ok) caches.open(RUNTIME).then(c => c.put(req, res.clone()));
        return res;
      }).catch(() => caches.match('./index.html')))
    );
  }
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
