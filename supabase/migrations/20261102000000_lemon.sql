-- Lemon: a private reading app for two.
-- Paste this whole file into the Supabase SQL editor (or run `supabase db push`).

-- The two readers. Rows are only created by the setup script (service role),
-- so even if someone signs up with the public key, they are not a member.
create table public.readers (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_reader()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.readers where id = auth.uid());
$$;

create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  file_path text not null,
  cover_path text,
  uploaded_by uuid not null references public.readers (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.progress (
  reader_id uuid not null references public.readers (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  cfi text,
  fraction double precision not null default 0,
  max_fraction double precision not null default 0,
  chapter text,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (reader_id, book_id)
);

create table public.annotations (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  reader_id uuid not null references public.readers (id) on delete cascade,
  cfi text not null,
  fraction double precision not null,
  quote text not null,
  note text,
  emoji text,
  chapter text,
  created_at timestamptz not null default now()
);
create index annotations_book_idx on public.annotations (book_id);

create table public.replies (
  id uuid primary key default gen_random_uuid(),
  annotation_id uuid not null references public.annotations (id) on delete cascade,
  reader_id uuid not null references public.readers (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index replies_annotation_idx on public.replies (annotation_id);

create table public.push_subscriptions (
  endpoint text primary key,
  reader_id uuid not null references public.readers (id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

-- Row level security: both readers can see everything,
-- but can only write their own progress, notes and replies.
alter table public.readers enable row level security;
alter table public.books enable row level security;
alter table public.progress enable row level security;
alter table public.annotations enable row level security;
alter table public.replies enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "readers see readers" on public.readers
  for select to authenticated using (public.is_reader());

create policy "readers see books" on public.books
  for select to authenticated using (public.is_reader());
create policy "readers add books" on public.books
  for insert to authenticated with check (public.is_reader() and uploaded_by = auth.uid());
create policy "readers edit books" on public.books
  for update to authenticated using (public.is_reader());
create policy "readers delete books" on public.books
  for delete to authenticated using (public.is_reader());

create policy "readers see progress" on public.progress
  for select to authenticated using (public.is_reader());
create policy "own progress insert" on public.progress
  for insert to authenticated with check (public.is_reader() and reader_id = auth.uid());
create policy "own progress update" on public.progress
  for update to authenticated using (reader_id = auth.uid()) with check (reader_id = auth.uid());

create policy "readers see annotations" on public.annotations
  for select to authenticated using (public.is_reader());
create policy "own annotations insert" on public.annotations
  for insert to authenticated with check (public.is_reader() and reader_id = auth.uid());
create policy "own annotations update" on public.annotations
  for update to authenticated using (reader_id = auth.uid()) with check (reader_id = auth.uid());
create policy "own annotations delete" on public.annotations
  for delete to authenticated using (reader_id = auth.uid());

create policy "readers see replies" on public.replies
  for select to authenticated using (public.is_reader());
create policy "own replies insert" on public.replies
  for insert to authenticated with check (public.is_reader() and reader_id = auth.uid());
create policy "own replies delete" on public.replies
  for delete to authenticated using (reader_id = auth.uid());

create policy "own push subs" on public.push_subscriptions
  for all to authenticated
  using (reader_id = auth.uid())
  with check (public.is_reader() and reader_id = auth.uid());

-- Live updates
alter publication supabase_realtime add table public.books;
alter publication supabase_realtime add table public.progress;
alter publication supabase_realtime add table public.annotations;
alter publication supabase_realtime add table public.replies;

-- File storage for the ebooks and their covers (private)
insert into storage.buckets (id, name, public, file_size_limit)
values ('books', 'books', false, 52428800)
on conflict (id) do nothing;

create policy "readers read book files" on storage.objects
  for select to authenticated using (bucket_id = 'books' and public.is_reader());
create policy "readers upload book files" on storage.objects
  for insert to authenticated with check (bucket_id = 'books' and public.is_reader());
create policy "readers delete book files" on storage.objects
  for delete to authenticated using (bucket_id = 'books' and public.is_reader());

-- Private realtime channel (live presence, page position, nudges)
create policy "readers receive realtime" on realtime.messages
  for select to authenticated using (public.is_reader());
create policy "readers send realtime" on realtime.messages
  for insert to authenticated with check (public.is_reader());
