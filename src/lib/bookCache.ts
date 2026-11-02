import { supabase, BUCKET } from "./supabase";

const CACHE = "lemon-books-v1";
const key = (bookId: string) => `/__lemon_book/${bookId}`;

/** Load an ebook file, from the phone's cache when possible so it opens fast and offline. */
export async function loadBookFile(bookId: string, path: string): Promise<File> {
  const name = path.split("/").pop() ?? "book.epub";
  if ("caches" in window) {
    try {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(key(bookId));
      if (hit) return new File([await hit.blob()], name);
    } catch {
      /* cache unavailable, fall through to download */
    }
  }
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw error ?? new Error("Could not download the book");
  if ("caches" in window) {
    caches
      .open(CACHE)
      .then((c) => c.put(key(bookId), new Response(data)))
      .catch(() => {});
  }
  return new File([data], name);
}

export async function forgetBookFile(bookId: string) {
  if ("caches" in window) (await caches.open(CACHE)).delete(key(bookId));
}

/** Which books are saved on this phone (they open without internet). */
export async function downloadedBookIds(): Promise<Set<string>> {
  if (!("caches" in window)) return new Set();
  const keys = await (await caches.open(CACHE)).keys();
  return new Set(keys.map((k) => new URL(k.url).pathname.replace("/__lemon_book/", "")));
}

/** Save a book on this phone in the background, if it isn't already. */
export async function ensureDownloaded(bookId: string, path: string) {
  if (!("caches" in window)) return;
  const cache = await caches.open(CACHE);
  if (await cache.match(key(bookId))) return;
  const { data } = await supabase.storage.from(BUCKET).download(path);
  if (data) await cache.put(key(bookId), new Response(data));
}
