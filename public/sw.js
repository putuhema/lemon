// Lemon service worker: phone notifications + Android "Share → Lemon".

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(
      (async () => {
        const form = await event.request.formData();
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
  }
});
