/* ECH Listing Studio service worker — offline cache.
   Bump CACHE when you change any file so devices pull the new version. */
var CACHE = 'ech-studio-local-originals-v24rc18-ready2';
var ASSETS = [
  './',
  './review-config.js?v=24rc18-ready2',
  './index.html',
  './styles.css',
  './styles.css?v=24rc18-ready2',
  './masthead.png',
  './masthead.png?v=22',
  './app.js',
  './app.js?v=24rc18-ready2',
  './draft-store.js?v=24rc18-ready2',
  './draft-local.js?v=24rc18-ready2',
  './cloud-draft.js?v=24rc18-ready2',
  './authorization-registry.js',
  './authorization-registry.js?v=24rc18-ready2',
  './agent-queue.js',
  './pin-access.js',
  './pin-access.js?v=24rc18-ready2',
  './agent-queue.js?v=24rc18-ready2',
  './builder-core.js?v=24rc18-ready2',
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
  // Existing tabs may still need their versioned shell while offline. Retain
  // prior caches during this release; never delete another app's origin cache.
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  // App shell + assets: cache-first (works fully offline).
  if(url.origin === self.location.origin){
    if(url.pathname.endsWith('/release.json')){e.respondWith(fetch(e.request,{cache:'no-store'}));return;}
    if(e.request.mode==='navigate'){
      e.respondWith(fetch(e.request,{cache:'no-store'}).then(function(res){
        if(res.ok){var copy=res.clone();caches.open(CACHE).then(function(c){c.put(e.request,copy);});}
        return res;
      }).catch(function(){return caches.match(e.request,{cacheName:CACHE}).then(function(hit){return hit||caches.match('./index.html',{cacheName:CACHE});});}));
      return;
    }
    e.respondWith(
      caches.match(e.request,{cacheName:CACHE}).then(function(hit){
        return hit || fetch(e.request).then(function(res){
          // Never persist a failed response or HTML error page as an image.
          var usable=res.ok&&(e.request.destination!=='image'||(res.headers.get('Content-Type')||'').indexOf('image/')===0);
          if(usable){var copy = res.clone();caches.open(CACHE).then(function(c){ c.put(e.request, copy); });}
          return res;
        }).catch(function(){ return caches.match(e.request).then(function(previous){return previous||Response.error();}); });
      })
    );
    return;
  }
  // Signed original-photo URLs and authenticated API responses must never be
  // copied into the shell cache. Durable originals belong to IndexedDB/Storage.
  e.respondWith(fetch(e.request));
});
