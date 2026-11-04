-- Journals: papers (PDF) and web articles you read together, next to the books.
-- Highlights, notes and replies on them use the same annotations and replies tables as books.

create table public.papers (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('pdf', 'article')),
  title text not null,
  -- journal or site name, and who wrote it
  source text,
  byline text,
  source_url text,
  -- PDFs live in the "papers" bucket
  file_path text,
  page_count integer,
  -- articles are saved as cleaned-up HTML, so they keep working if the site changes
  article_html text,
  article_text text,
  added_by uuid not null references public.readers (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint papers_content check (
    (kind = 'pdf' and file_path is not null) or
    (kind = 'article' and article_html is not null)
  )
);

create table public.paper_progress (
  reader_id uuid not null references public.readers (id) on delete cascade,
  paper_id uuid not null references public.papers (id) on delete cascade,
  -- PDFs: the page you're on (articles leave it at 1)
  page integer not null default 1,
  fraction double precision not null default 0,
  max_fraction double precision not null default 0,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (reader_id, paper_id)
);

-- A highlight belongs to a book (placed by its EPUB CFI) or a paper
-- (a page + rectangles on a PDF, or character offsets in an article's text).
alter table public.annotations
  alter column book_id drop not null,
  alter column cfi drop not null,
  add column paper_id uuid references public.papers (id) on delete cascade,
  add column page integer,
  add column rects jsonb,
  add column start_offset integer,
  add column end_offset integer,
  add constraint annotations_one_parent check (num_nonnulls(book_id, paper_id) = 1),
  add constraint annotations_book_cfi check (book_id is null or cfi is not null);
create index annotations_paper_idx on public.annotations (paper_id);

alter table public.papers enable row level security;
alter table public.paper_progress enable row level security;

create policy "readers see papers" on public.papers
  for select to authenticated using (public.is_reader());
create policy "readers add papers" on public.papers
  for insert to authenticated with check (public.is_reader() and added_by = auth.uid());
create policy "readers edit papers" on public.papers
  for update to authenticated using (public.is_reader());
create policy "readers delete papers" on public.papers
  for delete to authenticated using (public.is_reader());

create policy "readers see paper progress" on public.paper_progress
  for select to authenticated using (public.is_reader());
create policy "own paper progress insert" on public.paper_progress
  for insert to authenticated with check (public.is_reader() and reader_id = auth.uid());
create policy "own paper progress update" on public.paper_progress
  for update to authenticated using (reader_id = auth.uid()) with check (reader_id = auth.uid());

alter publication supabase_realtime add table public.papers;
alter publication supabase_realtime add table public.paper_progress;

-- PDFs (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('papers', 'papers', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

create policy "readers read paper files" on storage.objects
  for select to authenticated using (bucket_id = 'papers' and public.is_reader());
create policy "readers upload paper files" on storage.objects
  for insert to authenticated with check (bucket_id = 'papers' and public.is_reader());
create policy "readers delete paper files" on storage.objects
  for delete to authenticated using (bucket_id = 'papers' and public.is_reader());
