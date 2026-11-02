"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useLemon, NUDGES, type NudgeKind } from "@/lib/lemon";
import { supabase, BUCKET } from "@/lib/supabase";
import type { Book, Progress } from "@/lib/types";
import { uploadBook, deleteBook, takeSharedFile } from "@/lib/upload";
import { forgetBookFile } from "@/lib/bookCache";
import { pct, timeAgo, initial } from "@/lib/format";
import { enablePush, hasPushSubscription, isIOS, isStandalone, pushSupported } from "@/lib/push";
import { Avatar } from "@/components/Avatar";
import { Sheet } from "@/components/Sheet";

export default function Page() {
  return (
    <Suspense>
      <Library />
    </Suspense>
  );
}

function Library() {
  const { ready, me, partner, notMember, partnerActivity, toast, nudge } = useLemon();
  const router = useRouter();
  const params = useSearchParams();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [menuBook, setMenuBook] = useState<Book | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [b, p] = await Promise.all([
      supabase.from("books").select("*").order("created_at", { ascending: false }),
      supabase.from("progress").select("*"),
    ]);
    const list = (b.data ?? []) as Book[];
    setBooks(list);
    setProgress((p.data ?? []) as Progress[]);
    const paths = list.map((x) => x.cover_path).filter(Boolean) as string[];
    if (paths.length) {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 6);
      const map: Record<string, string> = {};
      data?.forEach((d) => d.path && d.signedUrl && (map[d.path] = d.signedUrl));
      setCovers(map);
    }
  }, []);

  useEffect(() => {
    if (!me) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading data from Supabase
    load();
    const ch = supabase
      .channel("library")
      .on("postgres_changes", { event: "*", schema: "public", table: "books" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "progress" }, (e) => {
        const row = (e.new ?? e.old) as Progress;
        setProgress((all) => [
          ...all.filter((x) => !(x.reader_id === row.reader_id && x.book_id === row.book_id)),
          ...(e.eventType === "DELETE" ? [] : [e.new as Progress]),
        ]);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [me, load]);

  const addFile = useCallback(
    async (file: File) => {
      if (!me) return;
      setUploading(file.name);
      try {
        const book = await uploadBook(file, me.id);
        toast(`“${book.title}” is on both your shelves now 🍋`);
        await load();
      } catch (e) {
        toast((e as Error).message);
      } finally {
        setUploading(null);
      }
    },
    [me, toast, load],
  );

  // A book shared in from Android's share sheet
  useEffect(() => {
    if (!me || params.get("shared") !== "1") return;
    router.replace("/");
    takeSharedFile().then((f) => f && addFile(f));
  }, [me, params, router, addFile]);

  if (!ready || !me) {
    return notMember ? <NotMember /> : <Splash />;
  }

  const prog = (bookId: string, readerId?: string) =>
    progress.find((p) => p.book_id === bookId && p.reader_id === readerId);
  const partnerBook = books?.find((b) => b.id === partnerActivity?.bookId);
  const lastPartner = progress
    .filter((p) => p.reader_id === partner?.id)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  const lastPartnerBook = books?.find((b) => b.id === lastPartner?.book_id);

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 pt-safe pb-32">
      <header className="flex items-center justify-between pt-3">
        <div className="flex items-center gap-2.5">
          <img src="/icons/icon-192.png" alt="" className="size-9 rounded-xl" />
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Lemon</h1>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-1"
          aria-label="Settings"
        >
          <Avatar reader={me} size={34} />
        </button>
      </header>

      {/* What your partner is up to */}
      {partner && (
        <section className="mt-6 rounded-3xl bg-paper p-4 shadow-sm ring-1 ring-ink/5">
          <div className="flex items-center gap-3">
            <div className={`rounded-full ${partnerActivity ? "live-pulse" : ""}`}>
              <Avatar reader={partner} size={44} />
            </div>
            <div className="min-w-0 flex-1">
              {partnerActivity && partnerBook ? (
                <>
                  <p className="font-medium">{partner.name} is reading right now</p>
                  <p className="truncate text-sm text-muted">{partnerBook.title}</p>
                </>
              ) : partnerActivity ? (
                <>
                  <p className="font-medium">{partner.name} has Lemon open</p>
                  <p className="text-sm text-muted">Browsing the shelf</p>
                </>
              ) : (
                <>
                  <p className="font-medium">{partner.name}</p>
                  <p className="truncate text-sm text-muted">
                    {lastPartnerBook
                      ? `Last read ${lastPartnerBook.title} · ${timeAgo(lastPartner?.updated_at)}`
                      : "Hasn’t started reading yet"}
                  </p>
                </>
              )}
            </div>
            {partnerActivity && partnerBook ? (
              <Link
                href={`/read/${partnerBook.id}?join=1`}
                className="shrink-0 rounded-full bg-lemon px-4 py-2 text-sm font-semibold"
              >
                Join
              </Link>
            ) : (
              <button
                onClick={() => setNudgeOpen(true)}
                className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-cream"
              >
                Nudge
              </button>
            )}
          </div>
        </section>
      )}

      <div className="mt-8 flex items-baseline justify-between">
        <h2 className="font-serif text-xl font-semibold">Our shelf</h2>
        {books && books.length > 0 && <span className="text-sm text-muted">{books.length} {books.length === 1 ? "book" : "books"}</span>}
      </div>

      {books === null ? (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
          {[0, 1].map((i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-ink/5" />
          ))}
        </div>
      ) : books.length === 0 ? (
        <EmptyShelf onAdd={() => fileInput.current?.click()} partnerName={partner?.name} />
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
          {books.map((b) => {
            const mine = prog(b.id, me.id);
            const theirs = prog(b.id, partner?.id);
            const bothDone = mine?.finished_at && theirs?.finished_at;
            return (
              <div key={b.id} className="group">
                <Link href={`/read/${b.id}`} className="block active:scale-[0.98] transition-transform">
                  <Cover book={b} url={b.cover_path ? covers[b.cover_path] : undefined} />
                </Link>
                <div className="mt-2.5 flex items-start gap-1">
                  <Link href={`/read/${b.id}`} className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-serif text-[15px] font-semibold leading-snug">{b.title}</p>
                    {b.author && <p className="truncate text-xs text-muted">{b.author}</p>}
                  </Link>
                  <button
                    onClick={() => setMenuBook(b)}
                    className="-mr-1 shrink-0 rounded-full px-1.5 text-lg leading-none text-muted"
                    aria-label="Book options"
                  >
                    ⋯
                  </button>
                </div>
                {bothDone ? (
                  <p className="mt-2 text-xs font-medium text-leaf">Finished together 🎉</p>
                ) : (
                  <div className="mt-2 space-y-1">
                    <Bar color={me.color} label={initial(me.name)} value={mine?.fraction} />
                    {partner && <Bar color={partner.color} label={initial(partner.name)} value={theirs?.fraction} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept=".epub,application/epub+zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) addFile(f);
        }}
      />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 flex justify-center px-5 pb-safe">
        <button
          disabled={!!uploading}
          onClick={() => fileInput.current?.click()}
          className="pointer-events-auto mb-2 flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 font-semibold text-cream shadow-xl transition active:scale-95 disabled:opacity-80"
        >
          {uploading ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-cream/30 border-t-cream" />
              Adding book…
            </>
          ) : (
            <>
              <span className="text-lg leading-none">+</span> Add a book
            </>
          )}
        </button>
      </div>

      <Sheet open={!!menuBook} onClose={() => setMenuBook(null)} title={menuBook?.title}>
        {menuBook && (
          <div className="space-y-2">
            <button
              className="w-full rounded-2xl bg-ink/5 px-4 py-3.5 text-left font-medium"
              onClick={async () => {
                const b = menuBook;
                setMenuBook(null);
                toast(await nudge(b.id, "read"));
              }}
            >
              Ask {partner?.name} to read this with me
            </button>
            <button
              className="w-full rounded-2xl bg-red-50 px-4 py-3.5 text-left font-medium text-red-700"
              onClick={async () => {
                const b = menuBook;
                if (!confirm(`Remove “${b.title}” for both of you? Notes on it will be deleted too.`)) return;
                setMenuBook(null);
                try {
                  await deleteBook(b);
                  forgetBookFile(b.id);
                  load();
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            >
              Remove from our shelf
            </button>
          </div>
        )}
      </Sheet>

      <Sheet open={nudgeOpen} onClose={() => setNudgeOpen(false)} title={`Send ${partner?.name ?? ""} a little ping`}>
        <div className="space-y-2">
          {(Object.keys(NUDGES) as NudgeKind[]).map((k) => (
            <button
              key={k}
              className="w-full rounded-2xl bg-ink/5 px-4 py-3.5 text-left font-medium active:bg-ink/10"
              onClick={async () => {
                setNudgeOpen(false);
                toast(await nudge(lastPartnerBook?.id ?? null, k));
              }}
            >
              {NUDGES[k].label}
            </button>
          ))}
        </div>
      </Sheet>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}

function Bar({ color, label, value }: { color: string; label: string; value?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="grid size-4 shrink-0 place-items-center rounded-full text-[9px] font-bold text-ink/80"
        style={{ background: color }}
      >
        {label}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/8">
        <div className="h-full rounded-full" style={{ width: pct(value), background: color }} />
      </div>
      <span className="w-8 text-right text-[10px] tabular-nums text-muted">{value ? pct(value) : "–"}</span>
    </div>
  );
}

function Cover({ book, url }: { book: Book; url?: string }) {
  if (url)
    return (
      <img
        src={url}
        alt=""
        className="aspect-[2/3] w-full rounded-xl object-cover shadow-md ring-1 ring-ink/5"
      />
    );
  return (
    <div className="flex aspect-[2/3] w-full flex-col justify-between rounded-xl bg-gradient-to-br from-lemon to-lemon-deep p-3 shadow-md">
      <p className="font-serif text-base font-semibold leading-tight text-ink">{book.title}</p>
      <p className="text-xs text-ink/70">{book.author}</p>
    </div>
  );
}

function EmptyShelf({ onAdd, partnerName }: { onAdd: () => void; partnerName?: string }) {
  return (
    <div className="mt-10 rounded-3xl border-2 border-dashed border-ink/10 px-6 py-12 text-center">
      <p className="text-4xl">🍋</p>
      <p className="mt-3 font-serif text-lg font-semibold">Your shelf is empty</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
        Add an EPUB and it shows up on {partnerName ? `${partnerName}’s` : "both"} phone{partnerName ? " too" : "s"}.
      </p>
      <button onClick={onAdd} className="mt-5 rounded-full bg-lemon px-5 py-2.5 font-semibold">
        Add the first book
      </button>
    </div>
  );
}

function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, partner, toast } = useLemon();
  const [pushOn, setPushOn] = useState<boolean | null>(null);

  useEffect(() => {
    if (open) hasPushSubscription().then(setPushOn);
  }, [open]);

  const needsInstall = isIOS() && !isStandalone();

  return (
    <Sheet open={open} onClose={onClose} title={`Hi, ${me?.name ?? ""}`}>
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-semibold">Notifications</p>
          {needsInstall ? (
            <p className="rounded-2xl bg-lemon/25 p-4 text-sm leading-relaxed">
              To get notifications on iPhone, first add Lemon to your Home Screen: tap{" "}
              <b>Share</b> → <b>Add to Home Screen</b>, then open Lemon from there.
            </p>
          ) : !pushSupported() ? (
            <p className="text-sm text-muted">This browser can’t show notifications.</p>
          ) : pushOn ? (
            <p className="rounded-2xl bg-leaf/10 p-4 text-sm text-leaf">
              On. You’ll get a ping when {partner?.name} wants to read with you. 💛
            </p>
          ) : (
            <button
              className="w-full rounded-2xl bg-lemon px-4 py-3.5 font-semibold"
              onClick={async () => {
                try {
                  await enablePush(me!.id);
                  setPushOn(true);
                  toast("Notifications on 🔔");
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            >
              Turn on notifications
            </button>
          )}
        </div>
        {!isStandalone() && !needsInstall && (
          <p className="text-sm text-muted">
            Tip: use your browser menu → <b>Install app</b> / <b>Add to Home screen</b> so Lemon opens like a real
            app.
          </p>
        )}
        <button
          className="w-full rounded-2xl bg-ink/5 px-4 py-3.5 text-left font-medium"
          onClick={() => supabase.auth.signOut()}
        >
          Sign out
        </button>
      </div>
    </Sheet>
  );
}

function Splash() {
  return (
    <main className="grid min-h-dvh place-items-center">
      <img src="/icons/icon-192.png" alt="" className="size-20 animate-pulse rounded-3xl" />
    </main>
  );
}

function NotMember() {
  return (
    <main className="grid min-h-dvh place-items-center px-8 text-center">
      <div>
        <p className="text-4xl">🍋</p>
        <p className="mt-3 font-semibold">This account isn’t one of Lemon’s two readers.</p>
        <button className="mt-4 underline" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    </main>
  );
}
