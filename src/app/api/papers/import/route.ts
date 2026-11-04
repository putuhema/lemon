import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { ImportError, importUrl } from "@/lib/importer";

export const maxDuration = 60;

/**
 * Adds a journal from a link: a PDF, a journal page (its PDF when it downloads),
 * or a web article (saved as clean HTML). Runs on the server because browsers
 * can't fetch other sites, and so links can't reach the server's own network.
 */
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return Response.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { url?: unknown; title?: unknown };
  const url = typeof body.url === "string" ? body.url.trim().slice(0, 2000) : "";
  const typedTitle = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
  if (!url) return Response.json({ error: "Paste a link first" }, { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { data: reader } = await admin.from("readers").select("id").eq("id", auth.user.id).maybeSingle();
  if (!reader) return Response.json({ error: "Not a reader" }, { status: 403 });

  let imported;
  try {
    imported = await importUrl(url);
  } catch (error) {
    if (error instanceof ImportError) return Response.json({ error: error.message }, { status: 422 });
    console.error("[papers/import]", error);
    return Response.json({ error: "Couldn’t add that link" }, { status: 500 });
  }

  if (imported.kind === "pdf") {
    const path = `${reader.id}/${randomUUID()}.pdf`;
    const { error: uploadError } = await admin.storage
      .from("papers")
      .upload(path, imported.bytes, { contentType: "application/pdf" });
    if (uploadError) {
      console.error("[papers/import] upload", uploadError);
      return Response.json({ error: "Couldn’t save the PDF" }, { status: 500 });
    }
    const fileName = decodeURIComponent(new URL(imported.sourceUrl).pathname.split("/").pop() ?? "")
      .replace(/\.pdf$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
    const { data, error } = await admin
      .from("papers")
      .insert({
        kind: "pdf",
        title: (typedTitle || imported.title || fileName || imported.site).slice(0, 160),
        source: imported.site.slice(0, 160),
        source_url: imported.sourceUrl,
        file_path: path,
        added_by: reader.id,
      })
      .select("id")
      .single();
    if (error) {
      await admin.storage.from("papers").remove([path]);
      console.error("[papers/import] insert", error);
      return Response.json({ error: "Couldn’t save it" }, { status: 500 });
    }
    return Response.json({ id: data.id, kind: "pdf" });
  }

  const { data, error } = await admin
    .from("papers")
    .insert({
      kind: "article",
      title: (typedTitle || imported.title).slice(0, 160),
      source: imported.site.slice(0, 160),
      byline: imported.byline?.slice(0, 160) ?? null,
      source_url: imported.sourceUrl,
      article_html: imported.html,
      article_text: imported.text,
      added_by: reader.id,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[papers/import] insert", error);
    return Response.json({ error: "Couldn’t save it" }, { status: 500 });
  }
  return Response.json({ id: data.id, kind: "article" });
}
