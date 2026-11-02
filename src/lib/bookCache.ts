import { supabase, BUCKET } from "./supabase";

const CACHE = "lemon-books-v1";
const key = (bookId: string) => `/__lemon_book/${bookId}`;

/** The book saved on this phone, or null. Needs only the id, so it can start before the book's details arrive. */
export async function cachedBookFile(bookId: string): Promise<Blob | null> {
  if (!("caches" in window)) return null;
  try {
    const hit = await (await caches.open(CACHE)).match(key(bookId));
    return hit ? await hit.blob() : null;
  } catch {
    return null; // cache unavailable
  }
}

/** Load an ebook file, from the phone's cache when possible so it opens fast and offline. */
export async function loadBookFile(
  bookId: string,
  path: string,
  cached: Promise<Blob | null> = cachedBookFile(bookId),
): Promise<File> {
  const name = path.split("/").pop() ?? "book.epub";
  const hit = await cached;
  if (hit) return new File([hit], name);
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
