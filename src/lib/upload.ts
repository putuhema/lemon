import { supabase, BUCKET } from "./supabase";
import type { Book } from "./types";

type LangMap = string | Record<string, string> | undefined;
type Contributor = string | { name?: LangMap } | Array<string | { name?: LangMap }> | undefined;

const lang = (x: LangMap) => (!x ? "" : typeof x === "string" ? x : (Object.values(x)[0] ?? ""));
const person = (c: Contributor): string =>
  !c ? "" : Array.isArray(c) ? c.map(person).filter(Boolean).join(", ") : typeof c === "string" ? c : lang(c.name);

async function shrinkCover(blob: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(blob);
    const w = Math.min(480, bmp.width);
    const h = Math.round((bmp.height / bmp.width) * w);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    return await new Promise((res) => canvas.toBlob((b) => res(b ?? blob), "image/jpeg", 0.85));
  } catch {
    return blob;
  }
}

/** Read an EPUB's title/author/cover, upload it, and add it to the shared library. */
export async function uploadBook(file: File, readerId: string): Promise<Book> {
  if (file.size > 50 * 1024 * 1024) throw new Error("That file is over 50 MB, too big for the free plan.");
  const { makeBook } = await import("foliate-js/view.js");
  let parsed;
  try {
    parsed = await makeBook(file);
  } catch {
    throw new Error("Lemon couldn’t open that file. Is it an EPUB?");
  }
  const title = lang(parsed.metadata?.title) || file.name.replace(/\.[^.]+$/, "");
  const author = person(parsed.metadata?.author) || null;

  const id = crypto.randomUUID();
  const file_path = `${id}/book.epub`;
  const up = await supabase.storage
    .from(BUCKET)
    .upload(file_path, file, { contentType: "application/epub+zip" });
  if (up.error) throw new Error(`Upload failed: ${up.error.message}`);

  let cover_path: string | null = null;
  const cover: Blob | null = await Promise.resolve(parsed.getCover?.()).catch(() => null);
  if (cover) {
    const small = await shrinkCover(cover);
    const path = `${id}/cover.jpg`;
    const res = await supabase.storage.from(BUCKET).upload(path, small, { contentType: "image/jpeg" });
    if (!res.error) cover_path = path;
  }

  const { data, error } = await supabase
    .from("books")
    .insert({ id, title, author, file_path, cover_path, uploaded_by: readerId })
    .select()
    .single();
  if (error) throw new Error(`Couldn’t save the book: ${error.message}`);
  return data as Book;
}

export async function deleteBook(book: Book) {
  const paths = [book.file_path, book.cover_path].filter(Boolean) as string[];
  await supabase.storage.from(BUCKET).remove(paths);
  const { error } = await supabase.from("books").delete().eq("id", book.id);
  if (error) throw error;
}

/** A book shared into Lemon from Android's share sheet, if there is one waiting. */
export async function takeSharedFile(): Promise<File | null> {
  if (!("caches" in window)) return null;
  const cache = await caches.open("lemon-share");
  const res = await cache.match("/__lemon_shared_book");
  if (!res) return null;
  await cache.delete("/__lemon_shared_book");
  const name = decodeURIComponent(res.headers.get("x-file-name") ?? "book.epub");
  return new File([await res.blob()], name, { type: "application/epub+zip" });
}
