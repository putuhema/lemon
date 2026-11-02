"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useLemon } from "@/lib/lemon";
import { supabase, BUCKET } from "@/lib/supabase";
import type { Book, Progress } from "@/lib/types";
import { uploadBook, deleteBook, takeSharedFile } from "@/lib/upload";
import { forgetBookFile } from "@/lib/bookCache";
import { pct } from "@/lib/format";
import { BotHead } from "@/components/BotHead";
import { enablePush, hasPushSubscription, isIOS, isStandalone, pushSupported } from "@/lib/push";
import { Avatar } from "@/components/Avatar";
import { Sheet } from "@/components/Sheet";
import { StreakCard } from "@/components/StreakCard";
import { ContinueCard } from "@/components/ContinueCard";
import { useStreak } from "@/lib/streak";
import { BookOpenTextIcon, FloatingNav, LibraryBigIcon, PlusIcon, TopBar } from "@/components/Floating";

export default function Page() {
  return (
    <Suspense>
      <Library />
    </Suspense>
  );
}

function Library() {
  const { ready, me, partner, notMember, toast, nudge } = useLemon();
  const router = useRouter();
  const params = useSearchParams();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [menuBook, setMenuBook] = useState<Book | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const streak = useStreak(me?.id, partner?.id);

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
        await uploadBook(file, me.id);
        toast("Added 🍋");
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
  const myLastBook = progress
    .filter((p) => p.reader_id === me.id && !p.finished_at && books?.some((b) => b.id === p.book_id))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]?.book_id;
  const continueBook = books?.find((b) => b.id === myLastBook);
  const continueProg = continueBook ? prog(continueBook.id, me.id) : undefined;

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 pt-[calc(env(safe-area-inset-top)+76px)] pb-[calc(env(safe-area-inset-bottom)+104px)]">
      <TopBar>
        <img src="/icons/icon-192.png" alt="" className="size-7 rounded-lg" />
        <h1 className="mr-auto font-serif text-lg font-semibold tracking-tight">Lemon</h1>
        <button onClick={() => setSettingsOpen(true)} aria-label="Settings" className="rounded-full">
          <Avatar reader={me} size={36} />
        </button>
      </TopBar>

      {continueBook && continueProg && (
        <ContinueCard
          book={continueBook}
          cover={continueBook.cover_path ? covers[continueBook.cover_path] : undefined}
          mine={continueProg}
          theirs={prog(continueBook.id, partner?.id)}
          me={me}
          partner={partner}
        />
      )}

      {streak && partner && (
        <div className={continueBook ? "mt-3" : ""}>
          <StreakCard streak={streak} me={me} partner={partner} />
        </div>
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
        <EmptyShelf onAdd={() => fileInput.current?.click()} />
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
                  <Link href={`/book/${b.id}`} className="mt-2 block text-xs font-medium text-leaf">
                    Finished together 🎉
                  </Link>
                ) : (
                  <div className="mt-2 space-y-1">
                    <Bar color={me.color} label={me.name} value={mine?.fraction} />
                    {partner && <Bar color={partner.color} label={partner.name} value={theirs?.fraction} />}
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
      <FloatingNav
        active="shelf"
        items={[
          { id: "shelf", label: "Shelf", icon: LibraryBigIcon, href: "/" },
          { id: "reading", label: "Reading", icon: BookOpenTextIcon, href: myLastBook ? `/read/${myLastBook}` : null },
          {
            id: "add",
            label: uploading ? "Adding…" : "Add book",
            icon: PlusIcon,
            onClick: () => fileInput.current?.click(),
            busy: !!uploading,
          },
        ]}
      />

      <Sheet open={!!menuBook} onClose={() => setMenuBook(null)} title={menuBook?.title}>
        {menuBook && (
          <div className="space-y-2">
            <Link
              href={`/book/${menuBook.id}`}
              className="block w-full rounded-2xl bg-ink/5 px-4 py-3.5 text-left font-medium"
            >
              Our book
            </Link>
            <button
              className="w-full rounded-2xl bg-ink/5 px-4 py-3.5 text-left font-medium"
              onClick={async () => {
                const b = menuBook;
                setMenuBook(null);
                toast(await nudge(b.id, "read"));
              }}
            >
              Read together
            </button>
            <button
              className="w-full rounded-2xl bg-red-50 px-4 py-3.5 text-left font-medium text-red-700"
              onClick={async () => {
                const b = menuBook;
                if (!confirm(`Remove “${b.title}” for both of you?`)) return;
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
              Remove
            </button>
          </div>
        )}
      </Sheet>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}

function Bar({ color, label, value }: { color: string; label: string; value?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <BotHead color={color} size={20} label={label} />
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
        className="aspect-[2/3] w-full rounded-xl object-cover ring-1 ring-ink/5"
      />
    );
  return (
    <div className="flex aspect-[2/3] w-full flex-col justify-between rounded-xl bg-gradient-to-br from-lemon to-lemon-deep p-3">
      <p className="font-serif text-base font-semibold leading-tight text-ink">{book.title}</p>
      <p className="text-xs text-ink/70">{book.author}</p>
    </div>
  );
}

function EmptyShelf({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-10 rounded-3xl border-2 border-dashed border-ink/10 px-6 py-12 text-center">
      <p className="text-4xl">🍋</p>
      <p className="mt-3 font-serif text-lg font-semibold">No books yet</p>
      <button onClick={onAdd} className="mt-4 rounded-full bg-lemon px-5 py-2.5 font-semibold">
        Add a book
      </button>
    </div>
  );
}

function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, toast } = useLemon();
  const [pushOn, setPushOn] = useState<boolean | null>(null);

  useEffect(() => {
    if (open) hasPushSubscription().then(setPushOn);
  }, [open]);

  const needsInstall = isIOS() && !isStandalone();

  return (
    <Sheet open={open} onClose={onClose} title={me?.name}>
      <div className="space-y-2">
        <div>
          {needsInstall ? (
            <p className="rounded-2xl bg-lemon/25 px-4 py-3.5 text-sm">
              For notifications: <b>Share → Add to Home Screen</b>
            </p>
          ) : !pushSupported() ? (
            <p className="text-sm text-muted">Notifications not supported</p>
          ) : pushOn ? (
            <p className="rounded-2xl bg-leaf/10 px-4 py-3.5 text-sm font-medium text-leaf">Notifications on ✓</p>
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
