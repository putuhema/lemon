import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Lemon",
    short_name: "Lemon",
    description: "Reading together, from far away.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFF8E1",
    theme_color: "#FFF8E1",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Android: lets "Share → Lemon" send a downloaded ebook straight into the library.
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: { files: [{ name: "book", accept: [".epub", "application/epub+zip"] }] },
    },
  } as MetadataRoute.Manifest;
}
