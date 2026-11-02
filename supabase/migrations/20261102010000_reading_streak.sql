-- Reading streak: pages each reader turned per day (their own local date).
-- A day counts once a reader turns a few pages; the couple's streak grows on days you both read.

create table public.reading_days (
  reader_id uuid not null references public.readers (id) on delete cascade,
  day date not null,
  pages integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (reader_id, day)
);

alter table public.reading_days enable row level security;

create policy "readers see reading days" on public.reading_days
  for select to authenticated using (public.is_reader());
create policy "own reading days insert" on public.reading_days
  for insert to authenticated with check (public.is_reader() and reader_id = auth.uid());
create policy "own reading days update" on public.reading_days
  for update to authenticated using (reader_id = auth.uid()) with check (reader_id = auth.uid());

-- Adds pages to today's count and returns the new total.
create or replace function public.log_reading(p_day date, p_pages integer)
returns integer
language sql
security invoker
set search_path = ''
as $$
  insert into public.reading_days (reader_id, day, pages)
  values (auth.uid(), p_day, greatest(p_pages, 0))
  on conflict (reader_id, day)
  do update set pages = public.reading_days.pages + excluded.pages, updated_at = now()
  returning pages;
$$;

alter publication supabase_realtime add table public.reading_days;
