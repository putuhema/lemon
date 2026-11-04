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

/** Upload to a signed URL with real progress (the Supabase client doesn't report progress). */
export async function uploadWithProgress(
  path: string,
  file: Blob,
  contentType: string,
  onProgress?: (f: number) => void,
  bucket = BUCKET,
) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Upload failed: ${error?.message ?? "no upload link"}`);
  const { data: auth } = await supabase.auth.getSession();
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", data.signedUrl);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    if (auth.session) xhr.setRequestHeader("authorization", `Bearer ${auth.session.access_token}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("content-type", contentType);
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
    xhr.send(file);
  });
}

export type UploadPreview = { title: string; author: string | null; cover: string | null };

/**
 * Read an EPUB's title/author/cover, upload it, and add it to the shared library.
 * Resolves to null if you chose not to add a duplicate.
 */
export async function uploadBook(
  file: File,
  readerId: string,
  hooks: {
    onPreview?: (p: UploadPreview) => void;
    onProgress?: (fraction: number) => void;
    confirmDuplicate?: (existing: Book) => Promise<boolean>;
  } = {},
): Promise<Book | null> {
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
  const coverBlob: Blob | null = await Promise.resolve(parsed.getCover?.()).catch(() => null);
  const cover = coverBlob ? await shrinkCover(coverBlob) : null;

  // Already on the shelf?
  const { data: same } = await supabase
    .from("books")
    .select("*")
    .ilike("title", title.replace(/[%_\\]/g, (c) => `\\${c}`))
    .limit(1);
  if (same?.[0] && hooks.confirmDuplicate && !(await hooks.confirmDuplicate(same[0] as Book))) return null;

  hooks.onPreview?.({ title, author, cover: cover ? URL.createObjectURL(cover) : null });

  const id = crypto.randomUUID();
  const file_path = `${id}/book.epub`;
  await uploadWithProgress(file_path, file, "application/epub+zip", hooks.onProgress);

  let cover_path: string | null = null;
  if (cover) {
    const path = `${id}/cover.jpg`;
    const res = await supabase.storage.from(BUCKET).upload(path, cover, { contentType: "image/jpeg" });
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
