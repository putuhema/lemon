"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { loadPdfjs } from "@/lib/papers";
import type { PaperNote, Rect } from "@/lib/types";
import type { PaperSelection, PaperViewerHandle, PaperViewerProps } from "./types";

/** Widest a page gets at 1×, so desktop pages stay a readable size. */
const MAX_FIT_WIDTH = 880;
export const MAX_ZOOM = 4;
/** Pixels per page canvas. Phones refuse (or crash on) bigger canvases. */
const MAX_CANVAS_PIXELS = 10_000_000;

/** Merge per-span rectangles on the same line into one, so a sentence becomes a few bars. */
function mergeRects(rects: Rect[]): Rect[] {
  const sorted = [...rects].sort((p, q) => p.y - q.y || p.x - q.x);
  const out: Rect[] = [];
  for (const r of sorted) {
    const last = out.at(-1);
    if (last && Math.abs(last.y - r.y) < r.h * 0.5 && r.x <= last.x + last.w + 0.02) {
      const right = Math.max(last.x + last.w, r.x + r.w);
      const bottom = Math.max(last.y + last.h, r.y + r.h);
      last.x = Math.min(last.x, r.x);
      last.y = Math.min(last.y, r.y);
      last.w = right - last.x;
      last.h = bottom - last.y;
    } else {
      out.push({ ...r });
    }
  }
  return out.slice(0, 60).map((r) => ({
    x: Math.round(r.x * 10000) / 10000,
    y: Math.round(r.y * 10000) / 10000,
    w: Math.round(r.w * 10000) / 10000,
    h: Math.round(r.h * 10000) / 10000,
  }));
}

type Props = PaperViewerProps & {
  url: string;
  /** Known page count (from the upload), so pages can be laid out before the PDF loads. */
  pageCount: number | null;
  /** 1 = fit the screen width; larger values scroll sideways. */
  zoom: number;
  onZoomChange: (zoom: number) => void;
  /** Called with the real page count once the PDF is open. */
  onPageCount: (pages: number) => void;
};

/**
 * Reads a PDF with pdf.js: every page is a canvas with a transparent, selectable text layer on top.
 * Highlights are rectangles stored as fractions of the page, so they line up at any size.
 */
