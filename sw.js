/* ECH Listing Studio service worker — offline cache.
   Bump CACHE when you change any file so devices pull the new version. */
var CACHE = 'ech-studio-pin-v12';
var ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './authorization-registry.js',
  './agent-queue.js',
  './pin-access.js',
  './pin-access.js?v=12',
  './agent-queue.js?v=12',
  './builder-core.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){ if(k!==CACHE) return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  // App shell + assets: cache-first (works fully offline).
  if(url.origin === self.location.origin){
    if(e.request.mode==='navigate'){
      e.respondWith(fetch(e.request).then(function(res){
        if(res.ok){var copy=res.clone();caches.open(CACHE).then(function(c){c.put(e.request,copy);});}
        return res;
      }).catch(function(){return caches.match(e.request).then(function(hit){return hit||caches.match('./index.html');});}));
      return;
    }
    e.respondWith(
      caches.match(e.request).then(function(hit){
        return hit || fetch(e.request).then(function(res){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
          return res;
        }).catch(function(){ return caches.match('./index.html'); });
      })
    );
    return;
  }
  // Cross-origin (e.g. Google Fonts): network, fall back to cache if seen before.
  e.respondWith(
    fetch(e.request).then(function(res){
      var copy = res.clone();
      caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
      return res;
    }).catch(function(){ return caches.match(e.request); })
  );
});
