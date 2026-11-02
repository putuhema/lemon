"use client";

/* eslint-disable @typescript-eslint/no-explicit-any -- foliate-js is untyped */

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useLemon } from "@/lib/lemon";
import { supabase } from "@/lib/supabase";
import { loadBookFile } from "@/lib/bookCache";
import { computeStreak, logPages, PAGES_PER_DAY } from "@/lib/streak";
import { bookCSS, DEFAULT_PREFS, THEMES, type Prefs } from "@/lib/readerStyle";
import type { Annotation, Book, Progress, Reply } from "@/lib/types";
import { pct, timeAgo } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { Sheet } from "@/components/Sheet";
import { readerGlass, readerGlassDark } from "@/lib/glass";
import {
  ALargeSmallIcon,
  ChevronLeftIcon,
  CopyIcon,
  HighlighterIcon,
  ListIcon,
  LocateFixedIcon,
  MessageSquareQuoteIcon,
  PenLineIcon,
  type LucideIcon,
} from "lucide-react";

const EMOJI = ["💛", "😂", "😭", "🥹", "🔥", "😮"];
/** Partner notes unlock once you've read up to them (with a little wiggle room for different screen sizes). */
const SPOILER_SLACK = 0.003;

type Loc = { cfi: string; fraction: number; chapter: string | null };
type Sel = { index: number; range: Range; text: string };
type TocItem = { label: string; href: string; subitems?: TocItem[] };

export default function ReadPage() {
  return (
    <Suspense>
      <Reader />
    </Suspense>
  );
}

function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lemon-prefs");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading saved settings after mount
      if (saved) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(saved) });
    } catch {}
  }, []);
  const update = useCallback((p: Partial<Prefs>) => {
    setPrefs((old) => {
      const next = { ...old, ...p };
      localStorage.setItem("lemon-prefs", JSON.stringify(next));
      return next;
    });
  }, []);
  return [prefs, update] as const;
}

function rangeFraction(view: any, index: number, range: Range) {
  const fr: number[] = view.getSectionFractions();
  const start = fr[index] ?? 0;
  const end = fr[index + 1] ?? 1;
  const doc = range.startContainer.ownerDocument!;
  const pre = doc.createRange();
  pre.setStart(doc.body, 0);
  pre.setEnd(range.startContainer, range.startOffset);
  const total = doc.body.textContent?.length || 1;
  return Math.min(1, Math.max(0, start + (end - start) * (pre.toString().length / total)));
}

