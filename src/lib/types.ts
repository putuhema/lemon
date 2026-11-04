export type Reader = { id: string; name: string; color: string };

export type Book = {
  id: string;
  title: string;
  author: string | null;
  file_path: string;
  cover_path: string | null;
  uploaded_by: string;
  created_at: string;
};

export type Progress = {
  reader_id: string;
  book_id: string;
  cfi: string | null;
  fraction: number;
  max_fraction: number;
  chapter: string | null;
  finished_at: string | null;
  updated_at: string;
};

export type Annotation = {
  id: string;
  book_id: string;
  reader_id: string;
  cfi: string;
  fraction: number;
  quote: string;
  note: string | null;
  emoji: string | null;
  chapter: string | null;
  created_at: string;
};

export type Reply = {
  id: string;
  annotation_id: string;
  reader_id: string;
  body: string;
  created_at: string;
};

/** What the other person is doing right now, shared over the live channel. */
export type Activity = {
  bookId: string | null;
  following: boolean;
};

export type LivePosition = {
  bookId: string;
  cfi: string;
  fraction: number;
  chapter: string | null;
};

export type Bookmark = {
  id: string;
  book_id: string;
  reader_id: string;
  cfi: string;
  fraction: number;
  chapter: string | null;
  excerpt: string | null;
  created_at: string;
};

/** A journal paper (PDF) or a saved web article. */
export type Paper = {
  id: string;
  kind: "pdf" | "article";
  title: string;
  source: string | null;
  byline: string | null;
  source_url: string | null;
  file_path: string | null;
  page_count: number | null;
  added_by: string;
  created_at: string;
};

/** The article's saved HTML, loaded only when you open it. */
export type PaperBody = Paper & { article_html: string | null };

export type PaperProgress = {
  reader_id: string;
  paper_id: string;
  page: number;
  fraction: number;
  max_fraction: number;
  finished_at: string | null;
  updated_at: string;
};

/** A spot on a PDF page, as fractions of the page size. */
export type Rect = { x: number; y: number; w: number; h: number };

/** A highlight on a paper: a page and rectangles on a PDF, or character offsets in an article. */
export type PaperNote = {
  id: string;
  paper_id: string;
  reader_id: string;
  fraction: number;
  quote: string;
  note: string | null;
  emoji: string | null;
  page: number | null;
  rects: Rect[] | null;
  start_offset: number | null;
  end_offset: number | null;
  created_at: string;
};