export const PdfViewer = forwardRef<PaperViewerHandle, Props>(function PdfViewer(
  { url, pageCount, zoom, onZoomChange, onPageCount, notes, colorOf, initial, partner, onProgress, onSelect, onNoteTap },
  ref,
) {
  const contentRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const setWrap = useCallback((el: HTMLDivElement | null) => {
    wrapRef.current = el;
    setScrollEl(el);
  }, []);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState(pageCount ?? 1);
  const [aspect, setAspect] = useState(1.294); // A4 until we know
  const [width, setWidth] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const cb = useRef({ onPageCount, onZoomChange, onProgress, onSelect, zoom });
  useEffect(() => {
    cb.current = { onPageCount, onZoomChange, onProgress, onSelect, zoom };
  });

  // Open the document
  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;
    loadPdfjs()
      .then((pdfjs) => {
        task = pdfjs.getDocument({ url });
        return task.promise;
      })
      .then(async (pdf) => {
        const first = await pdf.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        if (cancelled) return;
        cb.current.onPageCount(pdf.numPages);
        setPages(pdf.numPages);
        setAspect(vp.height / vp.width);
        setDoc(pdf);
      })
      .catch((e) => {
        if (cancelled) return; // closed while it was loading
        console.error(e);
        setError("Couldn’t open this PDF. Try reloading.");
      });
    return () => {
      cancelled = true;
      void (task as PDFDocumentLoadingTask | null)?.destroy();
    };
  }, [url]);

  // Available width
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.floor(entry.contentRect.width);
      setWidth((prev) => (Math.abs(prev - next) > 4 ? next : prev));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollEl]);

  // Pinch with two fingers: scale the pages with CSS while the fingers move,
  // then redraw them sharp at the new zoom, keeping the spot under your fingers in place
  const pinchAnchor = useRef<{ page: number; relX: number; relY: number; fx: number; fy: number } | null>(null);
  useEffect(() => {
    const area = scrollEl;
    const content = contentRef.current;
    if (!area || !content) return;
    let start: { dist: number; zoom: number; page: number; relX: number; relY: number; fx: number; fy: number } | null =
      null;
    let next = 1;
    const distance = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    function onStart(event: TouchEvent) {
      if (event.touches.length !== 2) return;
      const [t1, t2] = [event.touches[0], event.touches[1]];
      const cx = (t1.clientX + t2.clientX) / 2;
      const cy = (t1.clientY + t2.clientY) / 2;
      const box = area!.getBoundingClientRect();
      // The page under the fingers (or the nearest one, in a gap)
      let target: HTMLElement | undefined;
      let best = Infinity;
      for (const el of area!.querySelectorAll<HTMLElement>("[data-page]")) {
        const r = el.getBoundingClientRect();
        const d = cy < r.top ? r.top - cy : cy > r.bottom ? cy - r.bottom : 0;
        if (d < best) {
          best = d;
          target = el;
        }
        if (d === 0) break;
      }
      if (!target) return;
      const pageBox = target.getBoundingClientRect();
      const contentBox = content!.getBoundingClientRect();
      start = {
        dist: distance(event.touches),
        zoom: cb.current.zoom,
        page: Number(target.dataset.page),
        relX: (cx - pageBox.left) / pageBox.width,
        relY: (cy - pageBox.top) / pageBox.height,
        fx: cx - box.left,
        fy: cy - box.top,
      };
      next = start.zoom;
      content!.style.transformOrigin = `${cx - contentBox.left}px ${cy - contentBox.top}px`;
      content!.style.willChange = "transform";
    }
    function onMove(event: TouchEvent) {
      if (!start || event.touches.length !== 2) return;
      event.preventDefault();
      next = Math.min(MAX_ZOOM, Math.max(1, (start.zoom * distance(event.touches)) / start.dist));
      content!.style.transform = `scale(${next / start.zoom})`;
    }
    function onEnd(event: TouchEvent) {
      if (!start || event.touches.length >= 2) return;
      const done = start;
      start = null;
      content!.style.transform = "";
      content!.style.transformOrigin = "";
      content!.style.willChange = "";
      const rounded = Math.round(next * 20) / 20;
      if (Math.abs(rounded - done.zoom) < 0.05) return;
      pinchAnchor.current = done;
      cb.current.onZoomChange(rounded);
    }
    // Safari's own page zoom
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
  }, [scrollEl]);

  // Which page is in view, and how far down you are
  useEffect(() => {
    const area = scrollEl;
    // Until the pages are laid out the scroll area is empty, which would read as "scrolled to the end"
    if (!area || !doc || !width) return;
    let frame = 0;
    let last = "";
    function check() {
      frame = 0;
      const els = area!.querySelectorAll<HTMLElement>("[data-page]");
      if (!els.length) return;
      const box = area!.getBoundingClientRect();
      const line = box.top + area!.clientHeight * 0.35;
      let page = 1;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.top <= line && r.bottom > line) {
          page = Number(el.dataset.page);
          break;
        }
        if (r.top > line) break;
        page = Number(el.dataset.page);
      }
      const max = area!.scrollHeight - area!.clientHeight;
      const fraction = max > 0 ? Math.min(1, Math.max(0, area!.scrollTop / max)) : 1;
      const key = `${page}:${fraction.toFixed(3)}`;
      if (key === last) return;
      last = key;
      cb.current.onProgress({ page, fraction });
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    area.addEventListener("scroll", onScroll, { passive: true });
    check();
    return () => {
      area.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [doc, scrollEl, width]);

  const scrollToSpot = useCallback((page: number, y: number, behavior: ScrollBehavior = "smooth") => {
    const area = wrapRef.current;
    const el = area?.querySelector<HTMLElement>(`[data-page="${page}"]`);
    if (!area || !el) return;
    const top = el.offsetTop + y * el.offsetHeight - (y > 0 ? area.clientHeight * 0.3 : 12);
    area.scrollTo({ top: Math.max(0, top), behavior });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      scrollToNote: (note: PaperNote) => scrollToSpot(note.page ?? 1, note.rects?.[0]?.y ?? 0),
      scrollToPlace: (place) => scrollToSpot(place.page, 0),
      clearSelection: () => window.getSelection()?.removeAllRanges(),
    }),
    [scrollToSpot],
  );

  // Start where you left off, unless you already started scrolling while it loaded
  const jumped = useRef(false);
  useEffect(() => {
    const area = scrollEl;
    if (!area) return;
    const skip = () => {
      jumped.current = true;
    };
    const events = ["pointerdown", "wheel", "touchstart", "keydown"] as const;
    events.forEach((e) => area.addEventListener(e, skip, { passive: true }));
    return () => events.forEach((e) => area.removeEventListener(e, skip));
  }, [scrollEl]);
  useEffect(() => {
    if (!doc || !width || jumped.current) return;
    jumped.current = true;
    if (initial.page > 1) requestAnimationFrame(() => scrollToSpot(initial.page, 0, "instant"));
  }, [doc, width, initial.page, scrollToSpot]);

  // Selecting text
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function read() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return cb.current.onSelect(null);
      const range = selection.getRangeAt(0);
      const start = range.startContainer.parentElement?.closest<HTMLElement>("[data-page]");
      const end = range.endContainer.parentElement?.closest<HTMLElement>("[data-page]");
      if (!start || start !== end || !wrapRef.current?.contains(start)) return cb.current.onSelect(null);
      const box = start.getBoundingClientRect();
      const raw = Array.from(range.getClientRects())
        .filter((r) => r.width > 1 && r.height > 1)
        .map((r) => ({
          x: (r.left - box.left) / box.width,
          y: (r.top - box.top) / box.height,
          w: r.width / box.width,
          h: r.height / box.height,
        }))
        .filter((r) => r.x >= -0.01 && r.y >= -0.01 && r.x + r.w <= 1.01 && r.y + r.h <= 1.01);
      const quote = selection.toString().replace(/\s+/g, " ").trim();
      if (raw.length === 0 || quote.length < 2) return cb.current.onSelect(null);
      const page = Number(start.dataset.page);
      const rects = mergeRects(raw);
      const total = Math.max(1, doc?.numPages ?? 1);
      const sel: PaperSelection = {
        quote: quote.slice(0, 2000),
        page,
        rects,
        fraction: Math.min(1, (page - 1 + (rects[0]?.y ?? 0)) / total),
      };
      cb.current.onSelect(sel);
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
  }, [doc]);

  const notesByPage = useMemo(() => {
    const map = new Map<number, PaperNote[]>();
    for (const n of notes) if (n.page) map.set(n.page, [...(map.get(n.page) ?? []), n]);
    return map;
  }, [notes]);

  const pageWidth = Math.floor(Math.min(width, MAX_FIT_WIDTH) * zoom);

  // After a zoom change, put the spot you were looking at back in place
  useLayoutEffect(() => {
    const anchor = pinchAnchor.current;
    const area = wrapRef.current;
    if (!anchor || !area) return;
    pinchAnchor.current = null;
    const page = area.querySelector<HTMLElement>(`[data-page="${anchor.page}"]`);
    if (!page) return;
    area.scrollLeft = page.offsetLeft + anchor.relX * page.offsetWidth - anchor.fx;
    area.scrollTop = page.offsetTop + anchor.relY * page.offsetHeight - anchor.fy;
  }, [pageWidth]);

  if (error) return <p className="px-6 py-24 text-center text-muted">{error}</p>;

  return (
    <div
      ref={setWrap}
      className="relative min-h-0 min-w-0 flex-1 touch-pan-x touch-pan-y overflow-auto overscroll-contain pt-[calc(env(safe-area-inset-top)+72px)] pb-[calc(env(safe-area-inset-bottom)+96px)] sm:px-4"
    >
      <div ref={contentRef} className="mx-auto flex w-max flex-col gap-3">
        {width > 0 &&
          Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <PdfPage
              key={n}
              doc={doc}
              number={n}
              width={pageWidth}
              aspect={aspect}
              notes={notesByPage.get(n) ?? []}
              colorOf={colorOf}
              partner={partner && partner.page === n ? partner : null}
              root={scrollEl}
              onNoteTap={onNoteTap}
            />
          ))}
      </div>
    </div>
  );
});

