// Lemon service worker: works offline, phone notifications, and Android "Share → Lemon".
//
// Offline strategy
// - App code (/_next/static): cache first. File names change on every deploy, so they never go stale.
// - Pages: network first, falling back to the last copy saved on this phone.
// - Supabase data (rest/v1 GETs): network first with a short timeout, falling back to the last copy.
// - Covers (signed storage URLs): cached by path, ignoring the signature that changes every time.
// Book files are saved by the app itself (see src/lib/bookCache.ts), so they're not handled here.

const VERSION = "v2";
const STATIC = `lemon-static-${VERSION}`;
const PAGES = `lemon-pages-${VERSION}`;
const DATA = `lemon-data-${VERSION}`;
const IMAGES = `lemon-images-${VERSION}`;
const KEEP = [STATIC, PAGES, DATA, IMAGES, "lemon-books-v1", "lemon-share"];
const PRECACHE = ["/", "/login", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

// Saved copies are per phone (one reader), so ignore Vary headers like "Accept, Prefer"
const MATCH = { ignoreVary: true };

// In development the app code changes constantly, so only push notifications run there.
const DEV = new URL(self.location.href).searchParams.has("dev");

self.addEventListener("install", (event) => {
  self.skipWaiting();
  if (DEV) return;
  event.waitUntil(
    caches.open(PAGES).then((cache) =>
      Promise.all(PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => {}))),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("lemon-") && !KEEP.includes(n)).map((n) => caches.delete(n)));
      await trim(STATIC, 300);
      await self.clients.claim();
    })(),
  );
});

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(key);
}

/** Try the network for a while, then fall back to the saved copy. */
async function networkFirst(request, cacheName, cacheKey, timeoutMs) {
  const cache = await caches.open(cacheName);
  const network = fetch(request).then((res) => {
    if (res.ok) cache.put(cacheKey, res.clone()).catch(() => {});
    return res;
  });
  network.catch(() => {}); // handled below; avoids noise when the saved copy wins
  const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs, "timeout"));
  try {
    const first = await Promise.race([network, timeout]);
    if (first !== "timeout") return first;
    // Slow connection: use the saved copy if there is one, otherwise keep waiting
    return (await cache.match(cacheKey, MATCH)) ?? (await network);
  } catch {
    const saved = await cache.match(cacheKey, MATCH);
    if (saved) return saved;
    throw new Error("offline and not saved");
  }
}

async function cacheFirst(request, cacheName, cacheKey = request) {
  const cache = await caches.open(cacheName);
  const saved = await cache.match(cacheKey, MATCH);
  if (saved) return saved;
  const res = await fetch(request);
  if (res.ok) cache.put(cacheKey, res.clone()).catch(() => {});
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Android "Share → Lemon"
  if (request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(
      (async () => {
        const form = await request.formData();
        const file = form.get("book");
        if (file && typeof file !== "string") {
          const cache = await caches.open("lemon-share");
          await cache.put(
            "/__lemon_shared_book",
            new Response(file, { headers: { "x-file-name": encodeURIComponent(file.name || "book.epub") } }),
          );
        }
        return Response.redirect("/?shared=1", 303);
      })(),
    );
    return;
  }

  if (DEV || request.method !== "GET") return;

  // Supabase data: the shelf, progress, notes, bookmarks and streak
  if (url.pathname.includes("/rest/v1/")) {
    event.respondWith(networkFirst(request, DATA, request.url, 4000));
    return;
  }
  // Covers: the signature in the URL changes every time, so save them by path only
  if (url.pathname.includes("/storage/v1/object/sign/")) {
    event.respondWith(cacheFirst(request, IMAGES, url.origin + url.pathname));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request, STATIC));
    return;
  }

  // Opening a page: fresh when online, the saved copy when not
  if (request.mode === "navigate") {
    const key = url.origin + url.pathname;
    event.respondWith(
      networkFirst(request, PAGES, key, 3500).catch(async () => {
        const cache = await caches.open(PAGES);
        // A page never opened before: fall back to the shelf
        return (await cache.match(url.origin + "/", MATCH)) ?? Response.error();
      }),
    );
  }
});

// ---- Notifications ----------------------------------------------------------

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Lemon 🍋", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag || "lemon",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if ("focus" in c) {
          await c.focus();
          if ("navigate" in c) return c.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
