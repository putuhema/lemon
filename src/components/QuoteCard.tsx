"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadIcon, Share2Icon } from "lucide-react";
import type { Annotation, Book, Reader } from "@/lib/types";
import { haptic } from "@/lib/haptics";
import { BotHead } from "./BotHead";
import { Sheet } from "./Sheet";

const W = 1080;
const H = 1350;
const INK = "#2E2A1F";
const MUTED = "#8a8170";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** An inline SVG (a bot head) as an image the canvas can draw. */
async function svgImage(svg: SVGSVGElement) {
  const xml = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Break text into lines that fit a width. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const para of text.split(/\n+/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
  }
  return lines;
}

function clip(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

async function drawCard(opts: {
  quote: string;
  note: string | null;
  noteBy: string;
  accent: string;
  book: Book;
  bots: SVGSVGElement[];
}) {
  const root = getComputedStyle(document.documentElement);
  const serif = root.getPropertyValue("--font-fraunces").trim() || "Georgia, serif";
  const sans = root.getPropertyValue("--font-inter").trim() || "system-ui, sans-serif";
  await Promise.all([
    document.fonts.load(`italic 60px ${serif}`),
    document.fonts.load(`600 44px ${serif}`),
    document.fonts.load(`400 36px ${sans}`),
  ]).catch(() => {});

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Paper on cream
  ctx.fillStyle = "#FFF8E1";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#FFFDF5";
  ctx.strokeStyle = "rgba(46,42,31,.08)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(60, 60, W - 120, H - 120, 56);
  ctx.fill();
  ctx.stroke();

  // Big quote mark
  ctx.fillStyle = "#F5CB2E";
  ctx.font = `600 260px ${serif}`;
  ctx.fillText("“", 104, 330);

  // The quote: as large as fits
  const maxW = 820;
  let size = 64;
  let lines: string[] = [];
  for (; size >= 38; size -= 4) {
    ctx.font = `italic 400 ${size}px ${serif}`;
    lines = wrap(ctx, opts.quote, maxW);
    if (lines.length * size * 1.38 <= (opts.note ? 560 : 680)) break;
  }
  const lineH = size * 1.38;
  const maxLines = Math.floor((opts.note ? 560 : 680) / lineH);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = clip(ctx, `${lines[maxLines - 1]} …`, maxW);
  }
  // Center the quote (and note) in the space between the quote mark and the footer
  ctx.font = `400 36px ${sans}`;
  const noteCount = opts.note ? Math.min(3, wrap(ctx, `${opts.noteBy}: ${opts.note}`, 800).length) : 0;
  ctx.font = `italic 400 ${size}px ${serif}`;
  const blockH = lines.length * lineH + (noteCount ? 40 + noteCount * 50 : 0);
  const top = Math.max(360, 290 + (1040 - 290 - blockH) / 2 + size * 0.95);
  ctx.fillStyle = opts.accent;
  ctx.beginPath();
  ctx.roundRect(120, top - size * 0.95, 8, lines.length * lineH, 4);
  ctx.fill();
  ctx.fillStyle = INK;
  lines.forEach((l, i) => ctx.fillText(l, 156, top + i * lineH));
  let y = top + lines.length * lineH + 40;

  // Their note
  if (opts.note) {
    ctx.font = `400 36px ${sans}`;
    const noteLines = wrap(ctx, `${opts.noteBy}: ${opts.note}`, 800).slice(0, 3);
    ctx.fillStyle = MUTED;
    noteLines.forEach((l, i) => ctx.fillText(clip(ctx, l, 800), 156, y + i * 50));
    y += noteLines.length * 50;
  }

  // Book + bots at the bottom
  ctx.strokeStyle = "rgba(46,42,31,.08)";
  ctx.beginPath();
  ctx.moveTo(120, 1080);
  ctx.lineTo(W - 120, 1080);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `600 44px ${serif}`;
  ctx.fillText(clip(ctx, opts.book.title, 560), 120, 1160);
  if (opts.book.author) {
    ctx.fillStyle = MUTED;
    ctx.font = `400 32px ${sans}`;
    ctx.fillText(clip(ctx, opts.book.author, 560), 120, 1208);
  }
  const [icon, ...bots] = await Promise.all([loadImage("/icons/icon-192.png"), ...opts.bots.map(svgImage)]);
  ctx.drawImage(icon, 120, 1232, 36, 36);
  ctx.fillStyle = MUTED;
  ctx.font = `600 26px ${serif}`;
  ctx.fillText("Lemon", 166, 1260);
  bots.forEach((img, i) => ctx.drawImage(img, 720 + i * 120, 1112, 130, 118));

  return new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
}

/** Turn a highlight into an image to share or keep. */
export function QuoteCard({
  annotation,
  book,
  me,
  partner,
  onClose,
}: {
  annotation: Annotation | null;
  book: Book | null;
  me: Reader;
  partner: Reader;
  onClose: () => void;
}) {
  const botsRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!annotation || !book) return;
    let cancelled = false;
    let made: string | null = null;
    (async () => {
      // Wait a frame so the hidden bots below are in the page
      await new Promise((r) => requestAnimationFrame(r));
      const bots = [...(botsRef.current?.querySelectorAll("svg") ?? [])] as SVGSVGElement[];
      const by = annotation.reader_id === me.id ? me : partner;
      const blob = await drawCard({
        quote: annotation.quote,
        note: annotation.note,
        noteBy: by.name,
        accent: by.color,
        book,
        bots,
      });
      if (cancelled) return;
      made = URL.createObjectURL(blob);
      setFile(new File([blob], "lemon-quote.png", { type: "image/png" }));
      setUrl(made);
    })();
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
      setUrl(null);
      setFile(null);
    };
  }, [annotation, book, me, partner]);

  const save = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = "lemon-quote.png";
    a.click();
  };

  const share = async () => {
    if (!file) return;
    haptic("tap");
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] }).catch(() => {});
    } else save();
  };

  return (
    <Sheet open={!!annotation} onClose={onClose} title="Quote card">
      {/* the bots, rendered once so they can be drawn into the image */}
      <div ref={botsRef} className="pointer-events-none fixed -left-[9999px]" aria-hidden>
        <BotHead color={me.color} size={130} mood="happy" />
        <BotHead color={partner.color} size={130} mood="love" />
      </div>
      <div className="mx-auto aspect-[4/5] w-full max-w-xs overflow-hidden rounded-2xl ring-1 ring-ink/10">
        {url ? (
          <img src={url} alt="Quote card" className="size-full object-cover" />
        ) : (
          <div className="size-full animate-pulse bg-ink/5" />
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          disabled={!file}
          onClick={save}
          className="flex items-center justify-center gap-2 rounded-2xl bg-ink/5 py-3.5 font-medium disabled:opacity-50"
        >
          <DownloadIcon className="size-4" /> Save
        </button>
        <button
          disabled={!file}
          onClick={share}
          className="flex items-center justify-center gap-2 rounded-2xl bg-lemon py-3.5 font-semibold disabled:opacity-50"
        >
          <Share2Icon className="size-4" /> Share
        </button>
      </div>
    </Sheet>
  );
}
