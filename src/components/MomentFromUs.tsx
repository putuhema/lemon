"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLemon } from "@/lib/lemon";
import { supabase } from "@/lib/supabase";
import { localDay } from "@/lib/streak";
import { BotHead } from "./BotHead";

type Row = {
  id: string;
  book_id: string | null;
  paper_id: string | null;
  reader_id: string;
  quote: string;
  note: string | null;
  emoji: string | null;
  fraction: number;
  cfi: string | null;
};
type Moment = Row & { title: string; href: string };

/** Partner notes unlock once you've read up to them, same as in the readers. */
const SLACK = { book: 0.003, paper: 0.01 };

/** A number from a string, so a day always picks the same moment. */
function hash(s: string) {
  let h = 0;
  for (const c of s) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** One of your highlights or notes from before, a different one each day. */
export function MomentFromUs() {
  const { me, partner, colorOf, nameOf } = useLemon();
  const [moment, setMoment] = useState<Moment | null | undefined>(undefined);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    (async () => {
      const [a, bp, pp] = await Promise.all([
        supabase
          .from("annotations")
          .select("id,book_id,paper_id,reader_id,quote,note,emoji,fraction,cfi")
          .order("created_at"),
        supabase.from("progress").select("book_id,max_fraction").eq("reader_id", me.id),
        supabase.from("paper_progress").select("paper_id,max_fraction").eq("reader_id", me.id),
      ]);
      const bookMax = new Map((bp.data ?? []).map((r) => [r.book_id as string, r.max_fraction as number]));
      const paperMax = new Map((pp.data ?? []).map((r) => [r.paper_id as string, r.max_fraction as number]));
      // Yours, plus theirs from parts you've already read (no spoilers)
      const pool = ((a.data ?? []) as Row[]).filter((r) => {
        if (r.reader_id === me.id) return true;
        if (r.book_id) return r.fraction <= (bookMax.get(r.book_id) ?? 0) + SLACK.book;
        if (r.paper_id) return r.fraction <= (paperMax.get(r.paper_id) ?? 0) + SLACK.paper;
        return false;
      });
      if (!pool.length) {
        if (!cancelled) setMoment(null);
        return;
      }
      // Notes and reactions say more than a bare highlight, so pick from those when there are some
      const rich = pool.filter((r) => r.note || r.emoji);
      const from = rich.length >= 3 ? rich : pool;
      // Picked by the date, so you both get the same one (when it isn't a spoiler for either of you)
      const pick = from[hash(localDay()) % from.length];

      const { data: source } = pick.book_id
        ? await supabase.from("books").select("title").eq("id", pick.book_id).maybeSingle()
        : await supabase.from("papers").select("title").eq("id", pick.paper_id!).maybeSingle();
      if (cancelled) return;
      const href = pick.book_id
        ? `/read?b=${pick.book_id}${pick.cfi ? `&at=${encodeURIComponent(pick.cfi)}` : ""}`
        : `/paper?p=${pick.paper_id}&note=${pick.id}`;
      setMoment({ ...pick, title: (source?.title as string | undefined) ?? "", href });
    })();
    return () => {
      cancelled = true;
    };
  }, [me]);

  if (!me || moment === undefined) return null;

  if (moment === null) {
    return (
      <section className="rounded-3xl border-2 border-dashed border-ink/10 px-5 py-6 text-center">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">A moment from us</p>
        <p className="mt-2 text-sm text-muted">
          Highlight something while you read{partner ? ` and ${partner.name} does too` : ""}. Your favorite lines will
          show up here.
        </p>
      </section>
    );
  }

  const mine = moment.reader_id === me.id;
  return (
    <Link
      href={moment.href}
      className="block rounded-3xl bg-paper p-5 ring-1 ring-ink/5 transition-transform active:scale-[0.98]"
    >
      <p className="text-xs font-medium tracking-wide text-muted uppercase">A moment from us</p>
      <blockquote
        className="mt-3 border-l-4 pl-3 font-serif text-[17px] leading-relaxed italic line-clamp-5"
        style={{ borderColor: colorOf(moment.reader_id) }}
      >
        “{moment.quote}”
      </blockquote>
      {moment.note && <p className="mt-3 text-[15px] leading-snug">{moment.note}</p>}
      <div className="mt-4 flex items-center gap-2 text-xs text-muted">
        <BotHead color={colorOf(moment.reader_id)} size={22} mood={mine ? "idle" : "love"} />
        <span className="min-w-0 truncate">
          {mine ? "You" : nameOf(moment.reader_id)}
          {moment.emoji ? ` ${moment.emoji}` : ""}
          {moment.title ? ` · ${moment.title}` : ""}
        </span>
      </div>
    </Link>
  );
}
