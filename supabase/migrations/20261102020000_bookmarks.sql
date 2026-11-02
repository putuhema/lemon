-- Bookmarks: each reader's saved pages in a book.

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  reader_id uuid not null references public.readers (id) on delete cascade,
  cfi text not null,
  fraction double precision not null,
  chapter text,
  excerpt text,
  created_at timestamptz not null default now()
);
create index bookmarks_book_reader_idx on public.bookmarks (book_id, reader_id);

alter table public.bookmarks enable row level security;

create policy "readers see bookmarks" on public.bookmarks
  for select to authenticated using (public.is_reader());
create policy "own bookmarks insert" on public.bookmarks
  for insert to authenticated with check (public.is_reader() and reader_id = auth.uid());
create policy "own bookmarks delete" on public.bookmarks
  for delete to authenticated using (reader_id = auth.uid());
