"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import { ExternalLinkIcon } from "lucide-react";
import type { PaperNote } from "@/lib/types";
import type { PaperViewerHandle, PaperViewerProps } from "./types";

type Props = PaperViewerProps & {
  html: string;
  title: string;
  source: string | null;
  byline: string | null;
  sourceUrl: string | null;
  /** Text size: 1 and up. */
  zoom: number;
  onZoomChange: (zoom: number) => void;
};

const MAX_ARTICLE_ZOOM = 2.5;

/* ---------- text <-> character offsets (highlights are stored as offsets, so they fit any screen) ---------- */

function textNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text);
  return out;
}

function offsetOf(root: HTMLElement, node: Node, offset: number): number {
  const upTo = document.createRange();
  upTo.setStart(root, 0);
  upTo.setEnd(node, offset);
  let total = 0;
  for (const t of textNodes(root)) {
    if (!upTo.intersectsNode(t)) continue;
    total += t === upTo.endContainer ? upTo.endOffset : t === upTo.startContainer ? 0 : t.length;
    if (t === upTo.endContainer) break;
  }
  return total;
}

function textOf(root: HTMLElement) {
  return textNodes(root)
    .map((t) => t.data)
    .join("");
}

/** Wraps [start, end) in elements made by `make`, one per text node it crosses. */
function wrapRange(root: HTMLElement, start: number, end: number, make: () => HTMLElement): HTMLElement[] {
  const wrapped: HTMLElement[] = [];
  let pos = 0;
  for (const node of textNodes(root)) {
    const from = pos;
    const to = pos + node.length;
    pos = to;
    if (to <= start || from >= end) continue;
    const a = Math.max(start, from) - from;
    const b = Math.min(end, to) - from;
    let target = node;
    if (b < target.length) target.splitText(b);
    if (a > 0) target = target.splitText(a);
    const el = make();
    target.parentNode!.insertBefore(el, target);
    el.appendChild(target);
    wrapped.push(el);
  }
  return wrapped;
}

/** Removes the highlights a previous pass added. */
function undecorate(root: HTMLElement) {
  root.querySelectorAll("mark[data-note]").forEach((el) => {
    const parent = el.parentNode!;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  });
  root.normalize();
}

