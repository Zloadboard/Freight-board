/* Z Board service worker.
   The app shell is cached on install so it opens with no network at all.
   Apps Script calls are NEVER cached — a stale board silently served as
   fresh is worse than an honest "offline" banner, which the app shows from
   its own localStorage copy instead. */
var CACHE = "zboard-v1";
var SHELL = ["./mobile-app.html","./manifest.json","./icon-192.png","./icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // addAll fails the whole install if any one file 404s; add individually
      // so a missing icon cannot stop the app from working offline.
      return Promise.all(SHELL.map(function (u) {
        return c.add(new Request(u, { cache: "reload" })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var r = e.request;
  if (r.method !== "GET") return;
  var u = new URL(r.url);
  // Live data: network only. Never serve a cached board as if it were current.
  if (u.hostname.indexOf("script.google.com") >= 0 || u.hostname.indexOf("script.googleusercontent.com") >= 0) return;
  if (u.origin !== self.location.origin) return;
  // Shell: cache first, then refresh in the background.
  e.respondWith(
    caches.match(r).then(function (hit) {
      var net = fetch(r).then(function (res) {
        if (res && res.ok) caches.open(CACHE).then(function (c) { c.put(r, res.clone()); });
        return res;
      });
      return hit || net.catch(function () {
        return hit || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      });
    })
  );
});
