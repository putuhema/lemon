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
