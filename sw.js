const CACHE_NAME = 'antigravity-v1';
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/store.js',
  './js/v1.js',
  './js/v2.js',
  './js/settings.js',
  './js/stats.js',
  './manifest.json',
  './icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // キャッシュに失敗するファイルがあっても全体のインストールを止めないようにする
        return Promise.allSettled(
          urlsToCache.map(url => cache.add(url).catch(err => console.log('Failed to cache', url, err)))
        );
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  // 開発中はネットワークファースト戦略を採用する
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
