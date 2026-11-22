/* Service worker: makes this page open with no signal at all, and lets
   phones install it to the home screen.

   Rules:
   - The page (index.html) is NETWORK FIRST, falling back to the cached
     copy. So a new build still arrives the moment there is signal, and
     an old build still opens when there is none.
   - Everything else on this site (the QR decoder, icons) is CACHE
     FIRST: it rarely changes and must be there offline.
   - Anything on another domain (the Google sheet) is left alone.
   - A new worker takes over immediately, so an update does not wait
     for every tab to close. */
var CACHE = "cf26-admin-v202611212059";
var SHELL = ["./", "icon-192.png", "icon-512.png", "manifest.webmanifest"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })
    .then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE && k.indexOf("cf26-admin-") === 0; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       /* Google etc: hands off */

  var isPage = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("index.html");
  if (isPage) {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put("./", copy); });
      return res;
    }).catch(function () {
      return caches.match("./").then(function (hit) { return hit || caches.match("index.html"); });
    }));
    return;
  }

  e.respondWith(caches.match(req).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    });
  }));
});