function PdfPage({
  doc,
  number,
  width,
  aspect,
  notes,
  colorOf,
  partner,
  root,
  onNoteTap,
}: {
  doc: PDFDocumentProxy | null;
  number: number;
  width: number;
  aspect: number;
  notes: PaperNote[];
  colorOf: (id: string) => string;
  partner: { name: string; color: string } | null;
  root: HTMLElement | null;
  onNoteTap: (ids: string[]) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  // Real height once drawn at this width; an estimate from the first page until then
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const height = measured?.width === width ? measured.height : Math.round(width * aspect);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || !root) return;
    // Draw pages a bit before they scroll into view; pages far away give their canvas back,
    // so long papers stay light on phones
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) return;
        const canvas = canvasRef.current;
        if (canvas && canvas.width > 0) {
          canvas.width = 0;
          canvas.height = 0;
          textRef.current?.replaceChildren();
          setRendered(false);
        }
      },
      { root, rootMargin: "1500px 600px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    if (!doc || !visible) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    let textLayer: { cancel: () => void } | null = null;

    (async () => {
      const pdfjs = await loadPdfjs();
      const page = await doc.getPage(number);
      if (cancelled) return;
      const scale = width / page.getViewport({ scale: 1 }).width;
      const viewport = page.getViewport({ scale });
      setMeasured({ width, height: Math.round(viewport.height) });

      const canvas = canvasRef.current;
      const box = boxRef.current;
      const text = textRef.current;
      if (!canvas || !box || !text) return;

      // Sharp on high-density screens, but within what a phone can hold
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        3,
        Math.sqrt(MAX_CANVAS_PIXELS / (viewport.width * viewport.height)),
      );
      // Draw off-screen first: the old picture stays (stretched) until the new one is ready
      const scratch = document.createElement("canvas");
      scratch.width = Math.floor(viewport.width * dpr);
      scratch.height = Math.floor(viewport.height * dpr);
      task = page.render({ canvas: scratch, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
      await task.promise;
      if (cancelled) return;
      canvas.width = scratch.width;
      canvas.height = scratch.height;
      canvas.getContext("2d")?.drawImage(scratch, 0, 0);
      scratch.width = 0;
      scratch.height = 0;
      box.style.setProperty("--total-scale-factor", String(scale));
      box.style.setProperty("--scale-factor", String(scale));

      text.replaceChildren();
      const layer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: text, viewport });
      textLayer = layer;
      await layer.render();
      if (!cancelled) setRendered(true);
    })().catch((e) => {
      if (!cancelled && e?.name !== "RenderingCancelledException") console.error(e);
    });

    return () => {
      cancelled = true;
      task?.cancel();
      textLayer?.cancel();
    };
  }, [doc, visible, number, width]);

  // Tapping a highlight (the text layer sits on top, so find it by position)
  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!notes.length) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    const box = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    const y = (e.clientY - box.top) / box.height;
    const pad = 0.004;
    const hit = notes.filter((n) =>
      n.rects?.some((r) => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad),
    );
    if (hit.length) onNoteTap(hit.map((n) => n.id));
  }

  return (
    <div
      ref={boxRef}
      data-page={number}
      onClick={onClick}
      className="relative overflow-hidden bg-white ring-1 ring-ink/10"
      style={{ width, height }}
    >
      {!rendered && <div className="absolute inset-0 animate-pulse bg-ink/5" />}
      <canvas ref={canvasRef} className="absolute inset-0 size-full select-none" />

      {/* Highlights sit under the transparent text layer, so the text stays selectable */}
      <div className="pointer-events-none absolute inset-0 z-[1]">
        {notes.flatMap((n) =>
          (n.rects ?? []).map((r, i) => (
            <span
              key={`${n.id}-${i}`}
              className="absolute rounded-[2px] mix-blend-multiply"
              style={{
                left: `${r.x * 100}%`,
                top: `${r.y * 100}%`,
                width: `${r.w * 100}%`,
                height: `${r.h * 100}%`,
                background: `${colorOf(n.reader_id)}66`,
              }}
            />
          )),
        )}
      </div>

      <div ref={textRef} className="textLayer" />

      {/* A little badge where a highlight has a note or a reaction */}
      {notes.map((n) => {
        const last = n.rects?.at(-1);
        if (!last || (!n.note && !n.emoji)) return null;
        return (
          <span
            key={n.id}
            className="pointer-events-none absolute z-[3] -translate-y-1/2 text-[13px] leading-none"
            style={{ left: `${Math.min(0.97, last.x + last.w) * 100}%`, top: `${last.y * 100}%` }}
          >
            {n.emoji ?? "💬"}
          </span>
        );
      })}

      {partner && (
        <span
          className="pointer-events-none absolute top-2 left-0 z-[3] flex items-center gap-1 rounded-r-full bg-white/95 py-0.5 pr-2 pl-1.5 text-[11px] font-medium text-[#2e2a1f] ring-1 ring-black/10"
        >
          <span className="size-2 animate-pulse rounded-full" style={{ background: partner.color }} />
          {partner.name} is here
        </span>
      )}

      <span className="pointer-events-none absolute right-2 bottom-1.5 z-[3] text-[10px] text-[#8a8170]">{number}</span>
    </div>
  );
}
