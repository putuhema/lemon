"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronLeftIcon,
  CopyIcon,
  HighlighterIcon,
  MessageSquareQuoteIcon,
  PenLineIcon,
  Trash2Icon,
  ZoomInIcon,
} from "lucide-react";
import { useLemon } from "@/lib/lemon";
import { supabase } from "@/lib/supabase";
import { isOffline } from "@/lib/offline";
import { haptic } from "@/lib/haptics";
import { pct } from "@/lib/format";
import { glass, glassDense } from "@/lib/glass";
import { PAPERS_BUCKET } from "@/lib/papers";
import type { PaperBody, PaperNote, PaperProgress, Reply } from "@/lib/types";
import { BotHead } from "@/components/BotHead";
import { ConfirmButton } from "@/components/ConfirmButton";
import { LemonMark } from "@/components/LemonMark";
import { AnnotationThread, EMOJI, NoteComposer } from "@/components/Notes";
import { QuoteCard } from "@/components/QuoteCard";
import { Sheet } from "@/components/Sheet";
import { PdfViewer } from "@/components/journal/PdfViewer";
import { ArticleViewer } from "@/components/journal/ArticleViewer";
import type { PaperSelection, PaperViewerHandle, Place } from "@/components/journal/types";

/** Partner notes unlock once you've read up to them (a little wiggle room for different screens). */
const SPOILER_SLACK = 0.01;
/** Scrolled this far: the paper counts as finished. */
const FINISHED_AT = 0.97;

export default function PaperPage() {
  return (
    <Suspense>
      <ForPaper />
    </Suspense>
  );
}

/** A fresh reader for each paper (Next keeps visited pages alive, so state would carry over otherwise). */
function ForPaper() {
  const id = useSearchParams().get("p") ?? "";
  return <PaperReader key={id} id={id} />;
}

