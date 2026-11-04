"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLemon, NUDGES, type NudgeKind } from "@/lib/lemon";
import { supabase } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { pct, timeAgo } from "@/lib/format";
import { BotHead } from "./BotHead";

type Last = { kind: "book" | "paper"; id: string; title: string; fraction: number; page: number | null; at: string };

/** Each reader's most recent book or paper. */
async function lastRead(readerId: string): Promise<Last | null> {
  const [b, p] = await Promise.all([
    supabase
      .from("progress")
      .select("book_id,fraction,updated_at,books(title)")
      .eq("reader_id", readerId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("paper_progress")
      .select("paper_id,fraction,page,updated_at,papers(title,kind)")
      .eq("reader_id", readerId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  type BookRow = { book_id: string; fraction: number; updated_at: string; books: { title: string } | null };
  type PaperRow = {
    paper_id: string;
    fraction: number;
    page: number;
    updated_at: string;
    papers: { title: string; kind: string } | null;
  };
  const book = b.data as BookRow | null;
  const paper = p.data as PaperRow | null;
  const fromBook: Last | null = book?.books
    ? { kind: "book", id: book.book_id, title: book.books.title, fraction: book.fraction, page: null, at: book.updated_at }
    : null;
  const fromPaper: Last | null = paper?.papers
    ? {
        kind: "paper",
        id: paper.paper_id,
        title: paper.papers.title,
        fraction: paper.fraction,
        page: paper.papers.kind === "pdf" ? paper.page : null,
        at: paper.updated_at,
      }
    : null;
  if (!fromBook) return fromPaper;
  if (!fromPaper) return fromBook;
  return fromBook.at > fromPaper.at ? fromBook : fromPaper;
}

const NUDGE_KINDS = ["read", "goodnight", "miss"] as const satisfies NudgeKind[];
/** Shorter labels, so all three fit side by side on a phone. */
const NUDGE_SHORT: Record<(typeof NUDGE_KINDS)[number], { emoji: string; label: string }> = {
  read: { emoji: "🍋", label: "Read with me" },
  goodnight: { emoji: "🌙", label: "Bedtime read" },
  miss: { emoji: "💛", label: "Thinking of you" },
};

/** Your partner right now: whether they're around, what they're reading, and a way to reach them. */
export function RightNow() {
  const { me, partner, partnerActivity, partnerLive, nudge, toast } = useLemon();
  const [theirs, setTheirs] = useState<Last | null | undefined>(undefined);
  const [mine, setMine] = useState<Last | null>(null);
  const [sending, setSending] = useState<NudgeKind | null>(null);

  const load = useCallback(async () => {
    if (!me || !partner) return;
    const [t, m] = await Promise.all([lastRead(partner.id), lastRead(me.id)]);
    setTheirs(t);
    setMine(m);
  }, [me, partner]);

  useEffect(() => {
    if (!partner) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading data from Supabase
    load();
    // Their place moves while they read
    const ch = supabase
      .channel("right-now")
      .on("postgres_changes", { event: "*", schema: "public", table: "progress", filter: `reader_id=eq.${partner.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "paper_progress", filter: `reader_id=eq.${partner.id}` }, () =>
        load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [partner, load]);

  if (!me || !partner || theirs === undefined) return <div className="h-[132px] animate-pulse rounded-3xl bg-ink/5" />;

  // What they have open right now ("paper:<id>" for journals)
  const openId = partnerActivity?.bookId ?? null;
  const online = !!partnerActivity;
  const reading = openId
    ? openId.startsWith("paper:")
      ? { kind: "paper" as const, id: openId.slice(6) }
      : { kind: "book" as const, id: openId }
    : null;
  // Its title: from their last saved place (it's almost always the same thing)
  const title = reading && theirs?.id === reading.id ? theirs.title : null;
  const joinHref = reading
    ? reading.kind === "book"
      ? `/read?b=${reading.id}&join=1`
      : `/paper?p=${reading.id}&join=1`
    : null;

  let headline: string;
  let detail: string;
  if (reading) {
    headline = `${partner.name} is reading`;
    const where =
      reading.kind === "book" && partnerLive?.bookId === reading.id
        ? [partnerLive.chapter, pct(partnerLive.fraction)].filter(Boolean).join(" · ")
        : theirs?.id === reading.id
          ? theirs.page
            ? `p. ${theirs.page}`
            : pct(theirs.fraction)
          : "";
    detail = [title ?? "something", where].filter(Boolean).join(" · ");
  } else if (online) {
    headline = `${partner.name} is here`;
    detail = theirs ? `Last in “${theirs.title}”` : "Looking around Lemon";
  } else {
    headline = partner.name;
    detail = theirs ? `Last read ${timeAgo(theirs.at)} · ${theirs.title}` : "Hasn’t started reading yet";
  }

  async function send(kind: NudgeKind) {
    if (sending) return;
    haptic("tap");
    setSending(kind);
    // "Read with me?" invites them into what you're reading, when it's a book
    const bookId = kind === "read" && mine?.kind === "book" ? mine.id : null;
    toast(await nudge(bookId, kind));
    setSending(null);
  }

  return (
    <section className="rounded-3xl bg-paper p-4 ring-1 ring-ink/5" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="relative shrink-0">
          <BotHead
            color={partner.color}
            size={48}
            mood={reading ? "reading" : online ? "happy" : "idle"}
            bob={!!reading}
            label={partner.name}
          />
          <span
            className={`absolute right-0 bottom-0 size-3 rounded-full ring-2 ring-paper ${online ? "bg-leaf" : "bg-ink/20"}`}
            aria-label={online ? "Online" : "Away"}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-[17px] leading-tight font-semibold">{headline}</p>
          <p className="mt-0.5 truncate text-xs text-muted">{detail}</p>
        </div>
        {joinHref && (
          <Link
            href={joinHref}
            onClick={() => haptic("tap")}
            className="shrink-0 rounded-full bg-lemon px-4 py-2 text-sm font-semibold text-on-lemon active:scale-95"
          >
            Join
          </Link>
        )}
      </div>

      <div className="mt-3.5 grid grid-cols-3 gap-1.5">
        {NUDGE_KINDS.map((kind) => (
          <button
            key={kind}
            onClick={() => send(kind)}
            disabled={!!sending}
            aria-label={NUDGES[kind].label}
            className="flex flex-col items-center gap-1 rounded-2xl bg-ink/5 px-1 py-2.5 transition-transform active:scale-95 disabled:opacity-60"
          >
            <span className="text-lg leading-none">{NUDGE_SHORT[kind].emoji}</span>
            <span className="text-[11px] leading-tight font-medium">
              {sending === kind ? "Sending…" : NUDGE_SHORT[kind].label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
