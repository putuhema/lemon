import type { PaperNote, Rect } from "@/lib/types";

/** Selected text in a paper, with where it is: rectangles on a PDF page, or offsets in an article. */
export type PaperSelection = {
  quote: string;
  /** How far into the paper it is (0–1), used to hide your partner's notes until you get there. */
  fraction: number;
  page?: number;
  rects?: Rect[];
  range?: { start: number; end: number };
};

/** Where you are: the page (PDFs) and how far through (0–1). */
export type Place = { page: number; fraction: number };

export type PaperViewerHandle = {
  scrollToNote: (note: PaperNote) => void;
  scrollToPlace: (place: Place) => void;
  clearSelection: () => void;
};

export type PaperViewerProps = {
  notes: PaperNote[];
  colorOf: (readerId: string) => string;
  initial: Place;
  /** Your partner's place, shown as a marker. */
  partner: (Place & { name: string; color: string }) | null;
  onProgress: (place: Place) => void;
  onSelect: (selection: PaperSelection | null) => void;
  onNoteTap: (ids: string[]) => void;
};
