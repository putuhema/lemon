-- The note on the fridge: one short line at the top of the shelf.
-- There's only ever one: either of you can replace it (and becomes its author), or take it down.

create table public.fridge (
  -- always true, so the table holds a single row
  id boolean primary key default true check (id),
  body text not null check (char_length(body) between 1 and 140),
  reader_id uuid not null references public.readers (id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.fridge enable row level security;

create policy "readers see the fridge" on public.fridge
  for select to authenticated using (public.is_reader());
create policy "readers put up a note" on public.fridge
  for insert to authenticated with check (public.is_reader() and reader_id = auth.uid());
create policy "readers replace the note" on public.fridge
  for update to authenticated using (public.is_reader()) with check (reader_id = auth.uid());
create policy "readers take the note down" on public.fridge
  for delete to authenticated using (public.is_reader());

alter publication supabase_realtime add table public.fridge;
