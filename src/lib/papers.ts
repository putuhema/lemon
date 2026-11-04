import { supabase } from "./supabase";
import { uploadWithProgress } from "./upload";
import type { Paper } from "./types";

export const PAPERS_BUCKET = "papers";

type PdfJs = typeof import("pdfjs-dist");
let loading: Promise<PdfJs> | undefined;

/** Loads pdf.js in the browser. The worker is copied to /public by scripts/copy-pdf-worker.mjs. */
export function loadPdfjs(): Promise<PdfJs> {
  loading ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    return pdfjs;
  });
  return loading;
}

/** Reads a PDF's page count and title (from its metadata, or the file name). */
async function readPdf(file: File) {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const pdf = await task.promise;
    const meta = await pdf.getMetadata().catch(() => null);
    const info = (meta?.info ?? {}) as { Title?: string; Author?: string };
    const metaTitle = info.Title?.trim();
    // Many PDFs carry junk titles like "untitled" or "Microsoft Word - draft.docx"
    const useful = metaTitle && metaTitle.length > 3 && !/^(untitled|microsoft word|document)/i.test(metaTitle);
    return {
      pages: pdf.numPages,
      title: useful ? metaTitle : file.name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").trim(),
      author: info.Author?.trim() || null,
    };
  } finally {
    await task.destroy();
  }
}

/** Uploads a PDF and adds it to the journal shelf. */
export async function uploadPaper(
  file: File,
  readerId: string,
  onProgress?: (fraction: number) => void,
): Promise<Paper> {
  if (file.size > 50 * 1024 * 1024) throw new Error("That file is over 50 MB, too big for the free plan.");
  let info;
  try {
    info = await readPdf(file);
  } catch {
    throw new Error("Lemon couldn’t open that file. Is it a PDF?");
  }
  const id = crypto.randomUUID();
  const file_path = `${readerId}/${id}.pdf`;
  await uploadWithProgress(file_path, file, "application/pdf", onProgress, PAPERS_BUCKET);
  const { data, error } = await supabase
    .from("papers")
    .insert({
      id,
      kind: "pdf",
      title: info.title.slice(0, 160),
      byline: info.author?.slice(0, 160) ?? null,
      file_path,
      page_count: info.pages,
      added_by: readerId,
    })
    .select(PAPER_COLUMNS)
    .single();
  if (error) {
    await supabase.storage.from(PAPERS_BUCKET).remove([file_path]);
    throw new Error(`Couldn’t save it: ${error.message}`);
  }
  return data as Paper;
}

/** Adds a paper from a link (a PDF, a journal page, or a web article). Resolves to its id. */
export async function addPaperFromLink(url: string, title?: string): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("You’re signed out");
  const res = await fetch("/api/papers/import", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ url, title }),
  }).catch(() => null);
  if (!res) throw new Error("Couldn’t connect. Check your internet.");
  const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!res.ok || !body.id) throw new Error(body.error ?? "Couldn’t add that link");
  return body.id;
}

export async function deletePaper(paper: Paper) {
  if (paper.file_path) await supabase.storage.from(PAPERS_BUCKET).remove([paper.file_path]);
  const { error } = await supabase.from("papers").delete().eq("id", paper.id);
  if (error) throw error;
}

/** Everything but the article's text, which is only loaded when you open it. */
export const PAPER_COLUMNS = "id,kind,title,source,byline,source_url,file_path,page_count,added_by,created_at";
