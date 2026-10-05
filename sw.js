/* ECH Listing Studio service worker — offline cache.
   Bump CACHE when you change any file so devices pull the new version. */
var CACHE = 'ech-studio-header-v22';
var ASSETS = [
  './',
  './index.html',
  './styles.css',
  './masthead.png',
  './masthead.png?v=22',
  './app.js',
  './app.js?v=21',
  './authorization-registry.js',
  './agent-queue.js',
  './pin-access.js',
  './pin-access.js?v=21',
  './agent-queue.js?v=21',
  './cloud-draft.js?v=21',
  './builder-core.js?v=21',
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
      caches.match(e.request,{cacheName:CACHE}).then(function(hit){
        return hit || fetch(e.request).then(function(res){
          // Never persist a failed response or HTML error page as an image.
          var usable=res.ok&&(e.request.destination!=='image'||(res.headers.get('Content-Type')||'').indexOf('image/')===0);
          if(usable){var copy = res.clone();caches.open(CACHE).then(function(c){ c.put(e.request, copy); });}
          return res;
        }).catch(function(){ return Response.error(); });
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