/** Reads a saved web article. Highlights are wrapped right into its text. */
export const ArticleViewer = forwardRef<PaperViewerHandle, Props>(function ArticleViewer(
  {
    html,
    title,
    source,
    byline,
    sourceUrl,
    zoom,
    onZoomChange,
    notes,
    colorOf,
    initial,
    partner,
    onProgress,
    onSelect,
    onNoteTap,
  },
  ref,
) {
  const areaRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cb = useRef({ onProgress, onSelect, onZoomChange, zoom });
  useEffect(() => {
    cb.current = { onProgress, onSelect, onZoomChange, zoom };
  });

  // The article HTML is set once; React never re-renders inside it, so it's safe to add highlights to it
  const body = useMemo(() => ({ __html: html }), [html]);

  const scrollToFraction = useCallback((fraction: number, behavior: ScrollBehavior = "smooth") => {
    const area = areaRef.current;
    if (!area) return;
    area.scrollTo({ top: fraction * (area.scrollHeight - area.clientHeight), behavior });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      scrollToNote: (note: PaperNote) => {
        const area = areaRef.current;
        const el = area?.querySelector<HTMLElement>(`mark[data-note~="${note.id}"]`);
        if (!area || !el) return scrollToFraction(note.fraction);
        const top = el.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop;
        area.scrollTo({ top: Math.max(0, top - area.clientHeight * 0.3), behavior: "smooth" });
      },
      scrollToPlace: (place) => scrollToFraction(place.fraction),
      clearSelection: () => window.getSelection()?.removeAllRanges(),
    }),
    [scrollToFraction],
  );

  // Start where you left off (unless you already started scrolling)
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    let touched = false;
    const mark = () => {
      touched = true;
    };
    const events = ["pointerdown", "wheel", "touchstart", "keydown"] as const;
    events.forEach((e) => area.addEventListener(e, mark, { passive: true }));
    const frame = requestAnimationFrame(() => {
      if (!touched && initial.fraction > 0.005) scrollToFraction(initial.fraction, "instant");
    });
    return () => {
      cancelAnimationFrame(frame);
      events.forEach((e) => area.removeEventListener(e, mark));
    };
    // Only on first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // How far through you are
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    let frame = 0;
    let last = -1;
    const check = () => {
      frame = 0;
      const max = area.scrollHeight - area.clientHeight;
      const fraction = max <= 0 ? 1 : Math.min(1, Math.max(0, area.scrollTop / max));
      if (Math.abs(fraction - last) < 0.001) return;
      last = fraction;
      cb.current.onProgress({ page: 1, fraction });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    area.addEventListener("scroll", onScroll, { passive: true });
    check();
    return () => {
      area.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Pinch with two fingers: preview with a CSS scale, then set the new text size at the same place
  const keepRatio = useRef<number | null>(null);
  useEffect(() => {
    const area = areaRef.current;
    const article = articleRef.current;
    if (!area || !article) return;
    let start: { dist: number; zoom: number } | null = null;
    let next = 1;
    const distance = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    function onStart(event: TouchEvent) {
      if (event.touches.length !== 2) return;
      const box = article!.getBoundingClientRect();
      const cx = (event.touches[0].clientX + event.touches[1].clientX) / 2;
      const cy = (event.touches[0].clientY + event.touches[1].clientY) / 2;
      start = { dist: distance(event.touches), zoom: cb.current.zoom };
      next = start.zoom;
      article!.style.transformOrigin = `${cx - box.left}px ${cy - box.top}px`;
    }
    function onMove(event: TouchEvent) {
      if (!start || event.touches.length !== 2) return;
      event.preventDefault();
      next = Math.min(MAX_ARTICLE_ZOOM, Math.max(1, (start.zoom * distance(event.touches)) / start.dist));
      article!.style.transform = `scale(${next / start.zoom})`;
    }
    function onEnd(event: TouchEvent) {
      if (!start || event.touches.length >= 2) return;
      const done = start;
      start = null;
      article!.style.transform = "";
      article!.style.transformOrigin = "";
      const rounded = Math.round(next * 20) / 20;
      if (Math.abs(rounded - done.zoom) < 0.05) return;
      const max = area!.scrollHeight - area!.clientHeight;
      keepRatio.current = max > 0 ? area!.scrollTop / max : 0;
      cb.current.onZoomChange(rounded);
    }
    const stopGesture = (event: Event) => event.preventDefault();
    area.addEventListener("touchstart", onStart, { passive: true });
    area.addEventListener("touchmove", onMove, { passive: false });
    area.addEventListener("touchend", onEnd);
    area.addEventListener("touchcancel", onEnd);
    area.addEventListener("gesturestart", stopGesture);
    return () => {
      area.removeEventListener("touchstart", onStart);
      area.removeEventListener("touchmove", onMove);
      area.removeEventListener("touchend", onEnd);
      area.removeEventListener("touchcancel", onEnd);
      area.removeEventListener("gesturestart", stopGesture);
    };
  }, []);
  useLayoutEffect(() => {
    const ratio = keepRatio.current;
    const area = areaRef.current;
    if (ratio == null || !area) return;
    keepRatio.current = null;
    area.scrollTop = ratio * (area.scrollHeight - area.clientHeight);
  }, [zoom]);

  // Draw the highlights into the article text
  useLayoutEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    undecorate(root);
    for (const n of notes) {
      if (n.start_offset == null || n.end_offset == null) continue;
      const parts = wrapRange(root, n.start_offset, n.end_offset, () => {
        const el = document.createElement("mark");
        el.dataset.note = n.id;
        el.className = "paper-hl";
        el.style.setProperty("--hl", `${colorOf(n.reader_id)}59`);
        return el;
      });
      // A note or a reaction shows as a little badge (drawn with CSS, so it isn't part of the text)
      const last = parts.at(-1);
      if (last && (n.note || n.emoji)) last.dataset.badge = n.emoji ?? "💬";
    }
  }, [body, notes, colorOf]);

  // Tapping a highlight: every note on that spot (highlights can overlap)
  function onClick(event: React.MouseEvent) {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    const ids = new Set<string>();
    let el = (event.target as HTMLElement).closest<HTMLElement>("mark[data-note]");
    while (el && contentRef.current?.contains(el)) {
      ids.add(el.dataset.note!);
      el = el.parentElement?.closest<HTMLElement>("mark[data-note]") ?? null;
    }
    if (ids.size) onNoteTap([...ids]);
  }

  // Selecting text
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function read() {
      const root = contentRef.current;
      const selection = window.getSelection();
      if (!root || !selection || selection.isCollapsed || selection.rangeCount === 0) return cb.current.onSelect(null);
      const range = selection.getRangeAt(0);
      if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return cb.current.onSelect(null);
      const text = textOf(root);
      const start = offsetOf(root, range.startContainer, range.startOffset);
      const end = offsetOf(root, range.endContainer, range.endOffset);
      const quote = text.slice(start, end).replace(/\s+/g, " ").trim();
      if (end - start < 2 || quote.length < 2) return cb.current.onSelect(null);
      const length = Math.max(1, text.length);
      cb.current.onSelect({
        quote: quote.slice(0, 2000),
        range: { start, end: Math.min(end, start + 5000) },
        fraction: start / length,
      });
    }
    function onChange() {
      clearTimeout(timer);
      timer = setTimeout(read, 250);
    }
    document.addEventListener("selectionchange", onChange);
    return () => {
      document.removeEventListener("selectionchange", onChange);
      clearTimeout(timer);
    };
  }, []);

  const scale = 1 + (zoom - 1) * 0.5;

  return (
    <div
      ref={areaRef}
      className="relative min-h-0 min-w-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pt-[calc(env(safe-area-inset-top)+64px)] pb-[calc(env(safe-area-inset-bottom)+96px)]"
    >
      <article
        ref={articleRef}
        className="relative mx-auto w-full px-6 py-8"
        style={{ maxWidth: `${Math.round(680 * scale)}px` }}
      >
        <header className="mb-7 border-b border-ink/10 pb-6">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            {[source ?? "Article", byline].filter(Boolean).join(" · ")}
          </p>
          <h1 className="mt-2 font-serif text-[28px] leading-tight font-semibold text-balance">{title}</h1>
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs text-muted underline-offset-4 hover:underline"
            >
              <ExternalLinkIcon className="size-3" /> Open the original
            </a>
          )}
        </header>
        <div
          ref={contentRef}
          onClick={onClick}
          className="paper-article"
          style={{ fontSize: `${18 * scale}px` }}
          dangerouslySetInnerHTML={body}
        />
        {partner && (
          <span
            className="pointer-events-none absolute -right-1 z-[3] flex -translate-y-1/2 items-center gap-1 rounded-l-full bg-paper py-0.5 pr-1.5 pl-2 text-[11px] font-medium ring-1 ring-ink/10 sm:right-1"
            style={{ top: `${Math.min(98, Math.max(2, partner.fraction * 100))}%` }}
          >
            <span className="size-2 animate-pulse rounded-full" style={{ background: partner.color }} />
            {partner.name}
          </span>
        )}
      </article>
    </div>
  );
});