function Reader() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const joinOnOpen = search.get("join") === "1";
  const { me, partner, partnerActivity, partnerLive, setActivity, sendPosition, nudge, toast, colorOf, nameOf } =
    useLemon();

  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [loc, setLoc] = useState<Loc | null>(null);
  const [maxFraction, setMaxFraction] = useState(0);
  const [partnerProg, setPartnerProg] = useState<Progress | null>(null);
  const [anns, setAnns] = useState<Annotation[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [chrome, setChrome] = useState(false);
  const [prefs, setPrefs] = usePrefs();
  const [selection, setSelection] = useState<Sel | null>(null);
  const [composer, setComposer] = useState(false);
  const [openCfi, setOpenCfi] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | "notes" | "type" | "toc" | "live">(null);
  const [following, setFollowing] = useState(false);
  const [toc, setToc] = useState<TocItem[]>([]);

  // Refs for use inside foliate's event listeners (registered once per book)
  const locRef = useRef<Loc | null>(null);
  const lastFractionRef = useRef<number | null>(null);
  const maxRef = useRef(0);
  const pagesRef = useRef(0);
  const finishedRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const annTapAt = useRef(0);
  const byCfiRef = useRef(new Map<string, Annotation[]>());
  const visibleRef = useRef<Annotation[]>([]);
  const drawnRef = useRef(new Set<string>());
  const partnerHereRef = useRef(false);
  const prefsRef = useRef(prefs);
  const meRef = useRef(me);
  const partnerRef = useRef(partner);
  const toastRef = useRef(toast);
  const colorOfRef = useRef(colorOf);
  useEffect(() => {
    prefsRef.current = prefs;
    meRef.current = me;
    partnerRef.current = partner;
    toastRef.current = toast;
    colorOfRef.current = colorOf;
  });

  const partnerHere = !!partner && partnerActivity?.bookId === id;
  const partnerFollowingMe = partnerHere && !!partnerActivity?.following;
  useEffect(() => {
    partnerHereRef.current = partnerHere;
  }, [partnerHere]);

  // Where the partner is: live position if they're reading now, otherwise their last saved spot.
  const partnerPos: Loc | null =
    partnerLive?.bookId === id
      ? { cfi: partnerLive.cfi, fraction: partnerLive.fraction, chapter: partnerLive.chapter }
      : partnerProg?.cfi
        ? { cfi: partnerProg.cfi, fraction: partnerProg.fraction, chapter: partnerProg.chapter }
        : null;
  const partnerPosRef = useRef(partnerPos);
  useEffect(() => {
    partnerPosRef.current = partnerPos;
  });

  // ---- Saving my place --------------------------------------------------------
  const onPagesLogged = useCallback(
    async (total: number | null, turned: number) => {
      if (total === null) return;
      const before = total - turned;
      // Celebrate the moment today's reading counts
      if (before < PAGES_PER_DAY && total >= PAGES_PER_DAY && meRef.current && partnerRef.current) {
        const { data } = await supabase.from("reading_days").select("reader_id,day,pages");
        const s = computeStreak(data ?? [], meRef.current.id, partnerRef.current.id);
        toastRef.current(
          s.partnerToday
            ? `The tree grew 🍋 Day ${s.current}`
            : "Today’s pages ✓",
        );
      }
    },
    [],
  );

  const saveNow = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const l = locRef.current;
    const meNow = meRef.current;
    if (!l || !meNow) return;
    if (!finishedRef.current && l.fraction >= 0.99) finishedRef.current = new Date().toISOString();
    const turned = pagesRef.current;
    pagesRef.current = 0;
    if (turned > 0) logPages(turned).then((total) => onPagesLogged(total, turned));
    await supabase.from("progress").upsert({
      reader_id: meNow.id,
      book_id: id,
      cfi: l.cfi,
      fraction: l.fraction,
      max_fraction: maxRef.current,
      chapter: l.chapter,
      finished_at: finishedRef.current,
      updated_at: new Date().toISOString(),
    });
  }, [id, onPagesLogged]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveNow, 1500);
  }, [saveNow]);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden" && saveTimer.current) saveNow();
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [saveNow]);

  // ---- Open the book ---------------------------------------------------------
  useEffect(() => {
    if (!me || !partner) return;
    let cancelled = false;
    let view: any = null;

    (async () => {
      try {
        const [b, progs, a] = await Promise.all([
          supabase.from("books").select("*").eq("id", id).single(),
          supabase.from("progress").select("*").eq("book_id", id),
          supabase.from("annotations").select("*").eq("book_id", id).order("fraction"),
        ]);
        if (!b.data) throw new Error("This book isn’t on your shelf anymore.");
        if (cancelled) return;
        const mine = (progs.data ?? []).find((p: Progress) => p.reader_id === me.id) as Progress | undefined;
        const theirs = (progs.data ?? []).find((p: Progress) => p.reader_id === partner.id) as Progress | undefined;
        setBook(b.data as Book);
        setPartnerProg(theirs ?? null);
        maxRef.current = mine?.max_fraction ?? 0;
        finishedRef.current = mine?.finished_at ?? null;
        setMaxFraction(maxRef.current);
        const annList = (a.data ?? []) as Annotation[];
        setAnns(annList);
        if (annList.length) {
          const r = await supabase
            .from("replies")
            .select("*")
            .in("annotation_id", annList.map((x) => x.id))
            .order("created_at");
          if (!cancelled) setReplies((r.data ?? []) as Reply[]);
        }

        const file = await loadBookFile(id, b.data.file_path);
        await import("foliate-js/view.js");
        const { Overlayer } = await import("foliate-js/overlayer.js");
        if (cancelled || !hostRef.current) return;

        view = document.createElement("foliate-view");
        view.style.cssText = "display:block;width:100%;height:100%";
        hostRef.current.append(view);
        viewRef.current = view;
        await view.open(file);
        if (cancelled) return;

        const r = view.renderer;
        r.setAttribute("flow", "paginated");
        r.setAttribute("margin", "44px");
        r.setAttribute("gap", "7%");
        r.setAttribute("max-inline-size", "680px");
        r.setAttribute("max-column-count", "2");
        r.setAttribute("animated", "");
        r.setStyles?.(bookCSS(prefsRef.current));

        view.addEventListener("relocate", (e: CustomEvent) => {
          const { fraction, cfi, tocItem } = e.detail;
          const l: Loc = { cfi, fraction, chapter: tocItem?.label?.trim() || null };
          locRef.current = l;
          setLoc(l);
          // Reading page by page moves your "read up to here" mark. Big jumps (slider, jumping
          // to your partner) don't, so you don't see their notes on pages you skipped.
          const last = lastFractionRef.current;
          // A forward page turn counts toward today's reading streak
          if (last !== null && fraction > last && fraction - last < 0.02) pagesRef.current++;
          if (last !== null && fraction > maxRef.current && fraction - last > 0 && fraction - last < 0.02) {
            maxRef.current = fraction;
            setMaxFraction(fraction);
          }
          lastFractionRef.current = fraction;
          scheduleSave();
          if (partnerHereRef.current) sendPosition({ bookId: id, ...l });
        });

        view.addEventListener("load", (e: CustomEvent) => {
          const { doc, index } = e.detail as { doc: Document; index: number };
          let selTimer: ReturnType<typeof setTimeout> | null = null;
          doc.addEventListener("selectionchange", () => {
            if (selTimer) clearTimeout(selTimer);
            selTimer = setTimeout(() => {
              const sel = doc.getSelection();
              const text = sel?.toString().trim() ?? "";
              if (!sel || sel.isCollapsed || !text || sel.rangeCount === 0) {
                setSelection((s) => (s && s.index === index ? null : s));
              } else {
                setSelection({ index, range: sel.getRangeAt(0).cloneRange(), text });
                setChrome(false);
              }
            }, 250);
          });
          doc.addEventListener("click", (ev: MouseEvent) => {
            const sel = doc.getSelection();
            if (sel && !sel.isCollapsed) return;
            if ((ev.target as Element)?.closest?.("a[href]")) return;
            const frame = doc.defaultView?.frameElement as HTMLElement | null;
            const x = (frame?.getBoundingClientRect().left ?? 0) + ev.clientX;
            setTimeout(() => {
              if (Date.now() - annTapAt.current < 500) return;
              const w = window.innerWidth;
              if (x < w * 0.28) view.goLeft();
              else if (x > w * 0.72) view.goRight();
              else setChrome((c) => !c);
            }, 0);
          });
          doc.addEventListener("keydown", onKey);
        });

        view.addEventListener("create-overlay", () => {
          for (const a of visibleRef.current) view.addAnnotation({ value: a.cfi }).catch?.(() => {});
        });
        view.addEventListener("draw-annotation", (e: CustomEvent) => {
          const { draw, annotation } = e.detail;
          const owner = byCfiRef.current.get(annotation.value)?.[0];
          draw(Overlayer.highlight, { color: owner ? colorOfRef.current(owner.reader_id) : "#F5CB2E" });
        });
        view.addEventListener("show-annotation", (e: CustomEvent) => {
          annTapAt.current = Date.now();
          setOpenCfi(e.detail.value);
          setChrome(false);
        });

        setToc((view.book.toc ?? []) as TocItem[]);
        const start = joinOnOpen && theirs?.cfi ? theirs.cfi : mine?.cfi;
        await view.init({ lastLocation: start, showTextStart: !start });
        if (cancelled) return;
        setStatus("ready");
        if (joinOnOpen) toast(`On ${partner.name}’s page 💛`);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setErrorMsg((err as Error).message || "Couldn’t open this book.");
        setStatus("error");
      }
    })();

    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") viewRef.current?.goLeft();
      if (e.key === "ArrowRight") viewRef.current?.goRight();
    }
    window.addEventListener("keydown", onKey);

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
      if (saveTimer.current) saveNow();
      drawnRef.current = new Set();
      view?.close?.();
      view?.remove();
      if (viewRef.current === view) viewRef.current = null;
    };
    // Only re-open when the book or the people change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, me?.id, partner?.id]);

  // ---- Theme ----------------------------------------------------------------
  const theme = THEMES[prefs.theme];
  const g = prefs.theme === "night" ? readerGlassDark : readerGlass;
  useEffect(() => {
    const view = viewRef.current;
    if (status !== "ready" || !view) return;
    view.renderer.setStyles?.(bookCSS(prefs));
    const night = prefs.theme === "night";
    view.style.setProperty("--overlayer-highlight-opacity", night ? "0.32" : "0.42");
    view.style.setProperty("--overlayer-highlight-blend-mode", night ? "normal" : "multiply");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.bg);
    return () => document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#FFF8E1");
  }, [prefs, status, theme.bg]);

  // ---- Live: tell my partner I'm here, and follow them if asked --------------
  useEffect(() => {
    setActivity({ bookId: id, following });
  }, [id, following, setActivity]);
  useEffect(() => () => setActivity({ bookId: null, following: false }), [setActivity]);

  const wasHere = useRef(false);
  const greeted = useRef(false);
  useEffect(() => {
    if (partnerHere && !wasHere.current && partner) {
      if (locRef.current) sendPosition({ bookId: id, ...locRef.current });
      // Say hello once per session; the live pill shows the rest.
      if (status === "ready" && !greeted.current) {
        greeted.current = true;
        toast(`${partner.name} joined 💛`);
      }
    }
    if (!partnerHere && wasHere.current) setFollowing(false);
    wasHere.current = partnerHere;
  }, [partnerHere, partner, id, sendPosition, status, toast]);

  useEffect(() => {
    if (following && partnerLive?.bookId === id && partnerLive.cfi !== locRef.current?.cfi) {
      viewRef.current?.goTo(partnerLive.cfi);
    }
  }, [following, partnerLive, id]);

  // ---- Notes and highlights (live from Supabase) -----------------------------
  useEffect(() => {
    if (!me || !partner) return;
    const ch = supabase
      .channel(`book:${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "annotations", filter: `book_id=eq.${id}` },
        ({ new: a }) => {
          setAnns((all) => [...all.filter((x) => x.id !== a.id), a as Annotation]);
          if (a.reader_id === partner.id &&
            a.fraction <= Math.max(maxRef.current, locRef.current?.fraction ?? 0) + SPOILER_SLACK) {
            toast(`${partner.name} ${a.note ? "left a note" : "highlighted something"} ${a.emoji ?? "💛"}`);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "annotations", filter: `book_id=eq.${id}` },
        ({ new: a }) => setAnns((all) => all.map((x) => (x.id === a.id ? (a as Annotation) : x))),
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "annotations" }, ({ old }) =>
        setAnns((all) => all.filter((x) => x.id !== old.id)),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "replies" }, ({ new: r }) =>
        setReplies((all) => [...all.filter((x) => x.id !== r.id), r as Reply]),
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "replies" }, ({ old }) =>
        setReplies((all) => all.filter((x) => x.id !== old.id)),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "progress", filter: `book_id=eq.${id}` },
        ({ new: p }) => {
          if ((p as Progress)?.reader_id === partner.id) setPartnerProg(p as Progress);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, me, partner, toast]);

  // Partner notes show up to whichever is further: what you've read, or the page you're on now.
  const seenUpTo = Math.max(maxFraction, loc?.fraction ?? 0);
  const visible = useMemo(
    () => anns.filter((a) => a.reader_id === me?.id || a.fraction <= seenUpTo + SPOILER_SLACK),
    [anns, seenUpTo, me?.id],
  );
  const lockedCount = anns.length - visible.length;

  useEffect(() => {
    const map = new Map<string, Annotation[]>();
    for (const a of visible) map.set(a.cfi, [...(map.get(a.cfi) ?? []), a]);
    byCfiRef.current = map;
    visibleRef.current = visible;
    const view = viewRef.current;
    if (status !== "ready" || !view) return;
    const want = new Set(map.keys());
    for (const cfi of drawnRef.current) if (!want.has(cfi)) view.deleteAnnotation({ value: cfi }).catch?.(() => {});
    // Redraw all, so colors stay right when two notes share a spot
    for (const cfi of want) view.addAnnotation({ value: cfi }).catch?.(() => {});
    drawnRef.current = want;
  }, [visible, status]);

  // ---- Actions ---------------------------------------------------------------
  async function createAnnotation({ note, emoji }: { note?: string; emoji?: string }) {
    const view = viewRef.current;
    const s = selection;
    if (!view || !s || !me) return;
    const row = {
      book_id: id,
      reader_id: me.id,
      cfi: view.getCFI(s.index, s.range),
      fraction: rangeFraction(view, s.index, s.range),
      quote: s.text.slice(0, 2000),
      note: note?.trim() || null,
      emoji: emoji ?? null,
      chapter: locRef.current?.chapter ?? null,
    };
    view.deselect();
    setSelection(null);
    setComposer(false);
    const { data, error } = await supabase.from("annotations").insert(row).select().single();
    if (error) return toast("Couldn’t save");
    setAnns((all) => [...all.filter((x) => x.id !== data.id), data as Annotation]);
  }

  const jumpTo = (cfi: string) => {
    setFollowing(false);
    viewRef.current?.goTo(cfi);
    setPanel(null);
    setChrome(false);
  };

  const openList = openCfi ? visible.filter((a) => a.cfi === openCfi) : [];

  if (!me || !partner) return <div className="fixed inset-0 bg-cream" />;

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: theme.bg, color: theme.fg }}>
      {/* The book */}
      <div
        ref={hostRef}
        className="absolute inset-x-0"
        style={{ top: "env(safe-area-inset-top)", bottom: "env(safe-area-inset-bottom)" }}
      />

      {status === "loading" && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <img src="/icons/icon-192.png" alt="" className="mx-auto size-16 animate-pulse rounded-2xl" />
            <p className="mt-3 text-sm" style={{ color: theme.muted }}>
              Opening {book?.title ?? "your book"}…
            </p>
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 grid place-items-center px-8 text-center">
          <div>
            <p className="text-3xl">🍋</p>
            <p className="mt-2 font-medium">{errorMsg}</p>
            <Link href="/" className="mt-4 inline-block underline">
              Back to the shelf
            </Link>
          </div>
        </div>
      )}

      {/* Quiet footer: chapter + progress */}
      {status === "ready" && !chrome && (
        <div
          className="pointer-events-none absolute inset-x-0 flex items-center justify-between gap-4 px-6 text-[11px]"
          style={{ bottom: "env(safe-area-inset-bottom)", height: 40, color: theme.muted }}
        >
          <span className="truncate">{loc?.chapter ?? ""}</span>
          <span className="flex shrink-0 items-center gap-2 tabular-nums">
            {partnerPos && (
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-full" style={{ background: partner.color }} />
                {pct(partnerPos.fraction)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="inline-block size-2 rounded-full" style={{ background: me.color }} />
              {pct(loc?.fraction)}
            </span>
          </span>
        </div>
      )}

      {/* Live pill: partner is in this book right now */}
      {status === "ready" && partnerHere && (
        <button
          onClick={() => setPanel("live")}
          className={`absolute left-1/2 z-20 flex h-9 -translate-x-1/2 items-center gap-2 rounded-full pr-3.5 pl-1 text-xs font-medium transition-[translate,opacity] duration-300 ease-out ${g} ${
            chrome ? "pointer-events-none -translate-y-3 opacity-0" : ""
          }`}
          style={{ top: "calc(env(safe-area-inset-top) + 10px)", color: theme.fg }}
        >
          <span className="live-pulse rounded-full">
            <Avatar reader={partner} size={26} />
          </span>
          {following ? `Following ${partner.name}` : partnerFollowingMe ? `${partner.name} is following you` : `${partner.name} is here`}
        </button>
      )}

      {/* Floating controls: slide in when you tap the middle of the page */}
      {status === "ready" && (
        <>
          <header
            inert={!chrome}
            className={`pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-[calc(env(safe-area-inset-top)+8px)] transition-[translate,opacity] duration-300 ease-out ${
              chrome ? "" : "-translate-y-[120%] opacity-0"
            }`}
          >
            <div
              className={`pointer-events-auto mx-auto flex h-12 max-w-2xl items-center gap-1 rounded-full pr-1.5 pl-1 ${g}`}
              style={{ color: theme.fg }}
            >
              <Link href="/" className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-black/5" aria-label="Back to shelf">
                <ChevronLeftIcon className="size-5" />
              </Link>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate font-serif text-[15px] font-semibold">{book?.title}</p>
                <p className="truncate text-[11px]" style={{ color: theme.muted }}>
                  {loc?.chapter}
                </p>
              </div>
              {partnerHere ? (
                <button
                  onClick={() => setPanel("live")}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-lemon px-3.5 text-xs font-semibold text-ink shadow-[0_6px_18px_rgb(224_173_0/0.35)]"
                >
                  <span className="size-2 rounded-full bg-leaf" /> Live
                </button>
              ) : (
                <button
                  onClick={async () => {
                    toast(await nudge(id, "read"));
                  }}
                  className="h-9 shrink-0 rounded-full bg-lemon px-3.5 text-xs font-semibold text-ink shadow-[0_6px_18px_rgb(224_173_0/0.35)]"
                >
                  Read with me?
                </button>
              )}
            </div>
          </header>

          <div
            inert={!chrome}
            className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] transition-[translate,opacity] duration-300 ease-out ${
              chrome ? "" : "translate-y-[120%] opacity-0"
            }`}
          >
            <div className={`pointer-events-auto w-full max-w-lg rounded-[28px] px-4 pt-3 pb-1.5 ${g}`} style={{ color: theme.fg }}>
              <ProgressTrack
                me={{ color: me.color, fraction: loc?.fraction ?? 0 }}
                partner={partnerPos ? { color: partner.color, fraction: partnerPos.fraction, name: partner.name } : null}
                onSeek={(f) => {
                  setFollowing(false);
                  viewRef.current?.goToFraction(f);
                }}
                onPartner={() => partnerPos && jumpTo(partnerPos.cfi)}
                muted={theme.muted}
              />
              <div className="mt-2 grid grid-cols-4 text-[10.5px]">
                <ChromeButton icon={ListIcon} label="Contents" onClick={() => setPanel("toc")} />
                <ChromeButton
                  icon={MessageSquareQuoteIcon}
                  label={visible.length ? `Notes · ${visible.length}` : "Notes"}
                  onClick={() => setPanel("notes")}
                />
                <ChromeButton
                  icon={LocateFixedIcon}
                  label={`To ${partner.name}`}
                  disabled={!partnerPos}
                  onClick={() => partnerPos && jumpTo(partnerPos.cfi)}
                />
                <ChromeButton icon={ALargeSmallIcon} label="Text" onClick={() => setPanel("type")} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Selection actions */}
      {selection && !composer && (
        <div
          className={`sheet-in absolute inset-x-3 z-30 mx-auto max-w-md rounded-[28px] p-2.5 ${g}`}
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)", color: theme.fg }}
          onPointerDown={(e) => e.preventDefault()}
        >
          <div className="flex justify-between px-1">
            {EMOJI.map((e) => (
              <button
                key={e}
                onClick={() => createAnnotation({ emoji: e })}
                className="grid size-11 place-items-center rounded-full text-2xl transition-transform active:scale-90"
              >
                {e}
              </button>
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-sm font-semibold">
            <button
              onClick={() => createAnnotation({})}
              className="flex h-11 items-center justify-center gap-1.5 rounded-full"
              style={{ background: me.color + "55" }}
            >
              <HighlighterIcon className="size-4" /> Highlight
            </button>
            <button
              onClick={() => setComposer(true)}
              className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-lemon text-ink shadow-[0_6px_18px_rgb(224_173_0/0.35)]"
            >
              <PenLineIcon className="size-4" /> Note
            </button>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(selection.text);
                viewRef.current?.deselect();
                setSelection(null);
                toast("Copied");
              }}
              className="flex h-11 items-center justify-center gap-1.5 rounded-full"
              style={{ background: "rgba(127,127,127,.14)" }}
            >
              <CopyIcon className="size-4" /> Copy
            </button>
          </div>
        </div>
      )}

      <NoteComposer
        open={composer && !!selection}
        quote={selection?.text ?? ""}
        onCancel={() => setComposer(false)}
        onSave={(note, emoji) => createAnnotation({ note, emoji })}
      />

      {/* A highlight was tapped */}
      <Sheet open={!!openCfi && openList.length > 0} onClose={() => setOpenCfi(null)} tone={prefs.theme === "night" ? "dark" : "light"}>
        {openList.length > 0 && (
          <AnnotationThread
            list={openList}
            replies={replies.filter((r) => r.annotation_id === openList[0].id)}
            meId={me.id}
            colorOf={colorOf}
            nameOf={nameOf}
            onDeleted={(annId) => {
              setAnns((all) => all.filter((x) => x.id !== annId));
              if (openList.length <= 1) setOpenCfi(null);
            }}
            onReply={(r) => setReplies((all) => [...all.filter((x) => x.id !== r.id), r])}
            onUpdated={(a) => setAnns((all) => all.map((x) => (x.id === a.id ? a : x)))}
          />
        )}
      </Sheet>

      <Sheet open={panel === "notes"} onClose={() => setPanel(null)} title="Notes" tone={prefs.theme === "night" ? "dark" : "light"}>
        {visible.length === 0 && (
          <p className="text-sm opacity-70">Select text to highlight</p>
        )}
        <div className="space-y-3">
          {visible.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                jumpTo(a.cfi);
                setTimeout(() => setOpenCfi(a.cfi), 450);
              }}
              className="block w-full rounded-2xl p-3 text-left"
              style={{ background: "rgba(127,127,127,.08)" }}
            >
              <div className="flex items-center gap-2 text-xs opacity-70">
                <span className="size-2.5 rounded-full" style={{ background: colorOf(a.reader_id) }} />
                {nameOf(a.reader_id)} · {a.chapter ?? pct(a.fraction)}
                {a.emoji && <span className="ml-auto text-base">{a.emoji}</span>}
              </div>
              <p className="mt-1.5 line-clamp-3 font-serif text-[15px] italic leading-snug">“{a.quote}”</p>
              {a.note && <p className="mt-1.5 text-sm">{a.note}</p>}
              {replies.some((r) => r.annotation_id === a.id) && (
                <p className="mt-1 text-xs opacity-60">
                  💬 {replies.filter((r) => r.annotation_id === a.id).length}
                </p>
              )}
            </button>
          ))}
        </div>
        {lockedCount > 0 && (
          <p className="mt-4 rounded-2xl bg-lemon/20 p-3 text-center text-sm">
            🔒 {lockedCount} more from {partner.name} ahead
          </p>
        )}
      </Sheet>

      <Sheet open={panel === "toc"} onClose={() => setPanel(null)} title="Contents" tone={prefs.theme === "night" ? "dark" : "light"}>
        <TocList
          items={toc}
          current={loc?.chapter ?? null}
          onGo={(href) => {
            setFollowing(false);
            viewRef.current?.goTo(href);
            setPanel(null);
            setChrome(false);
          }}
        />
      </Sheet>

      <Sheet open={panel === "type"} onClose={() => setPanel(null)} title="Text" tone={prefs.theme === "night" ? "dark" : "light"}>
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(THEMES) as Prefs["theme"][]).map((t) => (
              <button
                key={t}
                onClick={() => setPrefs({ theme: t })}
                className="rounded-2xl py-3 text-sm font-medium"
                style={{
                  background: THEMES[t].bg,
                  color: THEMES[t].fg,
                  boxShadow: prefs.theme === t ? "0 0 0 2px #E0AD00" : "0 0 0 1px rgba(127,127,127,.25)",
                }}
              >
                {THEMES[t].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPrefs({ size: Math.max(70, prefs.size - 10) })}
              className="h-11 flex-1 rounded-2xl text-sm"
              style={{ background: "rgba(127,127,127,.12)" }}
            >
              A−
            </button>
            <span className="w-14 text-center text-sm tabular-nums">{prefs.size}%</span>
            <button
              onClick={() => setPrefs({ size: Math.min(180, prefs.size + 10) })}
              className="h-11 flex-1 rounded-2xl text-lg"
              style={{ background: "rgba(127,127,127,.12)" }}
            >
              A+
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            {(
              [
                ["book", "Book’s font"],
                ["serif", "Serif"],
                ["sans", "Sans"],
              ] as const
            ).map(([f, label]) => (
              <button
                key={f}
                onClick={() => setPrefs({ font: f })}
                className="rounded-2xl py-3"
                style={{
                  fontFamily: f === "sans" ? "ui-sans-serif, system-ui" : f === "serif" ? "ui-serif, Georgia" : undefined,
                  background: "rgba(127,127,127,.12)",
                  boxShadow: prefs.font === f ? "0 0 0 2px #E0AD00" : undefined,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Sheet>

      <Sheet
        open={panel === "live"}
        onClose={() => setPanel(null)}
        title={`Reading with ${partner.name}`}
        tone={prefs.theme === "night" ? "dark" : "light"}
      >
        {partnerHere && (
          <div className="space-y-2">
            <button
              onClick={() => partnerPos && jumpTo(partnerPos.cfi)}
              className="w-full rounded-2xl bg-lemon px-4 py-3.5 text-left font-semibold text-ink"
            >
              Go to {partner.name}’s page
            </button>
            <button
              disabled={partnerFollowingMe}
              onClick={() => {
                setFollowing((f) => !f);
                setPanel(null);
                if (!following && partnerPos) viewRef.current?.goTo(partnerPos.cfi);
              }}
              className="w-full rounded-2xl px-4 py-3.5 text-left font-semibold disabled:opacity-50"
              style={{ background: "rgba(127,127,127,.12)" }}
            >
              {following ? "Stop following" : `Follow ${partner.name}’s page turns`}
              {partnerFollowingMe && (
                <span className="block text-xs font-normal opacity-70">{partner.name} is following you</span>
              )}
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function ChromeButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-14 flex-col items-center justify-center gap-1 rounded-full transition-transform active:scale-95 active:bg-black/5 disabled:opacity-40"
    >
      <Icon className="size-5" strokeWidth={1.8} />
      <span className="max-w-full truncate px-1 leading-none">{label}</span>
    </button>
  );
}

function ProgressTrack({
  me,
  partner,
  onSeek,
  onPartner,
  muted,
}: {
  me: { color: string; fraction: number };
  partner: { color: string; fraction: number; name: string } | null;
  onSeek: (f: number) => void;
  onPartner: () => void;
  muted: string;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const value = drag ?? me.fraction;
  return (
    <div>
      <div className="relative h-9">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full" style={{ background: "rgba(127,127,127,.2)" }}>
          <div className="h-full rounded-full" style={{ width: pct(value), background: me.color }} />
        </div>
        {partner && (
          <button
            onClick={onPartner}
            className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-[calc(50%+14px)] rounded-full px-1.5 py-0.5 text-[10px] font-bold text-ink shadow"
            style={{ left: pct(partner.fraction), background: partner.color }}
            aria-label={`Jump to ${partner.name}`}
          >
            {partner.name[0]}
          </button>
        )}
        <input
          type="range"
          min={0}
          max={1}
          step={0.0005}
          value={value}
          onChange={(e) => setDrag(parseFloat(e.target.value))}
          onPointerUp={() => {
            if (drag !== null) onSeek(drag);
            setDrag(null);
          }}
          onKeyUp={() => {
            if (drag !== null) onSeek(drag);
            setDrag(null);
          }}
          className="absolute inset-0 w-full cursor-pointer opacity-0"
          aria-label="Position in book"
        />
        <div
          className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: pct(value), background: me.color }}
        />
      </div>
      <div className="flex justify-between text-[11px] tabular-nums" style={{ color: muted }}>
        <span>You · {pct(value)}</span>
        {partner && (
          <span>
            {partner.name} · {pct(partner.fraction)}
          </span>
        )}
      </div>
    </div>
  );
}

function TocList({ items, current, onGo, depth = 0 }: { items: TocItem[]; current: string | null; onGo: (href: string) => void; depth?: number }) {
  return (
    <ul className={depth ? "ml-4" : ""}>
      {items.map((it, i) => (
        <li key={`${it.href}-${i}`}>
          <button
            onClick={() => onGo(it.href)}
            className={`w-full rounded-xl px-3 py-2.5 text-left text-[15px] ${current === it.label?.trim() ? "bg-lemon/30 font-semibold" : ""}`}
          >
            {it.label?.trim()}
          </button>
          {it.subitems?.length ? <TocList items={it.subitems} current={current} onGo={onGo} depth={depth + 1} /> : null}
        </li>
      ))}
    </ul>
  );
}

function NoteComposer({
  open,
  quote,
  onCancel,
  onSave,
}: {
  open: boolean;
  quote: string;
  onCancel: () => void;
  onSave: (note: string, emoji?: string) => void;
}) {
  const [text, setText] = useState("");
  const [emoji, setEmoji] = useState<string | undefined>();
  return (
    <Sheet
      open={open}
      onClose={() => {
        setText("");
        onCancel();
      }}
      title="Note"
    >
      <p className="line-clamp-3 border-l-4 border-lemon pl-3 font-serif text-[15px] italic text-ink/80">“{quote}”</p>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a note…"
        rows={3}
        className="mt-4 w-full resize-none rounded-2xl border border-ink/10 bg-white/60 p-3 outline-none focus:border-lemon-deep"
      />
      <div className="mt-2 flex gap-1">
        {EMOJI.map((e) => (
          <button
            key={e}
            onClick={() => setEmoji(emoji === e ? undefined : e)}
            className={`grid size-10 place-items-center rounded-full text-xl ${emoji === e ? "bg-lemon/50" : ""}`}
          >
            {e}
          </button>
        ))}
      </div>
      <button
        disabled={!text.trim()}
        onClick={() => {
          onSave(text, emoji);
          setText("");
          setEmoji(undefined);
        }}
        className="mt-4 w-full rounded-2xl bg-lemon py-3.5 font-semibold disabled:opacity-50"
      >
        Save note
      </button>
    </Sheet>
  );
}

function AnnotationThread({
  list,
  replies,
  meId,
  colorOf,
  nameOf,
  onDeleted,
  onReply,
  onUpdated,
}: {
  list: Annotation[];
  replies: Reply[];
  meId: string;
  colorOf: (id: string) => string;
  nameOf: (id: string) => string;
  onDeleted: (id: string) => void;
  onReply: (r: Reply) => void;
  onUpdated: (a: Annotation) => void;
}) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const first = list[0];

  return (
    <div>
      <p className="border-l-4 pl-3 font-serif text-[16px] italic leading-relaxed" style={{ borderColor: colorOf(first.reader_id) }}>
        “{first.quote}”
      </p>

      <div className="mt-4 space-y-3">
        {list.map((a) => (
          <div key={a.id} className="flex gap-2.5">
            <span className="mt-0.5 size-6 shrink-0 rounded-full" style={{ background: colorOf(a.reader_id) }} />
            <div className="min-w-0 flex-1">
              <p className="text-xs opacity-60">
                {nameOf(a.reader_id)} · {timeAgo(a.created_at)} {a.emoji}
              </p>
              {editing === a.id ? (
                <div className="mt-1">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-xl border border-current/20 bg-transparent p-2 outline-none"
                  />
                  <button
                    className="mt-1 rounded-full bg-lemon px-3 py-1 text-sm font-semibold text-ink"
                    onClick={async () => {
                      const { data } = await supabase
                        .from("annotations")
                        .update({ note: editText.trim() || null })
                        .eq("id", a.id)
                        .select()
                        .single();
                      if (data) onUpdated(data as Annotation);
                      setEditing(null);
                    }}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <p className="mt-0.5">{a.note ?? <span className="opacity-50">Highlighted</span>}</p>
              )}
              {a.reader_id === meId && editing !== a.id && (
                <div className="mt-1 flex gap-3 text-xs opacity-60">
                  <button
                    onClick={() => {
                      setEditing(a.id);
                      setEditText(a.note ?? "");
                    }}
                  >
                    {a.note ? "Edit" : "Add note"}
                  </button>
                  <button
                    onClick={async () => {
                      const { error } = await supabase.from("annotations").delete().eq("id", a.id);
                      if (!error) onDeleted(a.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {replies.map((r) => (
          <div key={r.id} className="ml-8 flex gap-2.5">
            <span className="mt-0.5 size-5 shrink-0 rounded-full" style={{ background: colorOf(r.reader_id) }} />
            <div>
              <p className="text-xs opacity-60">
                {nameOf(r.reader_id)} · {timeAgo(r.created_at)}
              </p>
              <p className="mt-0.5">{r.body}</p>
            </div>
          </div>
        ))}
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          const { data } = await supabase
            .from("replies")
            .insert({ annotation_id: first.id, reader_id: meId, body: text.trim() })
            .select()
            .single();
          if (data) onReply(data as Reply);
          setText("");
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Reply…"
          className="min-w-0 flex-1 rounded-full border border-current/15 bg-transparent px-4 py-2.5 outline-none"
        />
        <button className="rounded-full bg-lemon px-4 font-semibold text-ink">Send</button>
      </form>
    </div>
  );
}
