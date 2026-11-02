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
