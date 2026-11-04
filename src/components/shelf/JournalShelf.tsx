"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLinkIcon, FileTextIcon, LinkIcon, NewspaperIcon, UploadIcon } from "lucide-react";
import { useLemon } from "@/lib/lemon";
import { supabase } from "@/lib/supabase";
import type { Paper, PaperProgress } from "@/lib/types";
import { addPaperFromLink, deletePaper, PAPER_COLUMNS, uploadPaper } from "@/lib/papers";
import { useOffline } from "@/lib/offline";
import { ShelfHeading } from "./ShelfHeading";
import { haptic } from "@/lib/haptics";
import { Sheet } from "@/components/Sheet";
import { Bar } from "@/components/ProgressBar";

type Adding = { label: string; progress: number };

/** Journal papers and articles you're reading together. */
export function JournalShelf() {
  const { me, partner, toast, nudge } = useLemon();
  const [papers, setPapers] = useState<Paper[] | null>(null);
  const [progress, setProgress] = useState<PaperProgress[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState<Adding | null>(null);
  const [menuPaper, setMenuPaper] = useState<Paper | null>(null);
  const [removeAsk, setRemoveAsk] = useState<Paper | null>(null);
  const offline = useOffline();

  const load = useCallback(async () => {
    const [p, pr] = await Promise.all([
      supabase.from("papers").select(PAPER_COLUMNS).order("created_at", { ascending: false }),
      supabase.from("paper_progress").select("*"),
    ]);
    setPapers((p.data ?? []) as Paper[]);
    setProgress((pr.data ?? []) as PaperProgress[]);
  }, []);

  useEffect(() => {
    if (!me) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading data from Supabase
    load();
    const ch = supabase
      .channel("journals")
      .on("postgres_changes", { event: "*", schema: "public", table: "papers" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "paper_progress" }, (e) => {
        const row = (e.new ?? e.old) as PaperProgress;
        setProgress((all) => [
          ...all.filter((x) => !(x.reader_id === row.reader_id && x.paper_id === row.paper_id)),
          ...(e.eventType === "DELETE" ? [] : [e.new as PaperProgress]),
        ]);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [me, load]);

  // Warm up pdf.js while you look at the shelf, so a paper opens sooner
  useEffect(() => {
    if (!me) return;
    const t = setTimeout(() => import("pdfjs-dist").catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, [me]);

  const added = useCallback(async () => {
    await load();
    haptic("success");
    toast("Added 🍋");
  }, [load, toast]);

  const addFile = useCallback(
    async (file: File) => {
      if (!me) return;
      setAddOpen(false);
      setAdding({ label: file.name.replace(/\.pdf$/i, ""), progress: 0 });
      try {
        await uploadPaper(file, me.id, (progress) => setAdding((a) => (a ? { ...a, progress } : a)));
        await added();
      } catch (e) {
        toast((e as Error).message);
      } finally {
        setAdding(null);
      }
    },
    [me, toast, added],
  );

  const addLink = useCallback(
    async (url: string, title: string) => {
      setAddOpen(false);
      setAdding({ label: title || new URL(url).hostname.replace(/^www\./, ""), progress: 0 });
      try {
        await addPaperFromLink(url, title || undefined);
        await added();
      } catch (e) {
        toast((e as Error).message);
      } finally {
        setAdding(null);
      }
    },
    [toast, added],
  );

  if (!me) return null;

  const prog = (paperId: string, readerId?: string) =>
    progress.find((p) => p.paper_id === paperId && p.reader_id === readerId);

  return (
    <>
      <ShelfHeading
        title="Our journals"
        count={papers && papers.length > 0 ? `${papers.length} ${papers.length === 1 ? "paper" : "papers"}` : undefined}
        addLabel="Add a journal"
        busy={adding ? (adding.progress > 0 ? `${Math.round(adding.progress * 100)}%` : "Adding…") : undefined}
        onAdd={() => (offline ? toast("You’re offline") : setAddOpen(true))}
      />

      {papers === null ? (
        <div className="mt-5 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl bg-ink/5" />
          ))}
        </div>
      ) : papers.length === 0 && !adding ? (
        <EmptyShelf onAdd={() => setAddOpen(true)} />
      ) : (
        <div className="mt-5 space-y-3">
          {adding && (
            <div className="rounded-3xl bg-paper p-4 ring-1 ring-ink/5" aria-live="polite">
              <p className="line-clamp-2 font-serif text-[16px] font-semibold leading-snug">{adding.label}</p>
              <p className="mt-1 text-xs text-muted">
                {adding.progress > 0 ? `Uploading · ${Math.round(adding.progress * 100)}%` : "Adding…"}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/8">
                <div
                  className={`h-full rounded-full bg-lemon-deep transition-[width] duration-200 ${adding.progress ? "" : "animate-pulse"}`}
                  style={{ width: `${Math.max(adding.progress ? 4 : 30, adding.progress * 100)}%` }}
                />
              </div>
            </div>
          )}
          {papers.map((p) => {
            const mine = prog(p.id, me.id);
            const theirs = prog(p.id, partner?.id);
            const bothDone = mine?.finished_at && theirs?.finished_at;
            const Icon = p.kind === "pdf" ? FileTextIcon : NewspaperIcon;
            return (
              <div key={p.id} className="rounded-3xl bg-paper p-4 ring-1 ring-ink/5">
                <div className="flex items-start gap-3">
                  <Link href={`/paper?p=${p.id}`} className="flex min-w-0 flex-1 gap-3 active:opacity-70">
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-lemon/30 text-ink">
                      <Icon className="size-5" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-2 font-serif text-[16px] font-semibold leading-snug">{p.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {[p.kind === "pdf" ? "PDF" : "Article", p.source, p.byline].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </Link>
                  <button
                    onClick={() => setMenuPaper(p)}
                    className="-mr-1 shrink-0 rounded-full px-1.5 text-lg leading-none text-muted"
                    aria-label="Paper options"
                  >
                    ⋯
                  </button>
                </div>
                {bothDone ? (
                  <p className="mt-3 text-xs font-medium text-leaf">Finished together 🎉</p>
                ) : (
                  <div className="mt-3 space-y-1">
                    <Bar color={me.color} label={me.name} value={mine?.fraction} />
                    {partner && <Bar color={partner.color} label={partner.name} value={theirs?.fraction} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AddSheet open={addOpen} onClose={() => setAddOpen(false)} onFile={addFile} onLink={addLink} />

      <Sheet open={!!menuPaper} onClose={() => setMenuPaper(null)} title={menuPaper?.title}>
        {menuPaper && (
          <div className="space-y-2">
            {menuPaper.source_url && (
              <a
                href={menuPaper.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center gap-2 rounded-2xl bg-ink/5 px-4 py-3.5 text-left font-medium"
              >
                <ExternalLinkIcon className="size-4" /> Open the original
              </a>
            )}
            <button
              className="w-full rounded-2xl bg-ink/5 px-4 py-3.5 text-left font-medium"
              onClick={async () => {
                setMenuPaper(null);
                haptic("tap");
                toast(await nudge(null, "read"));
              }}
            >
              Read together
            </button>
            <button
              className="w-full rounded-2xl bg-red-50 px-4 py-3.5 text-left font-medium text-red-700 dark:bg-red-500/15 dark:text-red-300"
              onClick={() => {
                setRemoveAsk(menuPaper);
                setMenuPaper(null);
              }}
            >
              Remove
            </button>
          </div>
        )}
      </Sheet>

      <Sheet open={!!removeAsk} onClose={() => setRemoveAsk(null)} title={`Remove “${removeAsk?.title ?? ""}”?`}>
        <p className="mb-4 text-sm text-muted">For both of you, with its notes.</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="rounded-2xl bg-ink/5 py-3.5 font-medium" onClick={() => setRemoveAsk(null)}>
            Keep
          </button>
          <button
            className="rounded-2xl bg-red-600 py-3.5 font-semibold text-white"
            onClick={async () => {
              const p = removeAsk!;
              setRemoveAsk(null);
              try {
                await deletePaper(p);
                load();
              } catch (e) {
                toast((e as Error).message);
              }
            }}
          >
            Remove
          </button>
        </div>
      </Sheet>

    </>
  );
}

/** Add a paper: paste a link (PDF, journal page or article), or upload a PDF. */
function AddSheet({
  open,
  onClose,
  onFile,
  onLink,
}: {
  open: boolean;
  onClose: () => void;
  onFile: (file: File) => void;
  onLink: (url: string, title: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const valid = /^https?:\/\/\S+\.\S+/i.test(url.trim());

  const close = () => {
    setUrl("");
    setTitle("");
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title="Add a journal">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          onLink(url.trim(), title.trim());
          setUrl("");
          setTitle("");
        }}
      >
        <label className="block text-sm font-medium" htmlFor="paper-url">
          Paste a link
        </label>
        <p className="mt-0.5 text-xs text-muted">A PDF, a journal page, or any web article</p>
        <div className="relative mt-2">
          <LinkIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <input
            id="paper-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-2xl border border-ink/10 bg-white/60 py-3 pr-3 pl-10 outline-none focus:border-lemon-deep dark:bg-black/20"
          />
        </div>
        <input
          aria-label="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          maxLength={160}
          className="mt-2 w-full rounded-2xl border border-ink/10 bg-white/60 px-3.5 py-3 outline-none focus:border-lemon-deep dark:bg-black/20"
        />
        <button
          disabled={!valid}
          className="mt-3 w-full rounded-2xl bg-lemon py-3.5 font-semibold text-on-lemon disabled:opacity-50"
        >
          Add link
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-ink/10" /> or <span className="h-px flex-1 bg-ink/10" />
      </div>

      <button
        onClick={() => fileInput.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink/5 py-3.5 font-medium"
      >
        <UploadIcon className="size-4" /> Upload a PDF
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) {
            setUrl("");
            setTitle("");
            onFile(f);
          }
        }}
      />
    </Sheet>
  );
}

function EmptyShelf({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-10 rounded-3xl border-2 border-dashed border-ink/10 px-6 py-12 text-center">
      <p className="text-4xl">📄</p>
      <p className="mt-3 font-serif text-lg font-semibold">No journals yet</p>
      <p className="mt-1 text-sm text-muted">Papers and articles you read together</p>
      <button onClick={onAdd} className="mt-4 rounded-full bg-lemon px-5 py-2.5 font-semibold text-on-lemon">
        Add a journal
      </button>
    </div>
  );
}
