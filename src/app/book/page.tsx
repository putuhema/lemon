"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpenTextIcon, ChevronLeftIcon } from "lucide-react";
import { useLemon } from "@/lib/lemon";
import { supabase, BUCKET } from "@/lib/supabase";
import type { Annotation, Book, Progress, Reply } from "@/lib/types";
import { pct } from "@/lib/format";
import { TopBar } from "@/components/Floating";
import { BotHead } from "@/components/BotHead";

type Data = { book: Book; cover?: string; progress: Progress[]; anns: Annotation[]; replies: Reply[] };

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** "Our book": a keepsake of reading one book together. */
export default function OurBookPage() {
  return (
    <Suspense>
      <OurBook />
    </Suspense>
  );
}

function OurBook() {
  const id = useSearchParams().get("b") ?? "";
  const { me, partner, colorOf, nameOf } = useLemon();
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    if (!me) return;
    (async () => {
      const [b, p, a] = await Promise.all([
        supabase.from("books").select("*").eq("id", id).single(),
        supabase.from("progress").select("*").eq("book_id", id),
        supabase.from("annotations").select("*").eq("book_id", id).order("fraction"),
      ]);
      if (!b.data) return;
      const anns = (a.data ?? []) as Annotation[];
      const r = anns.length
        ? await supabase.from("replies").select("*").in("annotation_id", anns.map((x) => x.id))
        : { data: [] };
      const cover = b.data.cover_path
        ? (await supabase.storage.from(BUCKET).createSignedUrl(b.data.cover_path, 3600)).data?.signedUrl
        : undefined;
      setData({ book: b.data as Book, cover, progress: (p.data ?? []) as Progress[], anns, replies: (r.data ?? []) as Reply[] });
    })();
  }, [id, me]);

  if (!me || !partner || !data) return <main className="min-h-dvh bg-cream" />;

  const { book, cover, progress, replies } = data;
  const mine = progress.find((p) => p.reader_id === me.id);
  const theirs = progress.find((p) => p.reader_id === partner.id);
  // No spoilers: their notes only count up to where you've read.
  const seen = Math.max(mine?.max_fraction ?? 0, mine?.fraction ?? 0) + 0.003;
  const anns = data.anns.filter((a) => a.reader_id === me.id || a.fraction <= seen);
  const replyCount = (annId: string) => replies.filter((r) => r.annotation_id === annId).length;
  const bothDone = !!(mine?.finished_at && theirs?.finished_at);
  const finishedOn = bothDone ? [mine!.finished_at!, theirs!.finished_at!].sort().at(-1)! : null;
  const days = finishedOn
    ? Math.max(1, Math.round((new Date(finishedOn).getTime() - new Date(book.created_at).getTime()) / 86400000))
    : null;

  const moments = anns
    .filter((a) => a.note || a.emoji || replyCount(a.id) > 0)
    .sort((a, b) => replyCount(b.id) - replyCount(a.id) || (b.note ? 1 : 0) - (a.note ? 1 : 0) || a.fraction - b.fraction)
    .slice(0, 8)
    .sort((a, b) => a.fraction - b.fraction);

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 pt-[calc(env(safe-area-inset-top)+76px)] pb-[calc(env(safe-area-inset-bottom)+40px)]">
      <TopBar>
        <Link href="/" className="-ml-1.5 grid size-10 place-items-center rounded-full" aria-label="Back">
          <ChevronLeftIcon className="size-5" />
        </Link>
        <h1 className="mr-auto font-serif text-lg font-semibold">Our book</h1>
        <Link
          href={`/read?b=${book.id}`}
          className="flex h-9 items-center gap-1.5 rounded-full bg-lemon px-3.5 text-sm font-semibold"
        >
          <BookOpenTextIcon className="size-4" /> Read
        </Link>
      </TopBar>

      <section className="flex flex-col items-center text-center">
        {cover ? (
          <img src={cover} alt="" className="h-48 rounded-xl object-cover ring-1 ring-ink/5" />
        ) : (
          <div className="flex h-48 w-32 items-end rounded-xl bg-gradient-to-br from-lemon to-lemon-deep p-3 text-left font-serif font-semibold">
            {book.title}
          </div>
        )}
        <div className="-mt-6 flex items-end gap-1">
          <BotHead color={me.color} size={56} mood={bothDone ? "happy" : "reading"} bob={bothDone} label={me.name} />
          <BotHead color={partner.color} size={56} mood={bothDone ? "love" : "reading"} bob={bothDone} label={partner.name} />
        </div>
        <h2 className="mt-3 font-serif text-2xl font-semibold leading-tight">{book.title}</h2>
        {book.author && <p className="text-sm text-muted">{book.author}</p>}
        <p className="mt-3 rounded-full bg-paper px-4 py-1.5 text-sm ring-1 ring-ink/5">
          {bothDone ? `Finished together · ${day(finishedOn!)} · ${days} ${days === 1 ? "day" : "days"}` : `Started ${day(book.created_at)}`}
        </p>
      </section>

      {!bothDone && (
        <section className="mt-6 space-y-2.5 rounded-3xl bg-paper p-4 ring-1 ring-ink/5">
          {[
            [me, mine],
            [partner, theirs],
          ].map(([r, p]) => {
            const reader = r as typeof me;
            const prog = p as Progress | undefined;
            return (
              <div key={reader.id} className="flex items-center gap-2.5">
                <BotHead color={reader.color} size={28} mood={prog?.finished_at ? "happy" : "reading"} />
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/8">
                  <div className="h-full rounded-full" style={{ width: pct(prog?.fraction), background: reader.color }} />
                </div>
                <span className="w-10 text-right text-xs tabular-nums text-muted">
                  {prog?.finished_at ? "✓" : pct(prog?.fraction)}
                </span>
              </div>
            );
          })}
        </section>
      )}

      <section className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          ["Notes", anns.filter((a) => a.note).length],
          ["Highlights", anns.length],
          ["Replies", replies.filter((r) => anns.some((a) => a.id === r.annotation_id)).length],
        ].map(([label, n]) => (
          <div key={label} className="rounded-2xl bg-paper py-3 ring-1 ring-ink/5">
            <p className="font-serif text-2xl font-semibold tabular-nums">{n}</p>
            <p className="text-xs text-muted">{label}</p>
          </div>
        ))}
      </section>

      {moments.length > 0 && (
        <section className="mt-8">
          <h3 className="mb-3 font-serif text-lg font-semibold">Our moments</h3>
          <div className="space-y-3">
            {moments.map((a) => (
              <Link
                key={a.id}
                href={`/read?b=${book.id}`}
                className="block rounded-3xl bg-paper p-4 ring-1 ring-ink/5"
              >
                <p className="border-l-4 pl-3 font-serif text-[15px] italic leading-relaxed" style={{ borderColor: colorOf(a.reader_id) }}>
                  “{a.quote}”
                </p>
                <div className="mt-3 flex items-start gap-2">
                  <BotHead color={colorOf(a.reader_id)} size={24} mood={a.note ? "love" : "idle"} label={nameOf(a.reader_id)} />
                  <p className="min-w-0 flex-1 text-sm">
                    {a.note ?? <span className="text-muted">{nameOf(a.reader_id)}</span>} {a.emoji}
                  </p>
                  {replyCount(a.id) > 0 && <span className="shrink-0 text-xs text-muted">💬 {replyCount(a.id)}</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
