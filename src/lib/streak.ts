"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { isOffline, queuePages } from "./offline";

/** Pages you need to turn in a day for it to count. Small on purpose: any reading counts. */
export const PAGES_PER_DAY = 3;

/** Today's date on this phone, as YYYY-MM-DD. Each of you counts days in your own time zone. */
export function localDay(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Shift a YYYY-MM-DD date by whole days. */
export function addDays(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Add pages to today's count. Resolves to today's new total, or null if it couldn't be saved. */
export async function logPages(pages: number): Promise<number | null> {
  if (pages <= 0) return null;
  const day = localDay();
  const { data, error } = isOffline()
    ? { data: null, error: true }
    : await supabase.rpc("log_reading", { p_day: day, p_pages: pages });
  if (error) {
    queuePages(day, pages); // counted once you're back online
    return null;
  }
  return data as number;
}

type DayRow = { reader_id: string; day: string; pages: number };

export type Streak = {
  /** Days in a row you've both read, up to today. */
  current: number;
  best: number;
  meToday: boolean;
  partnerToday: boolean;
  /** Last 7 days, oldest first: who read that day. */
  week: { day: string; me: boolean; partner: boolean }[];
  /** Today on this phone (YYYY-MM-DD). */
  today: string;
  /** Who read on any day (YYYY-MM-DD). */
  on: (day: string) => { me: boolean; partner: boolean };
};

/**
 * Work out the shared streak from both readers' days.
 * You may live in different time zones, so your partner's day counts for your "today"
 * if they read on that date or on the day after (they're already in tomorrow).
 */
export function computeStreak(rows: DayRow[], meId: string, partnerId: string, today = localDay()): Streak {
  const mine = new Set(rows.filter((r) => r.reader_id === meId && r.pages >= PAGES_PER_DAY).map((r) => r.day));
  const theirs = new Set(rows.filter((r) => r.reader_id === partnerId && r.pages >= PAGES_PER_DAY).map((r) => r.day));
  const partnerOn = (day: string) => theirs.has(day) || (day === today && theirs.has(addDays(today, 1)));
  const both = (day: string) => mine.has(day) && partnerOn(day);

  // The streak stays alive through today: if today isn't done yet, count back from yesterday.
  let current = 0;
  let cursor = both(today) ? today : addDays(today, -1);
  while (both(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  // Longest run ever
  const allDays = [...mine].filter((d) => partnerOn(d)).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of allDays) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }

  const week = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6);
    return { day, me: mine.has(day), partner: partnerOn(day) };
  });

  return {
    current,
    best: Math.max(best, current),
    meToday: mine.has(today),
    partnerToday: partnerOn(today),
    week,
    today,
    on: (day) => ({ me: mine.has(day), partner: partnerOn(day) }),
  };
}

/** The couple's streak, kept up to date live. */
export function useStreak(meId: string | undefined, partnerId: string | undefined) {
  const [rows, setRows] = useState<DayRow[] | null>(null);

  const load = useCallback(async () => {
    const since = addDays(localDay(), -400);
    const { data } = await supabase.from("reading_days").select("reader_id,day,pages").gte("day", since);
    setRows((data ?? []) as DayRow[]);
  }, []);

  useEffect(() => {
    if (!meId || !partnerId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading data from Supabase
    load();
    const ch = supabase
      .channel(`streak:${meId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reading_days" }, () => load())
      .subscribe();
    // A new day may have started while the app was in the background
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      supabase.removeChannel(ch);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [meId, partnerId, load]);

  return rows && meId && partnerId ? computeStreak(rows, meId, partnerId) : null;
}
