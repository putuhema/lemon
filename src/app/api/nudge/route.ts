import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { NUDGES, type NudgeKind } from "@/lib/nudges";

/** Sends a phone notification to the other reader ("Read with me?", etc). */
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { bookId, kind } = (await req.json().catch(() => ({}))) as { bookId?: string | null; kind?: NudgeKind };
  const nudge = kind ? NUDGES[kind] : undefined;
  if (!nudge) return Response.json({ error: "Unknown nudge" }, { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { data: readers } = await admin.from("readers").select("id,name");
  const me = readers?.find((r) => r.id === auth.user!.id);
  const partner = readers?.find((r) => r.id !== auth.user!.id);
  if (!me || !partner) return Response.json({ error: "Not a reader" }, { status: 403 });

  let title: string | undefined;
  if (bookId) {
    const { data: book } = await admin.from("books").select("title").eq("id", bookId).single();
    title = book?.title;
  }

  const { data: subs } = await admin.from("push_subscriptions").select("endpoint,subscription").eq("reader_id", partner.id);
  if (!subs?.length) return Response.json({ sent: 0, reason: "Partner hasn't turned on notifications" });

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:lemon@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  const payload = JSON.stringify({
    title: `${me.name} 🍋`,
    body: nudge.body(title),
    url: bookId ? `/read/${bookId}?join=1` : "/",
    tag: `lemon-${kind}`,
  });

  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s.subscription, payload, { TTL: 60 * 60 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // The phone unsubscribed or reinstalled: forget it
        if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }),
  );
  return Response.json({ sent });
}
