"use client";

import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";

// ---- Are we online? ------------------------------------------------------------

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** True while the phone has no connection. */
export function useOffline() {
  return useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );
}

export const isOffline = () => typeof navigator !== "undefined" && !navigator.onLine;

// ---- Saves that wait for the connection ----------------------------------------
// Your reading position and streak pages are kept on the phone when offline,
// then sent the next time Lemon is online.

const KEY = "lemon-outbox-v1";

type ProgressRow = {
  reader_id: string;
  book_id: string;
  cfi: string;
  fraction: number;
  max_fraction: number;
  chapter: string | null;
  finished_at: string | null;
  updated_at: string;
};
type Outbox = { progress: Record<string, ProgressRow>; pages: Record<string, number> };

function read(): Outbox {
  try {
    return { progress: {}, pages: {}, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { progress: {}, pages: {} };
  }
}
const write = (o: Outbox) => localStorage.setItem(KEY, JSON.stringify(o));

/** Save your place, or keep it for later if there's no connection. */
export async function saveProgress(row: ProgressRow) {
  if (!isOffline()) {
    const { error } = await supabase.from("progress").upsert(row);
    if (!error) return;
  }
  const o = read();
  o.progress[`${row.reader_id}:${row.book_id}`] = row; // only the latest place matters
  write(o);
}

/** Count pages toward a day's streak later. */
export function queuePages(day: string, pages: number) {
  const o = read();
  o.pages[day] = (o.pages[day] ?? 0) + pages;
  write(o);
}

let flushing = false;
/** Send everything that was saved while offline. */
export async function flushOutbox() {
  if (flushing || isOffline()) return;
  flushing = true;
  try {
    const o = read();
    for (const [key, row] of Object.entries(o.progress)) {
      const { error } = await supabase.from("progress").upsert(row);
      if (error) break;
      delete o.progress[key];
      write(o);
    }
    for (const [day, pages] of Object.entries(o.pages)) {
      const { error } = await supabase.rpc("log_reading", { p_day: day, p_pages: pages });
      if (error) break;
      delete o.pages[day];
      write(o);
    }
  } finally {
    flushing = false;
  }
}

export const hasPendingSaves = () => {
  const o = read();
  return Object.keys(o.progress).length + Object.keys(o.pages).length > 0;
};