function PaperReader({ id }: { id: string }) {
  const { me, partner, partnerActivity, setActivity, toast, colorOf, nameOf } = useLemon();

  const viewerRef = useRef<PaperViewerHandle>(null);
  const [paper, setPaper] = useState<PaperBody | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [initial, setInitial] = useState<Place>({ page: 1, fraction: 0 });
  const [place, setPlace] = useState<Place>({ page: 1, fraction: 0 });
  const [maxFraction, setMaxFraction] = useState(0);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [partnerProg, setPartnerProg] = useState<PaperProgress | null>(null);
  const [notes, setNotes] = useState<PaperNote[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [selection, setSelection] = useState<PaperSelection | null>(null);
  const [composer, setComposer] = useState(false);
  const [openIds, setOpenIds] = useState<string[] | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [cardFor, setCardFor] = useState<PaperNote | null>(null);
  const [zoom, setZoom] = useState(1);

  // Refs for callbacks that outlive a render
  const placeRef = useRef<Place>({ page: 1, fraction: 0 });
  const maxRef = useRef(0);
  const finishedRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composerRef = useRef(false);
  useEffect(() => {
    composerRef.current = composer;
  });

  // Next keeps this page alive (hidden) after you leave it. Close what was open, so a hidden
  // selection bar can't save a highlight and you come back to a clean page.
  useLayoutEffect(
    () => () => {
      setSelection(null);
      setComposer(false);
      setOpenIds(null);
      setNotesOpen(false);
      setCardFor(null);
    },
    [],
  );

  // ---- Load ------------------------------------------------------------------
  useEffect(() => {
    if (!me || !id) return;
    let cancelled = false;
    (async () => {
      const [p, pr, n] = await Promise.all([
        supabase.from("papers").select("*").eq("id", id).single(),
        supabase.from("paper_progress").select("*").eq("paper_id", id),
        supabase.from("annotations").select("*").eq("paper_id", id).order("fraction"),
      ]);
      if (cancelled) return;
      if (!p.data) {
        setStatus("error");
        return;
      }
      const body = p.data as PaperBody;
      if (body.kind === "pdf" && body.file_path) {
        const { data } = await supabase.storage.from(PAPERS_BUCKET).createSignedUrl(body.file_path, 60 * 60 * 6);
        if (cancelled) return;
        if (!data?.signedUrl) {
          setStatus("error");
          return;
        }
        setPdfUrl(data.signedUrl);
      }
      const all = (pr.data ?? []) as PaperProgress[];
      const mine = all.find((x) => x.reader_id === me.id);
      setPartnerProg(all.find((x) => x.reader_id !== me.id) ?? null);
      if (mine) {
        const start = { page: mine.page, fraction: mine.fraction };
        placeRef.current = start;
        maxRef.current = mine.max_fraction;
        finishedRef.current = mine.finished_at;
        setInitial(start);
        setPlace(start);
        setMaxFraction(mine.max_fraction);
      }
      const list = (n.data ?? []) as PaperNote[];
      setNotes(list);
      if (list.length) {
        const r = await supabase.from("replies").select("*").in("annotation_id", list.map((x) => x.id)).order("created_at");
        if (!cancelled) setReplies((r.data ?? []) as Reply[]);
      }
      setPageCount(body.page_count);
      setPaper(body);
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [id, me]);

  // ---- Live: notes, replies, and your partner's place ---------------------------
  useEffect(() => {
    if (!me || !partner || !id) return;
    const ch = supabase
      .channel(`paper:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "annotations", filter: `paper_id=eq.${id}` }, ({ new: n }) => {
        const note = n as PaperNote;
        setNotes((all) => [...all.filter((x) => x.id !== note.id), note]);
        if (note.reader_id === partner.id && note.fraction <= Math.max(maxRef.current, placeRef.current.fraction) + SPOILER_SLACK) {
          toast(`${partner.name} ${note.note ? "left a note" : "highlighted something"} ${note.emoji ?? "💛"}`);
          haptic("bump");
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "annotations", filter: `paper_id=eq.${id}` }, ({ new: n }) =>
        setNotes((all) => all.map((x) => (x.id === n.id ? (n as PaperNote) : x))),
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "annotations" }, ({ old }) =>
        setNotes((all) => all.filter((x) => x.id !== old.id)),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "replies" }, ({ new: r }) =>
        setReplies((all) => [...all.filter((x) => x.id !== r.id), r as Reply]),
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "replies" }, ({ old }) =>
        setReplies((all) => all.filter((x) => x.id !== old.id)),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "paper_progress", filter: `paper_id=eq.${id}` }, ({ new: p }) => {
        if ((p as PaperProgress)?.reader_id === partner.id) setPartnerProg(p as PaperProgress);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, me, partner, toast]);

  // Tell your partner you're in this paper
  useEffect(() => {
    if (id) setActivity({ bookId: `paper:${id}`, following: false });
  }, [id, setActivity]);
  useEffect(() => () => setActivity({ bookId: null, following: false }), [setActivity]);
  const partnerHere = partnerActivity?.bookId === `paper:${id}`;

  // ---- Saving your place --------------------------------------------------------
  const saveNow = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (!me || !id || !dirtyRef.current || isOffline()) return;
    dirtyRef.current = false;
    const p = placeRef.current;
    await supabase.from("paper_progress").upsert({
      reader_id: me.id,
      paper_id: id,
      page: p.page,
      fraction: p.fraction,
      max_fraction: maxRef.current,
      finished_at: finishedRef.current,
      updated_at: new Date().toISOString(),
    });
  }, [me, id]);

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && saveNow();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      saveNow();
    };
  }, [saveNow]);

  const onProgress = useCallback(
    (p: Place) => {
      placeRef.current = p;
      setPlace(p);
      if (p.fraction > maxRef.current) {
        maxRef.current = p.fraction;
        setMaxFraction(p.fraction);
      }
      if (p.fraction >= FINISHED_AT && !finishedRef.current) {
        finishedRef.current = new Date().toISOString();
        haptic("success");
        toast("Finished 🎉");
      }
      dirtyRef.current = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(saveNow, 1500);
    },
    [saveNow, toast],
  );

  const onPageCount = useCallback(
    (n: number) => {
      setPageCount(n);
      if (paper && paper.page_count !== n) supabase.from("papers").update({ page_count: n }).eq("id", paper.id).then();
    },
    [paper],
  );

  const onSelect = useCallback((s: PaperSelection | null) => {
    // Writing a note moves the focus, which clears the page selection: keep what was selected
    if (composerRef.current) return;
    setSelection(s);
  }, []);

  const onNoteTap = useCallback((ids: string[]) => {
    haptic("tick");
    setOpenIds(ids);
  }, []);

  // ---- Notes ---------------------------------------------------------------------
  const seenUpTo = Math.max(maxFraction, place.fraction);
  const visible = useMemo(
    () => notes.filter((n) => n.reader_id === me?.id || n.fraction <= seenUpTo + SPOILER_SLACK),
    [notes, seenUpTo, me?.id],
  );
  const lockedCount = notes.length - visible.length;
  const openList = useMemo(() => visible.filter((n) => openIds?.includes(n.id)), [visible, openIds]);

  async function createNote({ note, emoji }: { note?: string; emoji?: string }) {
    const s = selection;
    if (!s || !me) return;
    haptic("success");
    viewerRef.current?.clearSelection();
    setSelection(null);
    setComposer(false);
    const { data, error } = await supabase
      .from("annotations")
      .insert({
        paper_id: id,
        reader_id: me.id,
        fraction: s.fraction,
        quote: s.quote,
        note: note?.trim() || null,
        emoji: emoji ?? null,
        page: s.page ?? null,
        rects: s.rects ?? null,
        start_offset: s.range?.start ?? null,
        end_offset: s.range?.end ?? null,
      })
      .select()
      .single();
    if (error) return toast(isOffline() ? "You’re offline. Try again when connected." : "Couldn’t save");
    setNotes((all) => [...all.filter((x) => x.id !== data.id), data as PaperNote]);
  }

  // ---- Render ---------------------------------------------------------------------
  if (!me) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <LemonMark className="splash-mark size-24" />
      </main>
    );
  }
  if (status === "error" || !id) {
    return (
      <main className="grid min-h-dvh place-items-center px-8 text-center">
        <div>
          <p className="text-4xl">📄</p>
          <p className="mt-3 font-semibold">Couldn’t open this paper.</p>
          <Link href="/journals" className="mt-4 inline-block underline">
            Back to journals
          </Link>
        </div>
      </main>
    );
  }

  const partnerPlace =
    partner && partnerProg && partnerProg.fraction > 0
      ? { page: partnerProg.page, fraction: partnerProg.fraction, name: partner.name, color: partner.color }
      : null;
  const viewerProps = {
    notes: visible,
    colorOf,
    initial,
    partner: partnerPlace,
    onProgress,
    onSelect,
    onNoteTap,
  };
  const where =
    paper?.kind === "pdf" ? `${place.page}${pageCount ? ` / ${pageCount}` : ""}` : pct(place.fraction);

  return (
    <main className="fixed inset-0 flex flex-col bg-cream">
      {/* Header */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-30 px-3 pt-[calc(env(safe-area-inset-top)+8px)]">
        <div className={`pointer-events-auto mx-auto flex h-12 max-w-2xl items-center gap-1 rounded-full pr-1.5 pl-1.5 ${glass}`}>
          <Link
            href="/journals"
            onClick={() => saveNow()}
            aria-label="Back to journals"
            className="grid size-9 shrink-0 place-items-center rounded-full active:bg-ink/5"
          >
            <ChevronLeftIcon className="size-5" />
          </Link>
          <p className="min-w-0 flex-1 truncate font-serif text-[15px] font-semibold">{paper?.title ?? "…"}</p>
          {partnerPlace && (
            <button
              onClick={() => {
                haptic("tap");
                viewerRef.current?.scrollToPlace(partnerPlace);
              }}
              aria-label={`Go to ${partnerPlace.name}’s place`}
              title={`Go to ${partnerPlace.name}’s place`}
              className="relative grid size-9 shrink-0 place-items-center rounded-full active:bg-ink/5"
            >
              <BotHead color={partnerPlace.color} size={24} mood={partnerHere ? "happy" : "idle"} />
              {partnerHere && (
                <span className="absolute right-1 bottom-1 size-2 rounded-full bg-leaf ring-2 ring-paper" />
              )}
            </button>
          )}
          <button
            onClick={() => {
              haptic("tick");
              setZoom((z) => [1.5, 2].find((level) => level > z + 0.01) ?? 1);
            }}
            aria-label={`Zoom (${Math.round(zoom * 10) / 10}×)`}
            className="flex h-9 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold tabular-nums active:bg-ink/5"
          >
            <ZoomInIcon className="size-4.5" />
            {zoom > 1 && `${Math.round(zoom * 10) / 10}×`}
          </button>
          <button
            onClick={() => setNotesOpen(true)}
            aria-label="Notes"
            className="flex h-9 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold active:bg-ink/5"
          >
            <MessageSquareQuoteIcon className="size-4.5" />
            {visible.length > 0 && visible.length}
          </button>
        </div>
      </header>

      {status === "loading" || !paper ? (
        <div className="grid flex-1 place-items-center">
          <LemonMark className="splash-mark size-16" />
        </div>
      ) : paper.kind === "pdf" && pdfUrl ? (
        <PdfViewer
          ref={viewerRef}
          url={pdfUrl}
          pageCount={pageCount}
          zoom={zoom}
          onZoomChange={setZoom}
          onPageCount={onPageCount}
          {...viewerProps}
        />
      ) : (
        <ArticleViewer
          ref={viewerRef}
          html={paper.article_html ?? ""}
          title={paper.title}
          source={paper.source}
          byline={paper.byline}
          sourceUrl={paper.source_url}
          zoom={zoom}
          onZoomChange={setZoom}
          {...viewerProps}
        />
      )}

      {/* Where you are */}
      {status === "ready" && !selection && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center pb-[calc(env(safe-area-inset-bottom)+14px)]">
          <span className={`rounded-full px-3 py-1 text-xs font-medium tabular-nums text-muted ${glass}`}>{where}</span>
        </div>
      )}

      {/* Selection actions */}
      {selection && !composer && (
        <div
          className={`sheet-in fixed inset-x-3 z-30 mx-auto max-w-md rounded-[28px] p-2.5 ${glassDense}`}
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
          onPointerDown={(e) => e.preventDefault()}
        >
          <div className="flex justify-between px-1">
            {EMOJI.map((e) => (
              <button
                key={e}
                onClick={() => createNote({ emoji: e })}
                className="grid size-11 place-items-center rounded-full text-2xl transition-transform active:scale-90"
              >
                {e}
              </button>
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-sm font-semibold">
            <button
              onClick={() => createNote({})}
              className="flex h-11 items-center justify-center gap-1.5 rounded-full"
              style={{ background: me.color + "55" }}
            >
              <HighlighterIcon className="size-4" /> Highlight
            </button>
            <button
              onClick={() => setComposer(true)}
              className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-lemon text-on-lemon"
            >
              <PenLineIcon className="size-4" /> Note
            </button>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(selection.quote);
                viewerRef.current?.clearSelection();
                setSelection(null);
                toast("Copied");
              }}
              className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-ink/10"
            >
              <CopyIcon className="size-4" /> Copy
            </button>
          </div>
        </div>
      )}

      <NoteComposer
        open={composer && !!selection}
        quote={selection?.quote ?? ""}
        onCancel={() => {
          setComposer(false);
          setSelection(null);
        }}
        onSave={(note, emoji) => createNote({ note, emoji })}
      />

      {/* A highlight was tapped */}
      <Sheet open={openList.length > 0} onClose={() => setOpenIds(null)}>
        {openList.length > 0 && (
          <AnnotationThread
            list={openList}
            replies={replies.filter((r) => r.annotation_id === openList[0].id)}
            meId={me.id}
            colorOf={colorOf}
            nameOf={nameOf}
            onDeleted={(noteId) => {
              setNotes((all) => all.filter((x) => x.id !== noteId));
              if (openList.length <= 1) setOpenIds(null);
            }}
            onReply={(r) => setReplies((all) => [...all.filter((x) => x.id !== r.id), r])}
            onUpdated={(n) => setNotes((all) => all.map((x) => (x.id === n.id ? n : x)))}
            onError={toast}
            onCard={(n) => {
              setOpenIds(null);
              setCardFor(n);
            }}
          />
        )}
      </Sheet>

      {partner && (
        <QuoteCard
          annotation={cardFor}
          book={paper ? { title: paper.title, author: paper.byline ?? paper.source } : null}
          me={me}
          partner={partner}
          onClose={() => setCardFor(null)}
        />
      )}

      <Sheet open={notesOpen} onClose={() => setNotesOpen(false)} title="Notes">
        {visible.length === 0 && <p className="text-sm text-muted">Select text to highlight</p>}
        <div className="space-y-3">
          {visible.map((n) => (
            <div key={n.id} className="relative">
              <button
                onClick={() => {
                  setNotesOpen(false);
                  viewerRef.current?.scrollToNote(n);
                  setTimeout(() => setOpenIds([n.id]), 450);
                }}
                className={`block w-full rounded-2xl bg-ink/5 p-3 text-left ${n.reader_id === me.id ? "pr-12" : ""}`}
              >
                <div className="flex items-center gap-2 text-xs text-muted">
                  <BotHead color={colorOf(n.reader_id)} size={18} />
                  {nameOf(n.reader_id)} · {n.page ? `p. ${n.page}` : pct(n.fraction)}
                  {n.emoji && <span className="ml-auto text-base">{n.emoji}</span>}
                </div>
                <p className="mt-1.5 line-clamp-3 font-serif text-[15px] leading-snug italic">“{n.quote}”</p>
                {n.note && <p className="mt-1.5 text-sm">{n.note}</p>}
                {replies.some((r) => r.annotation_id === n.id) && (
                  <p className="mt-1 text-xs text-muted">💬 {replies.filter((r) => r.annotation_id === n.id).length}</p>
                )}
              </button>
              {n.reader_id === me.id && (
                <ConfirmButton
                  ariaLabel="Delete highlight"
                  confirmLabel="Delete?"
                  className="absolute top-2 right-2 grid h-8 min-w-8 place-items-center rounded-full px-2 text-xs font-semibold text-muted"
                  onConfirm={async () => {
                    const { error } = await supabase.from("annotations").delete().eq("id", n.id);
                    if (error) return toast(isOffline() ? "You’re offline" : "Couldn’t delete");
                    setNotes((all) => all.filter((x) => x.id !== n.id));
                    toast("Deleted");
                  }}
                >
                  <Trash2Icon className="size-4" />
                </ConfirmButton>
              )}
            </div>
          ))}
        </div>
        {lockedCount > 0 && partner && (
          <p className="mt-4 rounded-2xl bg-lemon/20 p-3 text-center text-sm">
            🔒 {lockedCount} more from {partner.name} ahead
          </p>
        )}
      </Sheet>
    </main>
  );
}
